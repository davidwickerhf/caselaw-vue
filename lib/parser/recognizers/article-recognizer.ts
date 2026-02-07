import { ECHR_ARTICLES } from '~/lib/utils/constants';
import type { ParsedToken, ParseSuggestion, ParsedTokenType } from '~/lib/types';

// Build lookup map from article numbers
const articleNumberSet = new Set(ECHR_ARTICLES.map((a) => a.number));

// Title alias map: keyword -> article number
const TITLE_ALIASES: Record<string, string> = {
    'torture': '3',
    'prohibition of torture': '3',
    'inhuman treatment': '3',
    'degrading treatment': '3',
    'right to life': '2',
    'life': '2',
    'slavery': '4',
    'forced labour': '4',
    'servitude': '4',
    'liberty': '5',
    'liberty and security': '5',
    'right to liberty': '5',
    'fair trial': '6',
    'right to a fair trial': '6',
    'due process': '6',
    'presumption of innocence': '6-2',
    'no punishment without law': '7',
    'nulla poena': '7',
    'privacy': '8',
    'private life': '8',
    'family life': '8',
    'private and family life': '8',
    'respect for private life': '8',
    'religion': '9',
    'conscience': '9',
    'freedom of thought': '9',
    'freedom of religion': '9',
    'expression': '10',
    'freedom of expression': '10',
    'free speech': '10',
    'freedom of speech': '10',
    'assembly': '11',
    'freedom of assembly': '11',
    'association': '11',
    'right to marry': '12',
    'marry': '12',
    'marriage': '12',
    'effective remedy': '13',
    'remedy': '13',
    'discrimination': '14',
    'prohibition of discrimination': '14',
    'non-discrimination': '14',
    'property': 'P1-1',
    'protection of property': 'P1-1',
    'possessions': 'P1-1',
    'education': 'P1-2',
    'right to education': 'P1-2',
    'elections': 'P1-3',
    'free elections': 'P1-3',
    'right to vote': 'P1-3',
    'movement': 'P4-2',
    'freedom of movement': 'P4-2',
    'expulsion': 'P4-4',
    'collective expulsion': 'P4-4',
    'death penalty': 'P6-1',
    'abolition of death penalty': 'P6-1',
    'double jeopardy': 'P7-4',
    'ne bis in idem': 'P7-4',
};

// Sort aliases longest-first for matching
const SORTED_ALIASES = Object.keys(TITLE_ALIASES).sort((a, b) => b.length - a.length);

// Regex for explicit article references: "article 3", "art. 6-1", "art 5-1-a", "P1-1"
const EXPLICIT_ARTICLE_RE = /\b(?:article|art\.?)\s*((?:P?\d+)(?:-\d+(?:-[a-z])?)?(?:\+(?:P?\d+)(?:-\d+(?:-[a-z])?)?)*)\b/gi;
const PROTOCOL_ARTICLE_RE = /\b(P\d+-\d+(?:-\d+)?(?:-[a-z])?)\b/g;

// Context keywords for violation type
const VIOLATION_WORDS = ['violation', 'violated', 'breach', 'breached', 'infringement', 'infringed'];
const APPLIED_WORDS = ['applied', 'application', 'invoked', 'relied', 'applicable'];
const NON_VIOLATION_WORDS = ['no violation', 'non-violation', 'non-violated', 'not violated', 'no breach'];

function detectContext(input: string, matchStart: number, matchEnd: number): ParsedTokenType {
    const surroundingStart = Math.max(0, matchStart - 40);
    const surroundingEnd = Math.min(input.length, matchEnd + 40);
    const surrounding = input.slice(surroundingStart, surroundingEnd).toLowerCase();

    // Check non-violation first (more specific)
    for (const phrase of NON_VIOLATION_WORDS) {
        if (surrounding.includes(phrase)) return 'article_non_violated';
    }
    for (const word of VIOLATION_WORDS) {
        if (surrounding.includes(word)) return 'article_violated';
    }
    for (const word of APPLIED_WORDS) {
        if (surrounding.includes(word)) return 'article_applied';
    }
    // Default: article_applied
    return 'article_applied';
}

function getArticleTitle(num: string): string {
    const art = ECHR_ARTICLES.find((a) => a.number === num);
    return art ? art.title : `Article ${num}`;
}

