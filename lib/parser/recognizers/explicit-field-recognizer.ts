import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

type MatchSpec = {
    regex: RegExp;
    type: ParsedToken['type'];
    valueIndex: number;
    normalize?: (value: string, match: RegExpExecArray) => string;
    preview?: (value: string) => string;
};

const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/;

const SPECS: MatchSpec[] = [
    {
        regex: /\b(?:title|titel)\s*(?:is|equals|contains)?\s*"([^"]+?)"/gi,
        type: 'title',
        valueIndex: 1
    },
    {
        regex: /\b(?:language|lang|taal)\s*(?:is|equals)?\s*([A-Za-z]{3})\b/gi,
        type: 'language',
        valueIndex: 1,
        normalize: (value) => value.toUpperCase()
    },
    {
        regex: /\barticles?\s*(?:contains|equals)?\s*"([^"]+?)"/gi,
        type: 'articles',
        valueIndex: 1
    },
    {
        regex: /\bselected\s+laws?\s*(?:contains|equals)?\s*([A-Za-z0-9|]+)/gi,
        type: 'selected_laws',
        valueIndex: 1
    },
    {
        regex: /\bgeselecteerde\s+wetten?\s*(?:bevat|is|gelijk\s+aan)?\s*([A-Za-z0-9|]+)/gi,
        type: 'selected_laws',
        valueIndex: 1
    },
    {
        regex: /\bBWBX\d+\|\d+\b/gi,
        type: 'selected_laws',
        valueIndex: 0
    },
    {
        regex: /\b(?:date\s*start|start\s*date|date_start)\s*(?:is|equals)?\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_start_exact',
        valueIndex: 1,
        preview: (value) => `Date start ${value}`
    },
    {
        regex: /\b(?:date\s*start|start\s*date|date_start)\s*(?:after|from)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_start_exact',
        valueIndex: 1,
        preview: (value) => `Date start ${value}`
    },
    {
        regex: /\b(?:date\s*end|end\s*date|date_end)\s*(?:is|equals)?\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_end_exact',
        valueIndex: 1,
        preview: (value) => `Date end ${value}`
    },
    {
        regex: /\b(?:date\s*end|end\s*date|date_end)\s*(?:before|until|to)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_end_exact',
        valueIndex: 1,
        preview: (value) => `Date end ${value}`
    },
    {
        regex: /\bjudg(?:ment)?\s+date\s*(?:after|from)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_start',
        valueIndex: 1
    },
    {
        regex: /\b(?:arrest(?:datum)?|uitspraakdatum)\s*(?:na|vanaf)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_start',
        valueIndex: 1
    },
    {
        regex: /\bjudg(?:ment)?\s+date\s*(?:before|until|to)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_end',
        valueIndex: 1
    },
    {
        regex: /\b(?:arrest(?:datum)?|uitspraakdatum)\s*(?:voor|tot)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_end',
        valueIndex: 1
    },
    {
        regex: /\bjudg(?:ment)?\s+date\s*(?:is|equals|on)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_exact',
        valueIndex: 1
    },
    {
        regex: /\b(?:arrest(?:datum)?|uitspraakdatum)\s*(?:is|op)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_judgment_exact',
        valueIndex: 1
    },
    {
        regex: /\bdecision\s+date\s*(?:after|from)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_decision_start',
        valueIndex: 1
    },
    {
        regex: /\b(?:beslissingsdatum|besluitdatum)\s*(?:na|vanaf)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_decision_start',
        valueIndex: 1
    },
    {
        regex: /\bdecision\s+date\s*(?:before|until|to)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_decision_end',
        valueIndex: 1
    },
    {
        regex: /\b(?:beslissingsdatum|besluitdatum)\s*(?:voor|tot)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_decision_end',
        valueIndex: 1
    },
    {
        regex: /\bdecision\s+date\s*(?:is|equals|on)\s*(\d{4}-\d{2}-\d{2})\b/gi,
        type: 'date_decision_exact',
        valueIndex: 1
    }
];

export type ExplicitFieldRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

export function recognizeExplicitFields(input: string): ExplicitFieldRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    for (const spec of SPECS) {
        spec.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = spec.regex.exec(input)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
            const raw = match[spec.valueIndex] ?? '';
            if (!raw) continue;
            const normalized = spec.normalize ? spec.normalize(raw, match) : raw;
            if (spec.type.includes('date') && !ISO_DATE_RE.test(normalized)) continue;
            const token: ParsedToken = {
                id: genId(),
                type: spec.type as ParsedToken['type'],
                value: normalized,
                display: normalized
            };
            tokens.push(token);
            suggestions.push({
                id: genId(),
                trigger: match[0],
                triggerStart: start,
                triggerEnd: end,
                token,
                preview: spec.preview ? spec.preview(normalized) : normalized
            });
            consumed.push([start, end]);
        }
    }

    return { tokens, suggestions, consumed };
}
