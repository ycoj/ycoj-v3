import type { AiModelRuntimeConfig } from './runtime';

export interface AiAgentEvent {
    phase: 'tool-start' | 'tool-end';
    toolCallId: string;
    tool: string;
    summary: string;
    details?: Record<string, any>;
    error?: string;
    failed?: boolean;
}

export interface AiAgentTool {
    name: string;
    label: string;
    description: string;
    parameters: any;
    executionMode?: 'sequential' | 'parallel';
    execute(toolCallId: string, params: any, signal?: AbortSignal): Promise<any>;
}

export interface AiAgentRunner {
    prompt(text: string): Promise<string>;
    abort(): void;
}

const MAX_TOOL_ERROR_TEXT = 4_096;

export function toolTextResult(text: string, details: any = {}) {
    return { content: [{ type: 'text' as const, text }], details };
}

function boundedToolError(result: any) {
    const content = Array.isArray(result?.content) ? result.content : [];
    let text = '';
    for (const block of content) {
        if (block?.type !== 'text' || typeof block.text !== 'string') continue;
        const prefix = text ? '\n' : '';
        const remaining = MAX_TOOL_ERROR_TEXT - text.length - prefix.length;
        if (remaining <= 0) break;
        text += `${prefix}${block.text.slice(0, remaining)}`;
    }
    return text || undefined;
}

function finalAssistantText(agent: any) {
    const message = [...agent.state.messages].reverse().find((item: any) => item.role === 'assistant') as any;
    if (!message) return '';
    return message.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
        .trim();
}

export interface CreateToolAgentOptions {
    config: AiModelRuntimeConfig;
    providerSessionId: string;
    systemPrompt: string;
    tools: AiAgentTool[];
    providerLabel?: string;
    describeToolStart?: (tool: string, args: any) => string;
    describeToolResult?: (tool: string, result: any) => { summary: string, details?: Record<string, any> };
    onEvent?: (event: AiAgentEvent) => Promise<void> | void;
}

/**
 * Shared pi-agent runner used by every Hydro AI agent (test data generation, contest analysis).
 * The caller owns the tool definitions; this function only wires the model, session and events.
 */
export async function createToolAgent(options: CreateToolAgentOptions): Promise<AiAgentRunner> {
    const { config } = options;
    const load = (specifier: string): Promise<any> => import(specifier);
    const [{ Agent: PiAgent }, ai, apiModule] = await Promise.all([
        load('@earendil-works/pi-agent-core'),
        load('@earendil-works/pi-ai'),
        config.apiType === 'openai-responses'
            ? load('@earendil-works/pi-ai/api/openai-responses.lazy')
            : load('@earendil-works/pi-ai/api/openai-completions.lazy'),
    ]);
    const providerId = config.providerId || 'ai-generation';
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    const model = {
        id: config.model,
        name: config.model,
        api: config.apiType,
        provider: providerId,
        baseUrl,
        reasoning: config.reasoning,
        input: ['text'],
        cost: {
            input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
        },
        contextWindow: config.contextTokens,
        maxTokens: config.maxTokens,
    };
    const provider = ai.createProvider({
        id: providerId,
        name: config.providerName || options.providerLabel || 'Hydro AI agent',
        baseUrl,
        auth: {
            apiKey: {
                name: 'AI agent API key',
                resolve: async ({ signal }: { signal: AbortSignal }) => {
                    signal.throwIfAborted();
                    return config.apiKey
                        ? { auth: { apiKey: config.apiKey }, source: 'Hydro AI provider configuration' }
                        : undefined;
                },
            },
        },
        models: [model],
        api: config.apiType === 'openai-responses'
            ? apiModule.openAIResponsesApi()
            : apiModule.openAICompletionsApi(),
    });
    const models = ai.createModels();
    models.setProvider(provider);
    const agent = new PiAgent({
        initialState: {
            systemPrompt: options.systemPrompt,
            model,
            thinkingLevel: config.reasoning ? config.thinkingLevel : 'off',
            tools: options.tools,
            messages: [],
        },
        streamFn: models.streamSimple.bind(models),
        sessionId: options.providerSessionId,
        toolExecution: 'sequential',
    });
    let eventUpdates = Promise.resolve();
    agent.subscribe((event: any) => {
        let update: AiAgentEvent | undefined;
        if (event.type === 'tool_execution_start') {
            update = {
                phase: 'tool-start',
                toolCallId: event.toolCallId,
                tool: event.toolName,
                summary: options.describeToolStart?.(event.toolName, event.args) || '',
            };
        } else if (event.type === 'tool_execution_end') {
            const failed = event.isError === true;
            const describe = options.describeToolResult?.(event.toolName, event.result) || { summary: '' };
            update = {
                phase: 'tool-end',
                toolCallId: event.toolCallId,
                tool: event.toolName,
                summary: failed ? 'tool execution error' : describe.summary,
                details: describe.details,
                error: failed ? boundedToolError(event.result) : undefined,
                failed,
            };
        }
        if (update && options.onEvent) {
            eventUpdates = eventUpdates
                .then(() => options.onEvent!(update))
                .catch(() => undefined)
                .then(() => undefined);
        }
        // Deliberately ignore thinking and text streaming events. The final response is returned only to the caller.
    });
    return {
        async prompt(text: string) {
            await agent.prompt(text);
            await eventUpdates;
            if (agent.state.errorMessage) throw new Error(agent.state.errorMessage);
            return finalAssistantText(agent);
        },
        abort: () => agent.abort(),
    };
}
