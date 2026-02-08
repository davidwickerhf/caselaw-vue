import type { QueryBuilderGroup, QueryBuilderRule, ParsedToken, ParseSuggestion, SourceScope } from '~/lib/types';
import { parseSearchInput } from '~/lib/parser/search-parser';
import { tokenToRule } from '~/lib/parser/query-builder-mapper';
import { isFieldAllowed, QUERY_BUILDER_FIELDS_BY_SCOPE, QUERY_BUILDER_OPERATORS } from '~/lib/utils/query-builder-config';

type PositionedRule = {
    rule: QueryBuilderRule;
    start: number;
    end: number;
};

type PositionedGroup = {
    group: QueryBuilderGroup;
    start: number;
    end: number;
};

type Term = {
    kind: 'rule' | 'group';
    rule?: QueryBuilderRule;
    group?: QueryBuilderGroup;
    start: number;
    end: number;
    negated: boolean;
};

const NEGATION_WORD_RE = /\b(?:not|without|excluding|exclude|except|minus|niet|zonder|uitsluiten|uitgesloten|behalve|behoudens|geen|noch)\b/i;
const OR_WORD_RE = /\b(?:or|either|of|ofwel|dan\s+wel|wel\s+of)\b/i;
const AND_WORD_RE = /\b(?:and|with|plus|en|met|alsook|evenals|samen\s+met)\b/i;
const ECHR_SCOPE_RE = /\b(?:echr|hudoc|ehrm|europees\s+hof|hof\s+voor\s+de\s+rechten\s+van\s+de\s+mens|mensenrechtenhof|mensenrechten|strasbourg)\b/i;
const RS_SCOPE_RE = /\b(?:rs|rechtspraak|rechtspraak\.nl|nederlandse\s+rechtspraak)\b/i;
const EXPLICIT_SCOPE_LABEL_RE = /(^|\s|\()(any|echr|rechtspraak)\s*:/gi;
const PREVIEW_SCOPE_LABEL_RE = /(^|\s|\()(Any|ECHR|Rechtspraak)\s*:/i;

const NOT_EQUALS_FIELDS = new Set(['respondent_state', 'source']);
const NOT_CONTAINS_FIELDS = new Set([
    'text',
    'title',
    'ecli',
    'keywords',
    'article_violated',
    'article_applied',
    'article_non_violated'
]);

const PREVIEW_SCOPE_LABELS: Record<string, SourceScope> = {
    any: 'ANY',
    echr: 'ECHR',
    rechtspraak: 'RS'
};

const FIELD_LABELS = Object.values(QUERY_BUILDER_FIELDS_BY_SCOPE)
    .flat()
    .flatMap((field) => ([
        {
            label: field.label,
            labelLower: field.label.toLowerCase(),
            field: field.value
        },
        {
            label: field.value,
            labelLower: field.value.toLowerCase(),
            field: field.value
        }
    ]))
    .sort((a, b) => b.label.length - a.label.length);

const OP_LABELS_BY_FIELD: Record<string, { label: string; labelLower: string; value: string }[]> = Object.entries(QUERY_BUILDER_OPERATORS)
    .reduce((acc, [field, ops]) => {
        acc[field] = [...ops]
            .map((op) => ({ label: op.label, labelLower: op.label.toLowerCase(), value: op.value }))
            .sort((a, b) => b.label.length - a.label.length);
        return acc;
    }, {} as Record<string, { label: string; labelLower: string; value: string }[]>);

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function maskScopeLabels(input: string): string {
    return input.replace(EXPLICIT_SCOPE_LABEL_RE, (match) => ' '.repeat(match.length));
}

function removeSpans(input: string, spans: [number, number][]): string {
    const sorted = [...spans].sort((a, b) => b[0] - a[0]);
    let result = input;
    for (const [start, end] of sorted) {
        result = result.slice(0, start) + result.slice(end);
    }
    return normalizeWhitespace(result);
}

function findTopLevelParens(input: string): [number, number][] {
    const ranges: [number, number][] = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === '(') {
            if (depth === 0) start = i;
            depth += 1;
        } else if (ch === ')') {
            if (depth > 0) {
                depth -= 1;
                if (depth === 0 && start >= 0) {
                    ranges.push([start, i + 1]);
                    start = -1;
                }
            }
        }
    }
    return ranges;
}

