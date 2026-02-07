import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export type ApplicationRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

const CONTEXT_RE = /\b(?:app(?:lication)?(?:\s+no\.?|(?:lication)?\s+number)?|application(?:\s+number)?|applicatie(?:\s+nummer)?|applicatienummer|aanvraagnummer|no\.?)\s*(\d{1,6}\/\d{2})\b/gi;
const BARE_RE = /\b(\d{3,6}\/\d{2})\b/g;

export function recognizeApplicationNumbers(input: string): ApplicationRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    let match: RegExpExecArray | null;
    CONTEXT_RE.lastIndex = 0;
    while ((match = CONTEXT_RE.exec(input)) !== null) {
        const value = match[1];
        const start = match.index;
        const end = start + match[0].length;

        const token: ParsedToken = {
            id: genId(),
            type: 'application_number',
            value,
            display: value,
        };
        suggestions.push({
            id: genId(),
            trigger: match[0],
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `App. ${value}`,
        });
        consumed.push([start, end]);
    }

    BARE_RE.lastIndex = 0;
    while ((match = BARE_RE.exec(input)) !== null) {
        const value = match[1];
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const token: ParsedToken = {
            id: genId(),
            type: 'application_number',
            value,
            display: value,
        };
        suggestions.push({
            id: genId(),
            trigger: match[0],
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `App. ${value}`,
        });
        consumed.push([start, end]);
    }

    return { tokens, suggestions, consumed };
}
