import {
    DOCUMENT_TYPES,
    IMPORTANCE_LEVELS,
    RECHTSPRAAK_INSTANCES,
    RECHTSPRAAK_DOMAINS
} from '~/lib/utils/constants';
import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

// Pre-build sorted lists (longest first for multi-word matches)
const SORTED_INSTANCES = [...RECHTSPRAAK_INSTANCES].sort((a, b) => b.length - a.length);
const SORTED_DOMAINS = [...RECHTSPRAAK_DOMAINS].sort((a, b) => b.length - a.length);
const SORTED_DOC_TYPES = [...DOCUMENT_TYPES].sort((a, b) => b.length - a.length);

// Importance aliases
const IMPORTANCE_ALIASES: { pattern: string; value: number; label: string }[] = [
    { pattern: 'key case', value: 1, label: 'Key case' },
    { pattern: 'key cases', value: 1, label: 'Key case' },
    { pattern: 'important case', value: 2, label: 'Important' },
    { pattern: 'important cases', value: 2, label: 'Important' },
    { pattern: 'moderate importance', value: 3, label: 'Moderate' },
    { pattern: 'low importance', value: 4, label: 'Low importance' },
].sort((a, b) => b.pattern.length - a.pattern.length);

export type MetadataRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

function matchList(
    input: string,
    lowerInput: string,
    items: string[],
    type: ParsedToken['type'],
    consumed: [number, number][]
): ParseSuggestion[] {
    const suggestions: ParseSuggestion[] = [];
    for (const item of items) {
        const pattern = item.toLowerCase();
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
            // Check not consumed
            if (consumed.some(([cs, ce]) => (start >= cs && start < ce) || (end > cs && end <= ce))) {
                searchFrom = idx + 1;
                continue;
            }

            const token: ParsedToken = {
                id: genId(),
                type,
                value: item,
                display: item,
            };
            suggestions.push({
                id: genId(),
                trigger: input.slice(start, end),
                triggerStart: start,
                triggerEnd: end,
                token,
                preview: item,
            });
            consumed.push([start, end]);
            searchFrom = end;
        }
    }
    return suggestions;
}

export function recognizeMetadata(input: string): MetadataRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];
    const lowerInput = input.toLowerCase();

    // 1. Importance (multi-word, match first)
    for (const { pattern, value, label } of IMPORTANCE_ALIASES) {
        const idx = lowerInput.indexOf(pattern);
        if (idx === -1) continue;
        const start = idx;
        const end = idx + pattern.length;

        if (start > 0 && /\w/.test(input[start - 1])) continue;
        if (end < input.length && /\w/.test(input[end])) continue;
        if (consumed.some(([cs, ce]) => (start >= cs && start < ce) || (end > cs && end <= ce))) continue;

        const token: ParsedToken = {
            id: genId(),
            type: 'importance',
            value: String(value),
            display: label,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: label,
        });
        consumed.push([start, end]);
    }

    // 2. Document types
    suggestions.push(...matchList(input, lowerInput, SORTED_DOC_TYPES, 'document_type', consumed));

    // 3. Rechtspraak instances
    suggestions.push(...matchList(input, lowerInput, SORTED_INSTANCES, 'instance', consumed));

    // 4. Rechtspraak domains
    suggestions.push(...matchList(input, lowerInput, SORTED_DOMAINS, 'domain', consumed));

    return { tokens, suggestions, consumed };
}