function withinRange(ranges: [number, number][], start: number, end: number): boolean {
    return ranges.some(([rs, re]) => start >= rs && end <= re);
}

function detectConnector(text: string): 'AND' | 'OR' {
    if (OR_WORD_RE.test(text)) return 'OR';
    if (AND_WORD_RE.test(text)) return 'AND';
    return 'AND';
}

function detectNegation(text: string): boolean {
    return NEGATION_WORD_RE.test(text);
}

function detectScope(text: string): SourceScope | null {
    let explicitScope: SourceScope | null = null;
    let match: RegExpExecArray | null = null;
    while ((match = EXPLICIT_SCOPE_LABEL_RE.exec(text)) !== null) {
        const value = (match[2] || '').toLowerCase();
        explicitScope = value === 'any' ? 'ANY' : value === 'echr' ? 'ECHR' : 'RS';
    }
    EXPLICIT_SCOPE_LABEL_RE.lastIndex = 0;
    if (explicitScope) return explicitScope;
    if (ECHR_SCOPE_RE.test(text)) return 'ECHR';
    if (RS_SCOPE_RE.test(text)) return 'RS';
    return null;
}

function parsePreviewRuleText(text: string): QueryBuilderRule | null {
    const match = text.match(/^\s*(Any|ECHR|Rechtspraak)\s*:\s*(.+)$/i);
    if (!match) return null;
    const scopeLabel = match[1].toLowerCase();
    const scope = PREVIEW_SCOPE_LABELS[scopeLabel];
    if (!scope) return null;
    let rest = match[2].trim();
    const restLower = rest.toLowerCase();
    const fieldMatch = FIELD_LABELS.find((f) => restLower.startsWith(f.labelLower));
    if (!fieldMatch) return null;
    rest = rest.slice(fieldMatch.label.length).trim();
    const opOptions = OP_LABELS_BY_FIELD[fieldMatch.field] || [];
    const restOpLower = rest.toLowerCase();
    const opMatch = opOptions.find((op) => restOpLower.startsWith(op.labelLower));
    if (!opMatch) return null;
    rest = rest.slice(opMatch.label.length).trim();
    let value = rest.trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
        value = value.slice(1, -1);
    }
    return {
        id: genId(),
        field: fieldMatch.field,
        operator: opMatch.value,
        value,
        sourceScope: scope
    };
}

type PreviewToken =
    | { type: 'rule'; text: string }
    | { type: 'op'; value: 'AND' | 'OR' | 'NOT' }
    | { type: 'lparen' }
    | { type: 'rparen' };

const OP_WORDS: Array<'AND' | 'OR' | 'NOT'> = ['AND', 'OR', 'NOT'];

function matchOperatorAt(input: string, index: number): 'AND' | 'OR' | 'NOT' | null {
    const lower = input.toLowerCase();
    for (const word of OP_WORDS) {
        const w = word.toLowerCase();
        if (!lower.startsWith(w, index)) continue;
        const prev = index - 1;
        const next = index + w.length;
        if (prev >= 0 && !/\s|\(/.test(input[prev])) continue;
        if (next < input.length && !/\s|\)/.test(input[next])) continue;
        return word;
    }
    return null;
}

