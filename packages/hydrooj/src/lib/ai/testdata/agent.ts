import type { AiAgentEvent as AiAgentEventType, AiAgentRunner as AiAgentRunnerType } from '../agent';
import { createToolAgent } from '../agent';
import type { AiModelRuntimeConfig } from '../runtime';
import { GoJudgeSessionClient } from './session';

function textResult(text: string, details: any) {
    return { content: [{ type: 'text' as const, text }], details };
}

function summarizeTool(tool: string, args: any) {
    if (tool === 'Read') return String(args?.path || '');
    if (tool === 'Edit') return String(args?.path || '');
    if (tool === 'Shell') {
        return String(args?.command || '').trim();
    }
    return '';
}

function summarizeToolResult(tool: string, result: any) {
    const details = result?.details || {};
    if (tool === 'Read') return `${details.lines || 0}/${details.totalLines || 0} line(s)`;
    if (tool === 'Edit') return `${details.bytes || 0} byte(s)`;
    if (tool === 'Shell') return String(details.command || '').trim();
    return '';
}

function toolResultDetails(tool: string, result: any): Record<string, any> {
    const details = result?.details || {};
    if (tool === 'Read') {
        return {
            path: details.path,
            offset: details.offset,
            lines: details.lines,
            totalLines: details.totalLines,
            truncated: !!details.truncated,
        };
    }
    if (tool === 'Edit') return { path: details.path, bytes: details.bytes };
    if (tool === 'Shell') {
        return {
            commandLength: String(details.command || '').length,
            status: details.status,
            exitStatus: details.exitStatus,
            time: details.time,
            memory: details.memory,
            runTime: details.runTime,
        };
    }
    return {};
}

export function createSessionTools(
    client: GoJudgeSessionClient, sessionId: string, Type: any,
): any[] {
    const readSchema = Type.Object({
        path: Type.String({ description: 'Relative workspace path' }),
        offset: Type.Optional(Type.Integer({ minimum: 1, description: 'First line, 1-based' })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 2000, description: 'Maximum lines' })),
    });
    const editSchema = Type.Object({
        path: Type.String({ description: 'Relative workspace path' }),
        oldText: Type.String({ minLength: 1, description: 'Exact text occurring exactly once' }),
        newText: Type.String({ description: 'Replacement text' }),
    });
    const shellSchema = Type.Object({
        command: Type.String({ minLength: 1, maxLength: 16384 }),
        timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 120 })),
    });

    const Read = {
        name: 'Read',
        label: 'Read',
        description: 'Read a UTF-8 file in the persistent sandbox workspace by relative path, with optional line offset and limit.',
        parameters: readSchema,
        executionMode: 'sequential',
        async execute(_toolCallId, params, signal) {
            const result = await client.readText(sessionId, params.path, params.offset, params.limit, undefined, signal);
            const suffix = result.truncated
                ? `\n[Showing ${result.lines} line(s) from ${result.offset}; ${result.totalLines} total. Output truncated.]`
                : '';
            return textResult(`${result.content}${suffix}`, {
                path: params.path, offset: result.offset, lines: result.lines, totalLines: result.totalLines, truncated: result.truncated,
            });
        },
    };
    const Edit = {
        name: 'Edit',
        label: 'Edit',
        description: 'Replace exactly one unique occurrence of text in a UTF-8 workspace file. Fails when the text is absent or ambiguous.',
        parameters: editSchema,
        executionMode: 'sequential',
        async execute(_toolCallId, params, signal) {
            const original = (await client.readFile(sessionId, params.path, signal)).toString('utf8');
            const first = original.indexOf(params.oldText);
            if (first < 0) throw new Error(`Edit target was not found in ${params.path}.`);
            if (original.includes(params.oldText, first + 1)) {
                throw new Error(`Edit target is not unique in ${params.path}.`);
            }
            const updated = `${original.slice(0, first)}${params.newText}${original.slice(first + params.oldText.length)}`;
            await client.writeFile(sessionId, params.path, updated, signal);
            return textResult(`Updated ${params.path}.`, { path: params.path, bytes: Buffer.byteLength(updated) });
        },
    };
    const Shell = {
        name: 'Shell',
        label: 'Shell',
        description: 'Run a command through /bin/sh -lc inside the persistent, network-isolated sandbox workspace.',
        parameters: shellSchema,
        executionMode: 'sequential',
        async execute(_toolCallId, params, signal) {
            const seconds = params.timeoutSeconds || 30;
            const result = await client.execShell(sessionId, params.command, signal, {
                cpuLimit: Math.min(seconds, 60) * 1_000_000_000,
                clockLimit: seconds * 1_000_000_000,
            });
            const output = [
                `status: ${result.status}`,
                `exitStatus: ${result.exitStatus}`,
                result.stdout ? `stdout:\n${result.stdout}` : '',
                result.stderr ? `stderr:\n${result.stderr}` : '',
                result.error ? `error:\n${result.error}` : '',
            ].filter(Boolean).join('\n');
            return textResult(output, {
                command: String(params.command || '').trim(),
                status: result.status,
                exitStatus: result.exitStatus,
                time: result.time,
                memory: result.memory,
                runTime: result.runTime,
            });
        },
    };
    return [Read, Edit, Shell];
}

export { type AiAgentEvent, type AiAgentRunner } from '../agent';

export async function createAiAgent(
    config: AiModelRuntimeConfig, client: GoJudgeSessionClient, sandboxSessionId: string,
    providerSessionId: string, systemPrompt: string,
    onEvent?: (event: AiAgentEventType) => Promise<void> | void,
): Promise<AiAgentRunnerType> {
    return createToolAgent({
        config,
        providerSessionId,
        systemPrompt,
        providerLabel: 'AI testdata generation',
        tools: createSessionTools(client, sandboxSessionId, (await import('@earendil-works/pi-ai')).Type),
        describeToolStart: summarizeTool,
        describeToolResult: (tool, result) => ({
            summary: summarizeToolResult(tool, result),
            details: toolResultDetails(tool, result),
        }),
        onEvent,
    });
}
