import { RESPONDENT_STATES, RESPONDENT_STATE_ALIASES } from '~/lib/utils/constants';
import type { ParsedToken, ParseSuggestion } from '~/lib/types';

// Build combined list: full names + aliases, sorted longest-first
const ALL_NAMES: { pattern: string; canonical: string; isAlias: boolean }[] = [
    ...RESPONDENT_STATES.map((s) => ({ pattern: s.toLowerCase(), canonical: s, isAlias: false })),
    ...Object.entries(RESPONDENT_STATE_ALIASES).map(([alias, canonical]) => ({
        pattern: alias.toLowerCase(),
        canonical,
        isAlias: true,
    })),
].sort((a, b) => b.pattern.length - a.pattern.length);

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export type StateRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

export function recognizeStates(input: string): StateRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];
    const lowerInput = input.toLowerCase();

    for (const { pattern, canonical, isAlias } of ALL_NAMES) {
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
                type: 'respondent_state',
                value: canonical,
                display: canonical,
            };
            suggestions.push({
                id: genId(),
                trigger: input.slice(start, end),
                triggerStart: start,
                triggerEnd: end,
                token,
                preview: canonical,
            });
            consumed.push([start, end]);
            searchFrom = end;
        }
    }

    return { tokens, suggestions, consumed };
}