function tokenizePreview(input: string): PreviewToken[] {
    const tokens: PreviewToken[] = [];
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (/\s/.test(ch)) {
            i += 1;
            continue;
        }
        if (ch === '(') {
            tokens.push({ type: 'lparen' });
            i += 1;
            continue;
        }
        if (ch === ')') {
            tokens.push({ type: 'rparen' });
            i += 1;
            continue;
        }
        const op = matchOperatorAt(input, i);
        if (op) {
            tokens.push({ type: 'op', value: op });
            i += op.length;
            continue;
        }
        if (i > 0 && !/[\s(]/.test(input[i - 1])) {
            i += 1;
            continue;
        }
        const scopeMatch = input.slice(i).match(/^(Any|ECHR|Rechtspraak)\s*:/i);
        if (scopeMatch) {
            let j = i + scopeMatch[0].length;
            let inQuote = false;
            let depth = 0;
            for (; j < input.length; j += 1) {
                const c = input[j];
                if (c === '"') inQuote = !inQuote;
                if (inQuote) continue;
                if (c === '(') {
                    depth += 1;
                    continue;
                }
                if (c === ')') {
                    if (depth === 0) break;
                    depth -= 1;
                    continue;
                }
                if (depth === 0) {
                    const opAt = matchOperatorAt(input, j);
                    if (opAt) break;
                }
            }
            const ruleText = input.slice(i, j).trim();
            tokens.push({ type: 'rule', text: ruleText });
            i = j;
            continue;
        }
        i += 1;
    }
    return tokens;
}

function parsePreviewTokens(tokens: PreviewToken[], startIndex = 0): { group: QueryBuilderGroup | null; index: number } {
    const terms: Array<QueryBuilderRule | QueryBuilderGroup> = [];
    const ops: Array<'AND' | 'OR' | 'NOT'> = [];
    let i = startIndex;

    while (i < tokens.length) {
        const token = tokens[i];
        if (token.type === 'rparen') break;
        if (token.type === 'op') {
            ops.push(token.value);
            i += 1;
            continue;
        }
        if (token.type === 'lparen') {
            const inner = parsePreviewTokens(tokens, i + 1);
            if (!inner.group) return { group: null, index: tokens.length };
            terms.push(inner.group);
            i = inner.index + 1;
            continue;
        }
        if (token.type === 'rule') {
            const rule = parsePreviewRuleText(token.text);
            if (!rule) return { group: null, index: tokens.length };
            terms.push(rule);
            i += 1;
            continue;
        }
        i += 1;
    }

    if (terms.length === 0) return { group: null, index: i };

    let op: 'AND' | 'OR' | 'NOT' = 'AND';
    if (ops.length > 0) {
        const unique = Array.from(new Set(ops));
        op = unique.length === 1 ? unique[0] : 'AND';
    }

    const group: QueryBuilderGroup = {
        id: genId(),
        operator: op,
        rules: [],
        groups: []
    };
    for (const term of terms) {
        if ('field' in term) group.rules.push(term);
        else group.groups.push({ ...term, groups: [] });
    }
    return { group, index: i };
}

function parsePreviewStringToQueryBuilderGroup(input: string): QueryBuilderGroup | null {
    if (!PREVIEW_SCOPE_LABEL_RE.test(input)) return null;
    const tokens = tokenizePreview(input);
    if (tokens.length === 0) return null;
    const parsed = parsePreviewTokens(tokens, 0);
    if (!parsed.group) return null;
    return {
        ...parsed.group,
        groups: parsed.group.groups.map((g) => ({ ...g, groups: [] }))
    };
}

function applyScope(rule: QueryBuilderRule, scope: SourceScope | null): QueryBuilderRule {
    if (!scope) return rule;
    if (rule.field === 'document_type') {
        const value = String(rule.value || '').toUpperCase();
        if (scope === 'ECHR') {
            if (value === 'DEC') {
                return { ...rule, value: 'HEDEC', sourceScope: 'ECHR' };
            }
            if (value === 'OPI') return rule;
        }
        if (scope === 'RS' && value.startsWith('HE')) {
            return { ...rule, value: 'DEC', sourceScope: 'RS' };
        }
    }
    if (isFieldAllowed(scope, rule.field)) return { ...rule, sourceScope: scope };
    return rule;
}

function scopeFromSourceRule(rule: QueryBuilderRule): SourceScope | null {
    if (rule.field !== 'source') return null;
    const upper = rule.value.toUpperCase();
    if (upper === 'ECHR' || upper === 'HUDOC') return 'ECHR';
    if (upper === 'RS' || upper === 'RECHTSPRAAK') return 'RS';
    return null;
}