function makeDisplay(num: string, type: ParsedTokenType): string {
    const kindLabel = type === 'article_violated' ? 'violated'
        : type === 'article_non_violated' ? 'non-violated'
        : 'applied';
    return `Art. ${num} · ${kindLabel}`;
}

function genId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export type ArticleRecognizerResult = {
    tokens: ParsedToken[];
    suggestions: ParseSuggestion[];
    consumed: [number, number][];
};

function expandTriggerWithContext(input: string, start: number, end: number): [number, number] {
    const after = input.slice(end);
    const contextRe = /^\s*(?:-|,)?\s*(?:no\s+violation|non-violation|non-violated|not\s+violated|violation|violated|breach|breached|applied|application|invoked)\b/i;
    const match = after.match(contextRe);
    if (match) {
        return [start, end + match[0].length];
    }
    return [start, end];
}

export function recognizeArticles(input: string): ArticleRecognizerResult {
    const tokens: ParsedToken[] = [];
    const suggestions: ParseSuggestion[] = [];
    const consumed: [number, number][] = [];

    // 1. Explicit article references (suggest)
    let match: RegExpExecArray | null;

    // Reset regex
    EXPLICIT_ARTICLE_RE.lastIndex = 0;
    while ((match = EXPLICIT_ARTICLE_RE.exec(input)) !== null) {
        const num = match[1];
        if (!articleNumberSet.has(num)) continue;

        const type = detectContext(input, match.index, match.index + match[0].length);
        const token: ParsedToken = {
            id: genId(),
            type,
            value: num,
            display: makeDisplay(num, type),
        };

        const baseStart = match.index;
        const baseEnd = match.index + match[0].length;
        const [triggerStart, triggerEnd] = expandTriggerWithContext(input, baseStart, baseEnd);

        suggestions.push({
            id: genId(),
            trigger: input.slice(triggerStart, triggerEnd),
            triggerStart,
            triggerEnd,
            token,
            preview: token.display,
        });
        consumed.push([triggerStart, triggerEnd]);
    }

    // 2. Standalone protocol references like P1-1 (not preceded by "article/art")
    PROTOCOL_ARTICLE_RE.lastIndex = 0;
    while ((match = PROTOCOL_ARTICLE_RE.exec(input)) !== null) {
        const num = match[1];
        if (!articleNumberSet.has(num)) continue;
        // Check not already consumed
        const start = match.index;
        const end = start + match[0].length;
        if (consumed.some(([cs, ce]) => start >= cs && end <= ce)) continue;

        const type = detectContext(input, start, end);
        const token: ParsedToken = {
            id: genId(),
            type,
            value: num,
            display: makeDisplay(num, type),
        };

        const [triggerStart, triggerEnd] = expandTriggerWithContext(input, start, end);
        suggestions.push({
            id: genId(),
            trigger: input.slice(triggerStart, triggerEnd),
            triggerStart,
            triggerEnd,
            token,
            preview: token.display,
        });
        consumed.push([triggerStart, triggerEnd]);
    }

    // 3. Title-based suggestions (require Tab to confirm)
    const lowerInput = input.toLowerCase();
    for (const alias of SORTED_ALIASES) {
        const idx = lowerInput.indexOf(alias);
        if (idx === -1) continue;

        const start = idx;
        const end = idx + alias.length;

        // Check not already consumed by an explicit article
        if (consumed.some(([cs, ce]) => (start >= cs && start < ce) || (end > cs && end <= ce))) continue;

        // Word boundary check
        if (start > 0 && /\w/.test(input[start - 1])) continue;
        if (end < input.length && /\w/.test(input[end])) continue;

        const articleNum = TITLE_ALIASES[alias];
        const type = detectContext(input, start, end);
        const token: ParsedToken = {
            id: genId(),
            type,
            value: articleNum,
            display: makeDisplay(articleNum, type),
        };

        suggestions.push({
            id: genId(),
            trigger: input.slice(start, end),
            triggerStart: start,
            triggerEnd: end,
            token,
            preview: `${getArticleTitle(articleNum)}`,
        });
        break; // Only show top suggestion
    }

    return { tokens, suggestions, consumed };
}
