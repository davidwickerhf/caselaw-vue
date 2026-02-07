import {
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

const DOC_TYPE_ALIASES: { pattern: string; value: string; label: string }[] = [
    { pattern: 'judgment', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'judgement', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'arrest', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'decision', value: 'HEDEC', label: 'Decision' },
    { pattern: 'rs decision', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'rechtspraak decision', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'rechtspraak beslissing', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'rechtspraak uitspraak', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'ehrm beslissing', value: 'HEDEC', label: 'Decision' },
    { pattern: 'echr beslissing', value: 'HEDEC', label: 'Decision' },
    { pattern: 'ehrm arrest', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'echr arrest', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'ehrm uitspraak', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'echr uitspraak', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'beslissing', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'beslissingen', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'uitspraak', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'uitspraken', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'beschikking', value: 'HEDEC', label: 'Decision' },
    { pattern: 'communicated case', value: 'HECOM', label: 'Communicated Case' },
    { pattern: 'communication', value: 'HECOM', label: 'Communicated Case' },
    { pattern: 'information', value: 'HEINF', label: 'Information' },
    { pattern: 'chamber judgment', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'grand chamber judgment', value: 'HECJUD', label: 'GC Judgment' },
    { pattern: 'grand chamber decision', value: 'HECDEC', label: 'GC Decision' },
    { pattern: 'grand chamber arrest', value: 'HECJUD', label: 'GC Judgment' },
    { pattern: 'grote kamer arrest', value: 'HECJUD', label: 'GC Judgment' },
    { pattern: 'grote kamer beslissing', value: 'HECDEC', label: 'GC Decision' },
    { pattern: 'gc judgment', value: 'HECJUD', label: 'GC Judgment' },
    { pattern: 'gc decision', value: 'HECDEC', label: 'GC Decision' },
    { pattern: 'dec', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'decision (rs)', value: 'DEC', label: 'Decision (RS)' },
    { pattern: 'opinion', value: 'OPI', label: 'Opinion (RS)' },
    { pattern: 'advies', value: 'OPI', label: 'Opinion (RS)' },
    { pattern: 'opi', value: 'OPI', label: 'Opinion (RS)' },
    { pattern: 'hej', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'hejud', value: 'HEJUD', label: 'Judgment' },
    { pattern: 'hedec', value: 'HEDEC', label: 'Decision' },
    { pattern: 'hecom', value: 'HECOM', label: 'Communicated Case' },
    { pattern: 'heinf', value: 'HEINF', label: 'Information' },
    { pattern: 'hecjud', value: 'HECJUD', label: 'GC Judgment' },
    { pattern: 'hecdec', value: 'HECDEC', label: 'GC Decision' },
    { pattern: 'heccom', value: 'HECCOM', label: 'GC Communicated' },
    { pattern: 'hecinf', value: 'HECINF', label: 'GC Information' },
].sort((a, b) => b.pattern.length - a.pattern.length);

// Importance aliases
const IMPORTANCE_ALIASES: { pattern: string; value: number; label: string }[] = [
    { pattern: 'key case', value: 1, label: 'Key case' },
    { pattern: 'key cases', value: 1, label: 'Key case' },
    { pattern: 'important case', value: 2, label: 'Important' },
    { pattern: 'important cases', value: 2, label: 'Important' },
    { pattern: 'moderate importance', value: 3, label: 'Moderate' },
    { pattern: 'low importance', value: 4, label: 'Low importance' },
    { pattern: 'kernzaak', value: 1, label: 'Key case' },
    { pattern: 'belangrijke zaak', value: 2, label: 'Important' },
    { pattern: 'belangrijke zaken', value: 2, label: 'Important' },
    { pattern: 'gemiddeld belang', value: 3, label: 'Moderate' },
    { pattern: 'matig belang', value: 3, label: 'Moderate' },
    { pattern: 'laag belang', value: 4, label: 'Low importance' },
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

    // 2. Importance numeric ("importance 2", "importance level 3")
    const impNumeric = /\b(?:importance(?:\s+level)?|belang(?:rijkheid|niveau)?)\s*(\d)\b/gi;
    let impMatch: RegExpExecArray | null;
    while ((impMatch = impNumeric.exec(input)) !== null) {
        const num = Number(impMatch[1]);
        if (num < 1 || num > 4) continue;
        const start = impMatch.index;
        const end = start + impMatch[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const label = IMPORTANCE_LEVELS.find((l) => l.value === num)?.label || String(num);
        const token: ParsedToken = {
            id: genId(),
            type: 'importance',
            value: String(num),
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

    // 3. Document types (aliases + labels)
    for (const { pattern, value, label } of DOC_TYPE_ALIASES) {
        let searchFrom = 0;
        while (true) {
            const idx = lowerInput.indexOf(pattern, searchFrom);
            if (idx === -1) break;
            const start = idx;
            const end = idx + pattern.length;
            if (start > 0 && /\w/.test(input[start - 1])) {
                searchFrom = idx + 1;
                continue;
            }
            if (end < input.length && /\w/.test(input[end])) {
                searchFrom = idx + 1;
                continue;
            }
            if (consumed.some(([cs, ce]) => (start >= cs && start < ce) || (end > cs && end <= ce))) {
                searchFrom = idx + 1;
                continue;
            }

            const token: ParsedToken = {
                id: genId(),
                type: 'document_type',
                value,
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
            searchFrom = end;
        }
    }

    // 4. Rechtspraak instances
    suggestions.push(...matchList(input, lowerInput, SORTED_INSTANCES, 'instance', consumed));

    // 5. Rechtspraak domains
    suggestions.push(...matchList(input, lowerInput, SORTED_DOMAINS, 'domain', consumed));

    return { tokens, suggestions, consumed };
}
