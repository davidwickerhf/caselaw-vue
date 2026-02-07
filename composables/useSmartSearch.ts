import { ref, computed } from 'vue';
import { parseSearchInput } from '~/lib/parser/search-parser';
import { tokensToSearchQuery } from '~/lib/parser/query-mapper';
import { tokensToQueryBuilderGroup } from '~/lib/parser/query-builder-mapper';
import { searchQueryToTokens, searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query';
import type { ParsedToken, ParseSuggestion, QueryBuilderGroup, SearchQuery } from '~/lib/types';

type SmartSegment =
	| { id: string; kind: 'text'; value: string }
	| { id: string; kind: 'token'; token: ParsedToken };

function genId(): string {
	return Math.random().toString(36).slice(2, 10);
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function segmentsToRawText(segments: SmartSegment[]): string {
	return segments
		.filter((seg) => seg.kind === 'text')
		.map((seg) => (seg.kind === 'text' ? seg.value : ''))
		.join('');
}

function normalizeSegments(segments: SmartSegment[]): SmartSegment[] {
	const normalized: SmartSegment[] = [];
	for (const seg of segments) {
		if (seg.kind === 'text') {
			if (seg.value === '') continue;
			const last = normalized[normalized.length - 1];
			if (last && last.kind === 'text') {
				last.value += seg.value;
			} else {
				normalized.push({ id: seg.id || genId(), kind: 'text', value: seg.value });
			}
		} else {
			normalized.push(seg);
		}
	}
	return normalized;
}

function insertTokensAtRange(
	segments: SmartSegment[],
	start: number,
	end: number,
	tokens: ParsedToken[]
): SmartSegment[] {
	let cursor = 0;
	let inserted = false;
	const result: SmartSegment[] = [];

	for (const seg of segments) {
		if (seg.kind === 'token') {
			result.push(seg);
			continue;
		}

		const text = seg.value;
		const segStart = cursor;
		const segEnd = cursor + text.length;

		if (end <= segStart || start >= segEnd) {
			result.push(seg);
		} else {
			const before = text.slice(0, Math.max(0, start - segStart));
			const after = text.slice(Math.max(0, end - segStart));
			if (before) {
				result.push({ id: genId(), kind: 'text', value: before });
			}
			if (!inserted) {
				for (const token of tokens) {
					result.push({ id: token.id, kind: 'token', token });
				}
				inserted = true;
			}
			if (after) {
				result.push({ id: genId(), kind: 'text', value: after });
			}
		}
		cursor = segEnd;
	}

	if (!inserted) {
		return normalizeSegments(segments);
	}

	return normalizeSegments(result);
}

function removeTextRange(segments: SmartSegment[], start: number, end: number): SmartSegment[] {
	let cursor = 0;
	const result: SmartSegment[] = [];

	for (const seg of segments) {
		if (seg.kind === 'token') {
			result.push(seg);
			continue;
		}

		const text = seg.value;
		const segStart = cursor;
		const segEnd = cursor + text.length;

		if (end <= segStart || start >= segEnd) {
			result.push(seg);
		} else {
			const before = text.slice(0, Math.max(0, start - segStart));
			const after = text.slice(Math.max(0, end - segStart));
			if (before) {
				result.push({ id: genId(), kind: 'text', value: before });
			}
			if (after) {
				result.push({ id: genId(), kind: 'text', value: after });
			}
		}
		cursor = segEnd;
	}

	return normalizeSegments(result);
}

// Module-level singleton state
const segments = ref<SmartSegment[]>([]);
const suggestions = ref<ParseSuggestion[]>([]);
const allSuggestions = ref<ParseSuggestion[]>([]);
const queryBuilderGroup = ref<QueryBuilderGroup>({
    id: 'root',
    operator: 'AND',
    rules: [{ id: 'default', field: 'text', operator: 'contains', value: '', sourceScope: 'ANY' }],
    groups: [],
});
const lastEditSource = ref<'searchbar' | 'querybuilder'>('searchbar');
const searchString = ref('');
const rejectedSuggestionKeys = new Set<string>();
const rejectedSuggestionTriggers = new Map<string, string>();
const lastWordCount = ref(0);

// Debounced parse
let parseTimer: ReturnType<typeof setTimeout> | null = null;

function runParse() {
    const text = segmentsToRawText(segments.value);
    if (!text.trim()) {
        suggestions.value = [];
        allSuggestions.value = [];
        syncQueryBuilder();
        return;
    }

    updateRejectedForText(text);

    const result = parseSearchInput(text);
    allSuggestions.value = result.suggestions;
    suggestions.value = result.suggestions.filter((s) => !rejectedSuggestionKeys.has(suggestionKey(s)));

    syncQueryBuilder();
}

function syncQueryBuilder() {
    if (lastEditSource.value === 'querybuilder') return;
    queryBuilderGroup.value = tokensToQueryBuilderGroup(
		segments.value.filter((seg) => seg.kind === 'token').map((seg) => (seg as { kind: 'token'; token: ParsedToken }).token),
		''
	);
}

function onSegmentsChange(nextSegments: SmartSegment[]) {
    segments.value = normalizeSegments(nextSegments);
    lastEditSource.value = 'searchbar';
    if (parseTimer) clearTimeout(parseTimer);
    parseTimer = setTimeout(runParse, 150);
}

function acceptSuggestion(suggestionId: string) {
    const suggestion = suggestions.value.find((s) => s.id === suggestionId);
    if (!suggestion) return;

	const tokens = suggestion.tokens && suggestion.tokens.length > 0 ? suggestion.tokens : [suggestion.token];
	segments.value = insertTokensAtRange(
		segments.value,
		suggestion.triggerStart,
		suggestion.triggerEnd,
		tokens
	);

    // Clear suggestions and re-parse
    suggestions.value = [];
    lastEditSource.value = 'searchbar';
	const text = segmentsToRawText(segments.value);
    if (text.trim()) {
        const result = parseSearchInput(text);
        allSuggestions.value = result.suggestions;
        suggestions.value = result.suggestions.filter((s) => !rejectedSuggestionKeys.has(suggestionKey(s)));
    }
    syncQueryBuilder();
}

function acceptAllSuggestions() {
    if (suggestions.value.length === 0) return;

    const sorted = [...suggestions.value].sort((a, b) =>
        a.triggerStart === b.triggerStart
            ? b.triggerEnd - a.triggerEnd
            : b.triggerStart - a.triggerStart
    );

    let nextSegments = segments.value;
    for (const suggestion of sorted) {
        const tokens = suggestion.tokens && suggestion.tokens.length > 0 ? suggestion.tokens : [suggestion.token];
        nextSegments = insertTokensAtRange(nextSegments, suggestion.triggerStart, suggestion.triggerEnd, tokens);
    }

    segments.value = nextSegments;
    suggestions.value = [];
    allSuggestions.value = [];
    lastEditSource.value = 'searchbar';

    const text = segmentsToRawText(segments.value);
    if (text.trim()) {
        const result = parseSearchInput(text);
        allSuggestions.value = result.suggestions;
        suggestions.value = result.suggestions.filter((s) => !rejectedSuggestionKeys.has(suggestionKey(s)));
    }
    syncQueryBuilder();
}

function rejectSuggestion(suggestionId: string) {
    const suggestion = allSuggestions.value.find((s) => s.id === suggestionId)
        || suggestions.value.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const key = suggestionKey(suggestion);
    rejectedSuggestionKeys.add(key);
    rejectedSuggestionTriggers.set(key, suggestion.trigger);

    const tokens = suggestion.tokens && suggestion.tokens.length > 0 ? suggestion.tokens : [suggestion.token];
    segments.value = removeTextRange(segments.value, suggestion.triggerStart, suggestion.triggerEnd);
    segments.value = removeTokensBySignature(segments.value, tokens);

    const text = segmentsToRawText(segments.value);
    if (text.trim()) {
        const result = parseSearchInput(text);
        allSuggestions.value = result.suggestions;
        suggestions.value = result.suggestions.filter((s) => !rejectedSuggestionKeys.has(suggestionKey(s)));
    } else {
        suggestions.value = [];
        allSuggestions.value = [];
    }
    syncQueryBuilder();
}

function removeToken(tokenId: string) {
    segments.value = segments.value.filter((seg) => !(seg.kind === 'token' && seg.token.id === tokenId));
    lastEditSource.value = 'searchbar';
    syncQueryBuilder();
}

function buildSearchQuery(): SearchQuery {
	const tokens = segments.value
		.filter((seg) => seg.kind === 'token')
		.map((seg) => (seg as { kind: 'token'; token: ParsedToken }).token);
    return tokensToSearchQuery(tokens, '');
}

function clearAll() {
    segments.value = [];
    suggestions.value = [];
    allSuggestions.value = [];
    rejectedSuggestionKeys.clear();
    rejectedSuggestionTriggers.clear();
    lastWordCount.value = 0;
    lastEditSource.value = 'searchbar';
    searchString.value = '';
    syncQueryBuilder();
}

function setFromText(text: string) {
    // Reset and parse fresh text (e.g., from history or example search)
    segments.value = text ? [{ id: genId(), kind: 'text', value: text }] : [];
    suggestions.value = [];
    allSuggestions.value = [];
    rejectedSuggestionKeys.clear();
    rejectedSuggestionTriggers.clear();
    lastWordCount.value = 0;
    lastEditSource.value = 'searchbar';
    runParse();
}

function setFromSearchQuery(query: SearchQuery) {
    const tokens = searchQueryToTokens(query);
    const nextSegments: SmartSegment[] = [];
    const combinedText = [query.text, query.scoped?.echr?.text || '', query.scoped?.rs?.text || '']
        .map((text) => text.trim())
        .filter(Boolean)
        .join(' ');
    if (combinedText) {
        nextSegments.push({ id: genId(), kind: 'text', value: combinedText + (tokens.length ? ' ' : '') });
    }
    tokens.forEach((token, idx) => {
        nextSegments.push({ id: token.id, kind: 'token', token });
        if (idx < tokens.length - 1) {
            nextSegments.push({ id: genId(), kind: 'text', value: ' ' });
        }
    });

    segments.value = normalizeSegments(nextSegments);
    queryBuilderGroup.value = searchQueryToQueryBuilderGroup(query);
    suggestions.value = [];
    allSuggestions.value = [];
    rejectedSuggestionKeys.clear();
    rejectedSuggestionTriggers.clear();
    lastWordCount.value = 0;
    lastEditSource.value = 'searchbar';
    searchString.value = '';
}

function onQueryBuilderEdit(group: QueryBuilderGroup) {
    lastEditSource.value = 'querybuilder';
    queryBuilderGroup.value = group;
}

function setSearchString(value: string) {
    searchString.value = normalizeWhitespace(value || '');
}

export function useSmartSearch() {
	const rawText = computed(() => segmentsToRawText(segments.value));
	const freeText = computed({
		get: () => normalizeWhitespace(rawText.value),
		set: (text: string) => {
			segments.value = text ? [{ id: genId(), kind: 'text', value: text }] : [];
		},
	});
	const confirmedTokens = computed(() =>
		segments.value
			.filter((seg) => seg.kind === 'token')
			.map((seg) => (seg as { kind: 'token'; token: ParsedToken }).token)
	);

    return {
        segments: computed(() => segments.value),
		rawText,
        confirmedTokens,
        freeText,
        searchString: computed(() => searchString.value),
        suggestions: computed(() => suggestions.value),
        queryBuilderGroup,
        lastEditSource,
        onSegmentsChange,
        acceptSuggestion,
        acceptAllSuggestions,
        rejectSuggestion,
        removeToken,
        buildSearchQuery,
        clearAll,
        setFromText,
        setFromSearchQuery,
        onQueryBuilderEdit,
        setSearchString,
    };
}

function suggestionKey(suggestion: ParseSuggestion): string {
	return `${suggestion.triggerStart}:${suggestion.triggerEnd}:${suggestion.token.type}:${suggestion.token.value}`;
}

function updateRejectedForText(text: string) {
	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
	if (wordCount > lastWordCount.value) {
		rejectedSuggestionKeys.clear();
		rejectedSuggestionTriggers.clear();
	}
	lastWordCount.value = wordCount;

	const lowerText = text.toLowerCase();
	for (const [key, trigger] of rejectedSuggestionTriggers.entries()) {
		if (!lowerText.includes(trigger.toLowerCase())) {
			rejectedSuggestionKeys.delete(key);
			rejectedSuggestionTriggers.delete(key);
		}
	}
}

function removeTokensBySignature(segments: SmartSegment[], tokens: ParsedToken[]): SmartSegment[] {
	return segments.filter((seg) => {
		if (seg.kind !== 'token') return true;
		return !tokens.some((t) => t.type === seg.token.type && t.value === seg.token.value);
	});
}
