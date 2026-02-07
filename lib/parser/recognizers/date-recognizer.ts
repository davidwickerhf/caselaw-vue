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

    const monthMap: Record<string, number> = {
        jan: 1,
        january: 1,
        januari: 1,
        feb: 2,
        february: 2,
        februari: 2,
        mar: 3,
        march: 3,
        mrt: 3,
        maart: 3,
        apr: 4,
        april: 4,
        may: 5,
        mei: 5,
        jun: 6,
        june: 6,
        juni: 6,
        jul: 7,
        july: 7,
        juli: 7,
        aug: 8,
        august: 8,
        augustus: 8,
        sep: 9,
        sept: 9,
        september: 9,
        oct: 10,
        october: 10,
        okt: 10,
        oktober: 10,
        nov: 11,
        november: 11,
        dec: 12,
        december: 12,
    };

    const normalizeYear = (year: string) => year;

    const makeDateToken = (year: string, display: string, type: ParsedToken['type'] = 'year'): ParsedToken => ({
        id: genId(),
        type,
        value: normalizeYear(year),
        display,
    });

    const toDisplayDate = (day: string, month: string, year: string) => {
        const monthName = month.charAt(0).toUpperCase() + month.slice(1);
        return `${day} ${monthName} ${year}`;
    };

    const addSpan = (start: number, end: number) => {
        consumed.push([start, end]);
    };

    // 1. Year ranges: "2015-2020", "2015 to 2020", "2015 tot 2020"
    const rangeRe = /\b(19\d{2}|20\d{2})\s*(?:[-–]|to|until|through|tot|t\/m|t\-m|tot\s+en\s+met)\s*(19\d{2}|20\d{2})\b/gi;
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

    // 2. "between" year ranges: "between 2014 and 2016", "tussen 2014 en 2016"
    const betweenYearRe = /\b(?:between|tussen)\s+(19\d{2}|20\d{2})\s+(?:and|en)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = betweenYearRe.exec(input)) !== null) {
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

    // 3. Full date ranges: "from 12 March 2014 to 5 May 2016", "12 maart 2020 tot 5 mei 2021"
    const fullRangeRe = /\b(?:(?:from|van|vanaf)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(19\d{2}|20\d{2})\s+(?:to|until|through|tot|t\/m|t\-m|tot\s+en\s+met|-)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = fullRangeRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const startYear = match[3];
        const endYear = match[6];
        const startToken: ParsedToken = {
            id: genId(),
            type: 'date_start',
            value: normalizeYear(startYear),
            display: `From ${toDisplayDate(match[1], match[2], startYear)}`,
        };
        const endToken: ParsedToken = {
            id: genId(),
            type: 'date_end',
            value: normalizeYear(endYear),
            display: `To ${toDisplayDate(match[4], match[5], endYear)}`,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token: startToken,
            tokens: [startToken, endToken],
            preview: `${startYear}-${endYear}`,
        });
        addSpan(start, end);
    }

    // 4. "between" full date ranges: "tussen 12 maart 2020 en 5 mei 2021"
    const betweenDateRe = /\b(?:between|tussen)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(19\d{2}|20\d{2})\s+(?:and|en)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = betweenDateRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const startYear = match[3];
        const endYear = match[6];
        const startToken: ParsedToken = {
            id: genId(),
            type: 'date_start',
            value: `${startYear}-01-01`,
            display: `From ${toDisplayDate(match[1], match[2], startYear)}`,
        };
        const endToken: ParsedToken = {
            id: genId(),
            type: 'date_end',
            value: `${endYear}-12-31`,
            display: `To ${toDisplayDate(match[4], match[5], endYear)}`,
        };
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token: startToken,
            tokens: [startToken, endToken],
            preview: `${startYear}-${endYear}`,
        });
        addSpan(start, end);
    }

    // 5. ISO-style dates (YYYY-MM-DD, DD-MM-YYYY, YYYY/MM/DD)
    const isoDateRe = /\b(19\d{2}|20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g;
    while ((match = isoDateRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const year = match[1];
        const token = makeDateToken(year, `On ${match[0]}`, 'year');
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        addSpan(start, end);
    }

    const slashDateRe = /\b(\d{1,2})[/-](\d{1,2})[/-](19\d{2}|20\d{2})\b/g;
    while ((match = slashDateRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const year = match[3];
        const token = makeDateToken(year, `On ${match[0]}`, 'year');
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        addSpan(start, end);
    }

    // 4. Month name dates: "12 March 2020", "March 12 2020"
    const monthDateRe = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(19\d{2}|20\d{2})\b/g;
    while ((match = monthDateRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const year = match[3];
        const monthKey = match[2].toLowerCase();
        if (!monthMap[monthKey]) continue;
        const token = makeDateToken(year, `On ${toDisplayDate(match[1], match[2], year)}`, 'year');
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        addSpan(start, end);
    }

    const monthFirstRe = /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(19\d{2}|20\d{2})\b/g;
    while ((match = monthFirstRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const year = match[3];
        const monthKey = match[1].toLowerCase();
        if (!monthMap[monthKey]) continue;
        const token = makeDateToken(year, `On ${toDisplayDate(match[2], match[1], year)}`, 'year');
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        addSpan(start, end);
    }

    // 5. Month + year: "March 2020"
    const monthYearRe = /\b([A-Za-z]+)\s+(19\d{2}|20\d{2})\b/gi;
    while ((match = monthYearRe.exec(input)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const monthKey = match[1].toLowerCase();
        if (!monthMap[monthKey]) continue;
        const year = match[2];
        const token = makeDateToken(year, `In ${match[1]} ${year}`, 'year');
        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `Year ${year}`,
        });
        addSpan(start, end);
    }

    // 6. Context-based years: "after 2015", "before 2020", "since 2018"
    const afterRe = /\b(?:after|since|from|vanaf|na|sinds)\s+(19\d{2}|20\d{2})\b/gi;
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

    const beforeRe = /\b(?:before|until|up\s+to|tot|t\/m|tot\s+en\s+met|voor)\s+(19\d{2}|20\d{2})\b/gi;
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

    // 7. Bare years (not already consumed)
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
