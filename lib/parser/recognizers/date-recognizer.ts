import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export type DateRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

export function recognizeDates(input: string): DateRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    // 1. Year ranges: "2015-2020", "2015 to 2020"
    const rangeRe = /\b(19\d{2}|20\d{2})\s*(?:[-–]|to)\s*(19\d{2}|20\d{2})\b/gi;
    let match: RegExpExecArray | null;

    while ((match = rangeRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const yearStart = match[1];
        const yearEnd = match[2];

        const startToken: ParsedToken = {
            id: genId(),
            type: 'date_start',
            value: `${yearStart}-01-01`,
            display: `From ${yearStart}`,
        };
        const endToken: ParsedToken = {
            id: genId(),
            type: 'date_end',
            value: `${yearEnd}-12-31`,
            display: `To ${yearEnd}`,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token: startToken,
            tokens: [startToken, endToken],
            preview: `${yearStart}-${yearEnd}`,
        });
        consumed.push([start, end]);
    }

    // 2. Context-based years: "after 2015", "before 2020", "since 2018"
    const afterRe = /\b(?:after|since|from)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = afterRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const token: ParsedToken = {
            id: genId(),
            type: 'date_start',
            value: `${match[1]}-01-01`,
            display: `After ${match[1]}`,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: token.display,
        });
        consumed.push([start, end]);
    }

    const beforeRe = /\b(?:before|until|up\s+to)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = beforeRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const token: ParsedToken = {
            id: genId(),
            type: 'date_end',
            value: `${match[1]}-12-31`,
            display: `Before ${match[1]}`,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: token.display,
        });
        consumed.push([start, end]);
    }

    // 3. Bare years (not already consumed)
    const yearRe = /\b(19\d{2}|20\d{2})\b/g;
    while ((match = yearRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const year = match[1];
        const token: ParsedToken = {
            id: genId(),
            type: 'year',
            value: year,
            display: year,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        consumed.push([start, end]);
    }

    return { tokens, suggestions, consumed };
}
