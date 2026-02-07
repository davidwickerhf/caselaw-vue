import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

const STOP_WORDS = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'nor',
    'for',
    'so',
    'yet',
    'of',
    'in',
    'on',
    'at',
    'to',
    'from',
    'by',
    'with',
    'without',
    'over',
    'under',
    'between',
    'into',
    'onto',
    'upon',
    'per',
    'via',
    'as',
    'vs',
    'vs.',
    'v',
    'v.',
]);

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function standardizeCase(text: string): string {
    const parts = text.split(' ');
    const total = parts.length;

    return parts
        .map((part, index) => {
            const leading = part.match(/^[^A-Za-z0-9]+/)?.[0] ?? '';
            const trailing = part.match(/[^A-Za-z0-9]+$/)?.[0] ?? '';
            const core = part.slice(leading.length, part.length - trailing.length);

            if (!core) return part;

            const isAllCaps = core.length > 1 && core === core.toUpperCase();
            const hasDigit = /\d/.test(core);
            if (isAllCaps || hasDigit) return part;

            const lower = core.toLowerCase();
            const isStop = index > 0 && index < total - 1 && STOP_WORDS.has(lower);
            const cased = isStop ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);

            return `${leading}${cased}${trailing}`;
        })
        .join(' ');
}

function normalizeKeyword(raw: string): string {
    const trimmed = normalizeWhitespace(raw);
    if (!trimmed) return '';
    return standardizeCase(trimmed);
}

export type KeywordRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

export function recognizeKeywords(input: string): KeywordRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    const quoteRe = /"([^"]+?)"/g;
    let match: RegExpExecArray | null;

    while ((match = quoteRe.exec(input)) !== null) {
        const raw = match[1];
        const cleaned = normalizeKeyword(raw);
        if (!cleaned) continue;

        const start = match.index;
        const end = start + match[0].length;
        const token: ParsedToken = {
            id: genId(),
            type: 'keyword',
            value: cleaned,
            display: cleaned,
        };

        suggestions.push({
            id: genId(),
            trigger: match[0],
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: cleaned,
        });
        consumed.push([start, end]);
    }

    return { tokens, suggestions, consumed };
}
