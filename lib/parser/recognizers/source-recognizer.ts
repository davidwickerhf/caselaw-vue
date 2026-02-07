import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

const ECHR_PATTERNS = [
    'european court of human rights',
    'european court',
    'echr cases',
    'echr',
    'hudoc',
    'strasbourg',
];

const RS_PATTERNS = [
    'rechtspraak cases',
    'rechtspraak',
    'dutch cases',
    'dutch case law',
    'dutch law',
    'netherlands cases',
];

// Sort longest first
const ALL_SOURCE_PATTERNS = [
    ...ECHR_PATTERNS.map((p) => ({ pattern: p, value: 'ECHR', display: 'ECHR' })),
    ...RS_PATTERNS.map((p) => ({ pattern: p, value: 'RS', display: 'Rechtspraak' })),
].sort((a, b) => b.pattern.length - a.pattern.length);

export type SourceRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

export function recognizeSources(input: string): SourceRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];
    const lowerInput = input.toLowerCase();

    for (const { pattern, value, display } of ALL_SOURCE_PATTERNS) {
        let searchFrom = 0;
        while (true) {
            const idx = lowerInput.indexOf(pattern, searchFrom);
            if (idx === -1) break;
            const start = idx;
            const end = idx + pattern.length;

            // Word boundary check
            if (start > 0 && /\w/.test(input[start - 1])) {
                searchFrom = idx + 1;
                continue;
            }
            if (end < input.length && /\w/.test(input[end])) {
                searchFrom = idx + 1;
                continue;
            }
            // Check not already consumed
            if (consumed.some(([cs, ce]) => (start >= cs && start < ce) || (end > cs && end <= ce))) {
                searchFrom = idx + 1;
                continue;
            }

            const token: ParsedToken = {
                id: genId(),
                type: 'source',
                value,
                display,
            };
            suggestions.push({
                id: genId(),
                trigger: input.slice(start, end),
                triggerStart: start,
                triggerEnd: end,
                token,
                preview: display,
            });
            consumed.push([start, end]);
            searchFrom = end;
        }
    }

    return { tokens, suggestions, consumed };
}
