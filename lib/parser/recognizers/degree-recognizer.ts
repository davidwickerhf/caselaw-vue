import type { ParsedToken, ParseSuggestion } from '~/lib/types';

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

const MAX_DEGREE = 5;

type DegreeSpec = {
    regex: RegExp;
    type: ParsedToken['type'];
    label: (value: number) => string;
};

const DEGREE_SPECS: DegreeSpec[] = [
    {
        regex: /\b(?:degrees?|degree)\s*(?:source|sources|from|out|outbound|outgoing)\s*(\d+)\b/gi,
        type: 'degree_source',
        label: (value) => `Breadth ${value}`
    },
    {
        regex: /\b(?:source|sources|out|outbound|outgoing)\s*(?:degrees?|degree|breadth|width)\s*(\d+)\b/gi,
        type: 'degree_source',
        label: (value) => `Breadth ${value}`
    },
    {
        regex: /\b(?:out[-\s]?degree|outdegree)\s*(\d+)\b/gi,
        type: 'degree_source',
        label: (value) => `Breadth ${value}`
    },
    {
        regex: /\b(?:breadth|width|span|spread)\s*(\d+)\b/gi,
        type: 'degree_source',
        label: (value) => `Breadth ${value}`
    },
    {
        regex: /\b(?:degrees?|degree)\s*(?:target|targets|to|in|incoming|inbound)\s*(\d+)\b/gi,
        type: 'degree_target',
        label: (value) => `Target degree ${value}`
    },
    {
        regex: /\b(?:target|targets|incoming|inbound|in)\s*(?:degrees?|degree)\s*(\d+)\b/gi,
        type: 'degree_target',
        label: (value) => `Target degree ${value}`
    },
    {
        regex: /\b(?:in[-\s]?degree|indegree)\s*(\d+)\b/gi,
        type: 'degree_target',
        label: (value) => `Target degree ${value}`
    },
    {
        regex: /\b(?:graph\s*)?(?:depth|distance|radius|reach|levels?|layers?)\s*(?:of\s*)?(\d+)\b/gi,
        type: 'degree_depth',
        label: (value) => `Depth ${value}`
    },
    {
        regex: /\b(\d+)\s*(?:hops?|steps?|levels?|layers?)\s*(?:away|out|deep)?\b/gi,
        type: 'degree_depth',
        label: (value) => `Depth ${value}`
    }
];

const SUBGRAPH_RE = /\bsubgraph(?:\s*(?:only|mode|on|true))?\b/gi;

export type DegreeRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

function normalizeDegree(raw: string): number | null {
    const num = Number(raw);
    if (!Number.isInteger(num)) return null;
    if (num < 0 || num > MAX_DEGREE) return null;
    return num;
}

export function recognizeDegrees(input: string): DegreeRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    for (const spec of DEGREE_SPECS) {
        spec.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = spec.regex.exec(input)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
            const valueRaw = match[1];
            const valueNum = normalizeDegree(valueRaw);
            if (valueNum === null) continue;
            const token: ParsedToken = {
                id: genId(),
                type: spec.type as ParsedToken['type'],
                value: String(valueNum),
                display: spec.label(valueNum)
            };
            tokens.push(token);
            suggestions.push({
                id: genId(),
                trigger: match[0],
                triggerStart: start,
                triggerEnd: end,
                token,
                preview: spec.label(valueNum)
            });
            consumed.push([start, end]);
        }
    }

    SUBGRAPH_RE.lastIndex = 0;
    let subMatch: RegExpExecArray | null;
    while ((subMatch = SUBGRAPH_RE.exec(input)) !== null) {
        const start = subMatch.index;
        const end = start + subMatch[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;
        const token: ParsedToken = {
            id: genId(),
            type: 'subgraph',
            value: 'true',
            display: 'Subgraph only'
        };
        tokens.push(token);
        suggestions.push({
            id: genId(),
            trigger: subMatch[0],
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: 'Subgraph only'
        });
        consumed.push([start, end]);
    }

    return { tokens, suggestions, consumed };
}