function applyNegation(rule: QueryBuilderRule): QueryBuilderRule | null {
    if (rule.operator === 'equals' && NOT_EQUALS_FIELDS.has(rule.field)) {
        return { ...rule, operator: 'not_equals' };
    }
    if (rule.operator === 'contains' && NOT_CONTAINS_FIELDS.has(rule.field)) {
        return { ...rule, operator: 'not_contains' };
    }
    if (rule.operator === 'equals' && NOT_CONTAINS_FIELDS.has(rule.field)) {
        return { ...rule, operator: 'not_contains' };
    }
    return null;
}

function buildGroup(operator: 'AND' | 'OR' | 'NOT', rules: QueryBuilderRule[]): QueryBuilderGroup {
    return {
        id: genId(),
        operator,
        rules,
        groups: []
    };
}

function parseSuggestionsToRules(suggestions: ParseSuggestion[]): PositionedRule[] {
    const rules: PositionedRule[] = [];
    for (const suggestion of suggestions) {
        const tokens = suggestion.tokens && suggestion.tokens.length > 0 ? suggestion.tokens : [suggestion.token];
        for (const token of tokens) {
            const rule = tokenToRule(token as ParsedToken);
            if (!rule) continue;
            rules.push({
                rule,
                start: suggestion.triggerStart,
                end: suggestion.triggerEnd
            });
        }
    }
    return rules.sort((a, b) => a.start - b.start);
}

function parseGroupFromText(input: string): QueryBuilderGroup {
    const maskedInput = maskScopeLabels(input);
    const result = parseSearchInput(maskedInput);
    const rules = parseSuggestionsToRules(result.suggestions);
    const suggestionSpans = result.suggestions.map((s) => [s.triggerStart, s.triggerEnd] as [number, number]);
    const remaining = removeSpans(input, suggestionSpans);

    const terms: Term[] = [];
    let prevEnd = 0;
    for (const rule of rules) {
        const between = input.slice(prevEnd, rule.start);
        const negated = detectNegation(between);
        const scopedRule = applyScope(rule.rule, detectScope(between));
        terms.push({ kind: 'rule', rule: scopedRule, start: rule.start, end: rule.end, negated });
        prevEnd = rule.end;
    }

    const segments: Term[][] = [];
    let current: Term[] = [];
    prevEnd = 0;
    for (let i = 0; i < terms.length; i++) {
        const term = terms[i];
        if (i > 0) {
            const between = input.slice(prevEnd, term.start);
            const connector = detectConnector(between);
            if (connector === 'OR') {
                segments.push(current);
                current = [];
            }
        }
        current.push(term);
        prevEnd = term.end;
    }
    if (current.length) segments.push(current);

    const root: QueryBuilderGroup = {
        id: genId(),
        operator: segments.length > 1 ? 'OR' : 'AND',
        rules: [],
        groups: []
    };


    for (const segment of segments) {
        const segmentRules: QueryBuilderRule[] = [];
        for (const term of segment) {
            if (!term.rule) continue;
            let nextRule = term.rule;
            if (term.negated) {
                const negatedRule = applyNegation(nextRule);
                if (negatedRule) {
                    nextRule = negatedRule;
                } else {
                    root.groups.push(buildGroup('NOT', [nextRule]));
                    continue;
                }
            }
            segmentRules.push(nextRule);
        }

        if (segments.length > 1) {
            if (segmentRules.length === 1) {
                root.rules.push(segmentRules[0]);
            } else if (segmentRules.length > 1) {
                root.groups.push(buildGroup('AND', segmentRules));
            }
        } else {
            root.rules.push(...segmentRules);
        }
    }

    if (root.rules.length === 0 && root.groups.length === 0) {
        root.rules.push({
            id: genId(),
            field: 'text',
            operator: 'contains',
            value: '',
            sourceScope: 'ANY'
        });
    }

    return root;
}

