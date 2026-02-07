import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export type EcliRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

const ECLI_RE = /\bECLI:[A-Z]{2}:[A-Z0-9]{2,}:\d{4}:[A-Z0-9.-]+\b/gi;

export function recognizeEcli(input: string): EcliRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    let match: RegExpExecArray | null;
    ECLI_RE.lastIndex = 0;
    while ((match = ECLI_RE.exec(input)) !== null) {
        const value = match[0].toUpperCase();
        const start = match.index;
        const end = start + match[0].length;

        const token: ParsedToken = {
            id: genId(),
            type: 'ecli',
            value,
            display: value,
        };
        suggestions.push({
            id: genId(),
            trigger: match[0],
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: value,
        });
        consumed.push([start, end]);
    }

    return { tokens, suggestions, consumed };
}
