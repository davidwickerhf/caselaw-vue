import type { Citation, SearchQuery, SearchResult, SearchFacets, FacetItem, QueryBuilderGroup, QueryBuilderRule } from '~/lib/types';
import { fetchCombinedPage, DEFAULT_PAGE_SIZE } from '~/lib/api/client';
import { searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query';

// Combined endpoint now supports article filters server-side, so keep client-only list empty.
const CLIENT_ONLY_FIELDS = new Set<string>();

function splitClientFilters(group: QueryBuilderGroup): { serverGroup: QueryBuilderGroup; clientRules: QueryBuilderRule[] } {
	const clientRules: QueryBuilderRule[] = [];

	const serverGroup: QueryBuilderGroup = {
		...group,
		rules: [],
		groups: []
	};

	for (const rule of group.rules) {
		if (CLIENT_ONLY_FIELDS.has(rule.field)) {
			clientRules.push(rule);
		} else {
			serverGroup.rules.push(rule);
		}
	}

	for (const sub of group.groups) {
		const serverRules: QueryBuilderRule[] = [];
		for (const rule of sub.rules) {
			if (CLIENT_ONLY_FIELDS.has(rule.field)) {
				clientRules.push(rule);
			} else {
				serverRules.push(rule);
			}
		}
		if (serverRules.length > 0) {
			serverGroup.groups.push({
				...sub,
				rules: serverRules,
				groups: []
			});
		}
	}

	return { serverGroup, clientRules };
}

function normalizeArticleValue(value: string): string {
	return value.trim().toUpperCase();
}

function matchesRule(list: string[] | undefined, rule: QueryBuilderRule): boolean {
	if (!list || list.length === 0) {
		return rule.operator === 'not_contains';
	}
	const target = normalizeArticleValue(rule.value || '');
	if (!target) return false;
	const normalized = list.map((item) => normalizeArticleValue(item));

	if (rule.operator === 'not_contains') {
		return !normalized.some((item) => item.includes(target));
	}

	if (rule.operator === 'contains') {
		return normalized.some((item) => item.includes(target));
	}

	return normalized.some((item) => item === target);
}

function applyClientFilters(citations: Citation[], rules: QueryBuilderRule[]): Citation[] {
	if (rules.length === 0) return citations;
	return citations.filter((citation) => {
		return rules.every((rule) => {
			switch (rule.field) {
				case 'article_violated':
					return matchesRule(citation.article_violated, rule);
				case 'article_applied':
					return matchesRule(citation.article_applied, rule);
				case 'article_non_violated':
					return matchesRule(citation.article_non_violated, rule);
				default:
					return true;
			}
		});
	});
}

/**
 * Compute facets from the full result set.
 */
export function computeFacets(cases: Citation[]): SearchFacets {
	const facetMap = <T extends string | number>(
		extractor: (c: Citation) => T | T[] | undefined
	): FacetItem[] => {
		const counts = new Map<string, number>();
		for (const c of cases) {
			const val = extractor(c);
			if (val === undefined || val === null) continue;
			const values = Array.isArray(val) ? val : [val];
			for (const v of values) {
				const key = String(v);
				if (!key) continue;
				counts.set(key, (counts.get(key) || 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count);
	};

	return {
		sources: facetMap((c) => c.source),
		years: facetMap((c) => (c.year > 0 ? c.year : undefined)),
		articles: facetMap((c) => c.article_violated),
		articlesApplied: facetMap((c) => c.article_applied),
		articlesNonViolated: facetMap((c) => c.article_non_violated),
		respondentStates: facetMap((c) => c.respondent_state),
		documentTypes: facetMap((c) => c.document_type),
		echrDocumentTypes: facetMap((c) => c.source === 'HUDOC' ? c.document_type : undefined),
		rsDocumentTypes: facetMap((c) => c.source === 'Rechtspraak' ? c.document_type : undefined),
		importance: facetMap((c) => c.importance),
		instances: facetMap((c) => (c.instance ? c.instance : undefined)),
		domains: facetMap((c) => {
			if (c.domains && c.domains.length > 0) return c.domains;
			if (c.domain) return c.domain;
			return undefined;
		}),
		originatingBodies: facetMap((c) => c.originating_body),
		languages: facetMap((c) => c.languages.length > 0 ? c.languages : undefined),
	};
}

/**
 * Map server-side facets (from /api/combined first-page response) to SearchFacets.
 */
export function mapServerFacets(
	raw: Record<string, Array<{ value: string | number; count: number }>>,
	totals?: { rsTotal?: number; echrTotal?: number }
): SearchFacets {
	const toFacetItems = (arr?: Array<{ value: string | number; count: number }>): FacetItem[] =>
		(arr || []).map(f => ({ value: String(f.value), count: f.count }));

	const rsCount = totals?.rsTotal ?? (raw.rs_source ? raw.rs_source.reduce((s, f) => s + f.count, 0) : 0);
	const echrCount = totals?.echrTotal ?? (raw.echr_document_type ? raw.echr_document_type.reduce((s, f) => s + f.count, 0) : 0);

	return {
		sources: [
			...(rsCount > 0 ? [{ value: 'Rechtspraak', count: rsCount }] : []),
			...(echrCount > 0 ? [{ value: 'HUDOC', count: echrCount }] : []),
		],
		years: [],
		articles: toFacetItems(raw.echr_article_violated),
		articlesApplied: toFacetItems(raw.echr_article_applied),
		articlesNonViolated: toFacetItems(raw.echr_article_non_violated),
		respondentStates: toFacetItems(raw.echr_respondent_state),
		documentTypes: (() => {
			const map = new Map<string, number>();
			const add = (items: Array<{ value: string | number; count: number }> | undefined) => {
				if (!items) return;
				for (const item of items) {
					const val = String(item.value);
					map.set(val, (map.get(val) || 0) + item.count);
				}
			};
			add(raw.rs_document_type);
			add(raw.echr_document_type);
			return Array.from(map.entries())
				.map(([value, count]) => ({ value, count }))
				.sort((a, b) => b.count - a.count);
		})(),
		echrDocumentTypes: toFacetItems(raw.echr_document_type),
		rsDocumentTypes: toFacetItems(raw.rs_document_type),
		importance: toFacetItems(raw.echr_importance),
		instances: toFacetItems(raw.rs_instance),
		domains: toFacetItems(raw.rs_domain),
		originatingBodies: toFacetItems(raw.echr_originating_body),
		languages: toFacetItems(raw.echr_language),
	};
}

/**
 * Build a SearchResult from accumulated citations.
 */
function buildSearchResult(
	citations: Citation[],
	query: SearchQuery,
	opts: {
		nextCursor?: string;
		total?: number;
		totalIsExact?: boolean;
		rsTotal?: number;
		echrTotal?: number;
		loadingMore?: boolean;
		facets?: SearchFacets;
		serverFacets?: Record<string, Array<{ value: string | number; count: number }>>;
	}
): SearchResult {
	const facets = opts.serverFacets
		? mapServerFacets(opts.serverFacets, { rsTotal: opts.rsTotal, echrTotal: opts.echrTotal })
		: (opts.facets ?? computeFacets(citations));
	const total = opts.total ?? (query.page - 1) * query.pageSize + citations.length;
	const totalIsExact = opts.totalIsExact ?? false;

	return {
		results: citations,
		total,
		totalIsExact,
		rsTotal: opts.rsTotal,
		echrTotal: opts.echrTotal,
		page: query.page,
		pageSize: query.pageSize,
		facets,
		nextCursor: opts.nextCursor,
		loadingMore: opts.loadingMore,
	};
}

function hasRules(group: QueryBuilderGroup): boolean {
	const rules = [...group.rules];
	for (const sub of group.groups) {
		rules.push(...sub.rules);
	}
	return rules.some((r) => String(r.value || '').trim().length > 0);
}

/**
 * Execute a search with progressive loading.
 *
 * Phase 1: Fetch the first page from each source concurrently, call onUpdate immediately.
 * Phase 2: Fetch remaining pages in the background, calling onUpdate as each arrives.
 *
 * Returns an abort function to cancel background loading (e.g. on new search).
 */
export async function executeSearch(
	query: SearchQuery,
	onUpdate: (result: SearchResult) => void,
	seed?: { facets: SearchFacets; total: number; totalIsExact: boolean },
	onAccumulated?: (payload: { all: Citation[]; complete: boolean }) => void,
	opts: { controller?: AbortController } = {}
): Promise<() => void> {
	const controller = opts.controller;
	const signal = controller?.signal;
	const makeAbortError = () => {
		const err = new Error('Aborted');
		(err as Error & { name: string }).name = 'AbortError';
		return err;
	};
	const ensureNotAborted = () => {
		if (signal?.aborted) throw makeAbortError();
	};
	const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
	const group = query.queryBuilderGroup || searchQueryToQueryBuilderGroup(query);
	const { serverGroup, clientRules } = splitClientFilters(group);
	const clientFiltering = clientRules.length > 0;
	const effectiveGroup = (serverGroup.rules.length === 0 && serverGroup.groups.length === 0)
		? {
			...serverGroup,
			rules: [{ id: 'source-any', field: 'source', operator: 'equals', value: 'ANY', sourceScope: 'ANY' as const }],
			groups: []
		}
		: serverGroup;
	let cancelled = false;
	const handleAbort = () => {
		cancelled = true;
	};
	if (signal) signal.addEventListener('abort', handleAbort);
	const cleanup = () => {
		if (signal) signal.removeEventListener('abort', handleAbort);
	};
	if (!hasRules(group)) {
		onUpdate(buildSearchResult([], query, { total: 0, totalIsExact: true, facets: computeFacets([]) }));
		cleanup();
		return () => { };
	}

	const initialCursor = clientFiltering ? undefined : query.cursor;
	try {
		ensureNotAborted();
		const result = await fetchCombinedPage(query, effectiveGroup, pageSize, initialCursor, signal);
		if (cancelled) {
			cleanup();
			return () => { };
		}
		if (!clientFiltering && query.page > 1 && seed) {
			onUpdate(
				buildSearchResult(result.citations, query, {
					nextCursor: result.nextCursor,
					total: seed.total,
					totalIsExact: seed.totalIsExact,
					facets: seed.facets,
				})
			);
			cleanup();
			return () => {
				cancelled = true;
				controller?.abort();
				cleanup();
			};
		}

		if (clientFiltering) {
			const seen = new Set<string>();
			const accumulated: Citation[] = [];

			const addPage = (page: Citation[]) => {
				for (const item of page) {
					if (seen.has(item.id)) continue;
					seen.add(item.id);
					accumulated.push(item);
				}
			};

			const updateFilteredResult = (nextCursor?: string) => {
				const filtered = applyClientFilters(accumulated, clientRules);
				const start = (query.page - 1) * pageSize;
				const pageSlice = filtered.slice(start, start + pageSize);
				const total = filtered.length;
				const totalIsExact = !nextCursor;
				const hasMore = total > query.page * pageSize || !!nextCursor;
				onUpdate(
					buildSearchResult(pageSlice, query, {
						nextCursor: hasMore ? 'client-more' : undefined,
						total,
						totalIsExact,
						loadingMore: !!nextCursor,
						facets: computeFacets(filtered),
					})
				);
				onAccumulated?.({ all: filtered, complete: !nextCursor });
			};

			addPage(result.citations);
			updateFilteredResult(result.nextCursor);

			let cursor = result.nextCursor;
			while (cursor && !cancelled) {
				ensureNotAborted();
				const pageResult = await fetchCombinedPage(query, effectiveGroup, pageSize, cursor, signal);
				addPage(pageResult.citations);
				cursor = pageResult.nextCursor;
				updateFilteredResult(cursor);
			}

			if (!cancelled) {
				updateFilteredResult(undefined);
			}

			cleanup();
			return () => {
				cancelled = true;
				controller?.abort();
				cleanup();
			};
		}

		const hasMore = !!result.nextCursor;
		const total = result.total ?? ((query.page - 1) * pageSize + result.citations.length);
		const totalIsExact = result.totalIsExact === true || (!hasMore && result.total === undefined);

		onUpdate(
			buildSearchResult(result.citations, query, {
				nextCursor: result.nextCursor,
				total,
				totalIsExact,
				rsTotal: result.rsTotal,
				echrTotal: result.echrTotal,
				serverFacets: result.facets,
			})
		);
		onAccumulated?.({ all: result.citations, complete: !hasMore });

		cleanup();
		return () => {
			cancelled = true;
			controller?.abort();
			cleanup();
		};
	} catch (err) {
		cleanup();
		if ((err as Error)?.name === 'AbortError') {
			return () => {
				cancelled = true;
				controller?.abort();
				cleanup();
			};
		}
		throw err;
	}
}