export function parseNaturalLanguageToQueryBuilderGroup(input: string): QueryBuilderGroup {
    const previewGroup = parsePreviewStringToQueryBuilderGroup(input);
    if (previewGroup) {
        return previewGroup;
    }
    const trimmed = input.trim();
    if (!trimmed) {
        return {
            id: genId(),
            operator: 'AND',
            rules: [{ id: genId(), field: 'text', operator: 'contains', value: '', sourceScope: 'ANY' }],
            groups: []
        };
    }

    const parenRanges = findTopLevelParens(input);
    const parenGroups: PositionedGroup[] = parenRanges.map(([start, end]) => {
        const inner = input.slice(start + 1, end - 1);
        const group = parseGroupFromText(inner);
        return { group, start, end };
    });

    const maskedInput = maskScopeLabels(input);
    const result = parseSearchInput(maskedInput);
    const suggestions = result.suggestions.filter((s) => !withinRange(parenRanges, s.triggerStart, s.triggerEnd));
    const positionedRules = parseSuggestionsToRules(suggestions);

    const terms: Term[] = [];
    for (const rule of positionedRules) {
        terms.push({ kind: 'rule', rule: rule.rule, start: rule.start, end: rule.end, negated: false });
    }
    for (const group of parenGroups) {
        terms.push({ kind: 'group', group: group.group, start: group.start, end: group.end, negated: false });
    }
    terms.sort((a, b) => a.start - b.start);

    const spans: [number, number][] = [
        ...suggestions.map((s) => [s.triggerStart, s.triggerEnd] as [number, number]),
        ...parenRanges
    ];

    const remaining = removeSpans(input, spans);

    if (terms.length === 0) {
        const group = parseGroupFromText(remaining);
        return group;
    }

    const connectors: ('AND' | 'OR')[] = [];
    const negations: boolean[] = [];
    const scopes: (SourceScope | null)[] = [];
    let prevEnd = 0;
    for (const term of terms) {
        const between = input.slice(prevEnd, term.start);
        if (connectors.length < terms.length) {
            connectors.push(detectConnector(between));
            negations.push(detectNegation(between));
            scopes.push(detectScope(between));
        }
        prevEnd = term.end;
    }

    const segments: Term[][] = [];
    let current: Term[] = [];
    let activeScope: SourceScope | null = null;
    for (let i = 0; i < terms.length; i++) {
        const term = { ...terms[i], negated: negations[i] || false };
        if (term.kind === 'rule' && term.rule) {
            const scopedRule = applyScope(term.rule, scopes[i] || null);
            const scopeFromRule = scopeFromSourceRule(scopedRule);
            if (scopes[i] === 'ANY') {
                activeScope = null;
            }
            if (scopeFromRule) {
                activeScope = scopeFromRule;
            }
            if (activeScope && scopedRule.field !== 'source') {
                term.rule = applyScope(scopedRule, activeScope);
            } else {
                term.rule = scopedRule;
            }
        }
        if (i > 0 && connectors[i] === 'OR') {
            segments.push(current);
            current = [];
        }
        current.push(term);
    }
    if (current.length) segments.push(current);

    const root: QueryBuilderGroup = {
        id: genId(),
        operator: segments.length > 1 ? 'OR' : 'AND',
        rules: [],
        groups: []
    };

    for (const segment of segments) {
        const segmentRules: QueryBuilderRule[] = [];
        for (const term of segment) {
            if (term.kind === 'group' && term.group) {
                if (term.negated) {
                    root.groups.push(buildGroup('NOT', term.group.rules));
                } else {
                    root.groups.push(term.group);
                }
                continue;
            }
            if (!term.rule) continue;
            let nextRule = term.rule;
            if (term.negated) {
                const negatedRule = applyNegation(nextRule);
                if (negatedRule) {
                    nextRule = negatedRule;
                } else {
                    root.groups.push(buildGroup('NOT', [nextRule]));
                    continue;
                }
            }
            segmentRules.push(nextRule);
        }

        if (segments.length > 1) {
            if (segmentRules.length === 1) {
                root.rules.push(segmentRules[0]);
            } else if (segmentRules.length > 1) {
                root.groups.push(buildGroup('AND', segmentRules));
            }
        } else {
            root.rules.push(...segmentRules);
        }
    }

    if (root.rules.length === 0 && root.groups.length === 0) {
        root.rules.push({
            id: genId(),
            field: 'text',
            operator: 'contains',
            value: '',
            sourceScope: 'ANY'
        });
    }

    // Ensure one-level groups (drop nested groups if any)
    root.groups = root.groups.map((g) => ({
        ...g,
        groups: []
    }));

    return root;
}
