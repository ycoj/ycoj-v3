import { load } from 'js-yaml';
import { ValidationError } from '../error';
import type { PreliminaryChoiceQuestion } from '../interface';
import { normalizePreliminaryDefinition } from './preliminary';

function invalid(message: string): never {
    throw new ValidationError('pid', null, message);
}

export function objectiveConfig(value: unknown): Record<string, unknown> {
    try {
        const config = typeof value === 'string' ? load(value) : value;
        return config && typeof config === 'object' && !Array.isArray(config) ? config as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

export function objectiveToPreliminary(title: string, content: string, rawConfig: unknown) {
    const config = objectiveConfig(rawConfig);
    if (config.type !== 'objective') invalid('请选择客观题。');
    const answers = config.answers;
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) invalid('该客观题没有有效的标准答案。');
    const lines = content.replace(/\r/g, '').split('\n');
    const questions: PreliminaryChoiceQuestion[] = [];
    const seen = new Set<string>();
    let prompt: string[] = [];
    let fence = '';
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fenceMatch) {
            if (!fence) fence = fenceMatch[1];
            else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = '';
            prompt.push(line);
            continue;
        }
        if (fence || /^(?: {4}|\t)/.test(line)) {
            prompt.push(line);
            continue;
        }
        const visibleLine = line.replace(/(`+).*?\1/g, (code) => ' '.repeat(code.length));
        const markers = [...visibleLine.matchAll(/\{\{\s*(input|textarea|select|multiselect|dropdown)\((\d+(?:-\d+)?)\)(?:\[([^\]]*)\])?\s*\}\}/g)];
        if (!markers.length) {
            prompt.push(line);
            continue;
        }
        if (markers.length !== 1) invalid('一行包含多个作答位置，请先拆分题目后再转换。');
        const [marker] = markers;
        const [, kind, sourceId, values] = marker;
        if (!['select', 'dropdown'].includes(kind)) invalid(`第 ${sourceId} 题不是单选题，暂时无法转换为初赛训练。`);
        if (seen.has(sourceId)) invalid(`第 ${sourceId} 题的作答位置重复。`);
        seen.add(sourceId);
        prompt.push(line.slice(0, marker.index) + line.slice(marker.index + marker[0].length));
        const options: Array<{ id: string, text: string }> = [];
        if (kind === 'dropdown') {
            for (const value of (values || '').split(',').map((item) => item.trim()).filter(Boolean)) {
                options.push({ id: String.fromCharCode(65 + options.length), text: value });
            }
        } else {
            let next = index + 1;
            while (next < lines.length && !lines[next].trim()) next++;
            while (next < lines.length) {
                const option = lines[next].match(/^ {0,3}[-+*]\s+(.*)$/);
                if (!option) break;
                const optionLines = [option[1]];
                next++;
                while (next < lines.length && (/^ {2,}\S|^\t/.test(lines[next]) || !lines[next].trim())) {
                    optionLines.push(lines[next].replace(/^ {2}/, ''));
                    next++;
                }
                options.push({ id: String.fromCharCode(65 + options.length), text: optionLines.join('\n').trim() });
            }
            if (options.length) index = next - 1;
        }
        if (options.length < 2 || options.length > 26) invalid(`第 ${sourceId} 题需要 2 至 26 个选项，且选项应紧跟作答标记。`);
        const answerInfo = (answers as Record<string, unknown>)[sourceId];
        if (!Array.isArray(answerInfo) || answerInfo.length !== 2 || Array.isArray(answerInfo[0])) {
            invalid(`第 ${sourceId} 题的标准答案不支持转换，请使用单一答案及分值。`);
        }
        const answerValue = String(answerInfo[0]);
        const answer = kind === 'dropdown'
            ? options.find((option) => option.text === answerValue)?.id
            : options.find((option) => option.id === answerValue)?.id;
        if (!answer) invalid(`第 ${sourceId} 题的标准答案与选项不匹配。`);
        questions.push({
            id: `q-${sourceId}`,
            type: 'choice',
            prompt: prompt.join('\n').trim() || `第 ${sourceId} 题`,
            options,
            answer,
            score: Number(answerInfo[1]),
            explanation: '',
        });
        prompt = [];
    }
    if (!questions.length) invalid('没有找到可转换的单选题，请检查题面中的作答标记。');
    if (Object.keys(answers).some((key) => !seen.has(key))) invalid('题面中的作答位置与标准答案不一致，无法完整转换。');
    if (prompt.join('\n').trim()) questions[questions.length - 1].prompt += `\n\n${prompt.join('\n').trim()}`;
    return normalizePreliminaryDefinition({
        title,
        content: '',
        sections: [{ id: 'objective-section', type: 'single_choice', title, content: '', questions }],
    }, true);
}
