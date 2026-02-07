import type { Citation, SearchQuery, SearchResult, SearchFacets, FacetItem, QueryBuilderGroup, QueryBuilderRule } from '~/lib/types';
import { fetchCombinedPage, DEFAULT_PAGE_SIZE } from '~/lib/api/client';
import { searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query';

type FacetCounts = {
	sources: Map<string, number>;
	years: Map<string, number>;
	articles: Map<string, number>;
	respondentStates: Map<string, number>;
	documentTypes: Map<string, number>;
	importance: Map<string, number>;
	instances: Map<string, number>;
	domains: Map<string, number>;
};

function createFacetCounts(): FacetCounts {
	return {
		sources: new Map(),
		years: new Map(),
		articles: new Map(),
		respondentStates: new Map(),
		documentTypes: new Map(),
		importance: new Map(),
		instances: new Map(),
		domains: new Map()
	};
}

function incrementCount(map: Map<string, number>, value: string | number | undefined) {
	if (value === undefined || value === null) return;
	const key = String(value);
	if (!key) return;
	map.set(key, (map.get(key) || 0) + 1);
}

function incrementCountList(map: Map<string, number>, values: (string | number)[] | undefined) {
	if (!values) return;
	for (const value of values) {
		incrementCount(map, value);
	}
}

function addFacetCounts(counts: FacetCounts, cases: Citation[]) {
	for (const c of cases) {
		incrementCount(counts.sources, c.source);
		if (c.year > 0) incrementCount(counts.years, c.year);
		incrementCountList(counts.articles, c.article_violated);
		incrementCount(counts.respondentStates, c.respondent_state);
		incrementCount(counts.documentTypes, c.document_type);
		incrementCount(counts.importance, c.importance);
		if (c.instance) incrementCount(counts.instances, c.instance);
		if (c.domains && c.domains.length > 0) {
			incrementCountList(counts.domains, c.domains);
		} else if (c.domain) {
			incrementCount(counts.domains, c.domain);
		}
	}
}

const CLIENT_ONLY_FIELDS = new Set(['article_violated', 'article_applied', 'article_non_violated']);

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

function countsToFacets(counts: FacetCounts): SearchFacets {
	const mapToFacet = (map: Map<string, number>): FacetItem[] =>
		Array.from(map.entries())
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => b.count - a.count);

	return {
		sources: mapToFacet(counts.sources),
		years: mapToFacet(counts.years),
		articles: mapToFacet(counts.articles),
		respondentStates: mapToFacet(counts.respondentStates),
		documentTypes: mapToFacet(counts.documentTypes),
		importance: mapToFacet(counts.importance),
		instances: mapToFacet(counts.instances),
		domains: mapToFacet(counts.domains)
	};
}

/**
 * Compute facets from the full result set.
 */
function computeFacets(cases: Citation[]): SearchFacets {
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
		respondentStates: facetMap((c) => c.respondent_state),
		documentTypes: facetMap((c) => c.document_type),
		importance: facetMap((c) => c.importance),
		instances: facetMap((c) => (c.instance ? c.instance : undefined)),
		domains: facetMap((c) => {
			if (c.domains && c.domains.length > 0) return c.domains;
			if (c.domain) return c.domain;
			return undefined;
		})
	};
}

/**
 * Build a SearchResult from accumulated citations.
 */
function buildSearchResult(
	citations: Citation[],
	query: SearchQuery,
	opts: { nextCursor?: string; total?: number; totalIsExact?: boolean; loadingMore?: boolean; facets?: SearchFacets }
): SearchResult {
	const facets = opts.facets ?? computeFacets(citations);
	const total = opts.total ?? (query.page - 1) * query.pageSize + citations.length;
	const totalIsExact = opts.totalIsExact ?? false;

	return {
		results: citations,
		total,
		totalIsExact,
		page: query.page,
		pageSize: query.pageSize,
		facets,
		nextCursor: opts.nextCursor,
		loadingMore: opts.loadingMore
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
	seed?: { facets: SearchFacets; total: number; totalIsExact: boolean }
): Promise<() => void> {
	const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;
	const group = query.queryBuilderGroup || searchQueryToQueryBuilderGroup(query);
	const { serverGroup, clientRules } = splitClientFilters(group);
	const clientFiltering = clientRules.length > 0;
	const effectiveGroup = (serverGroup.rules.length === 0 && serverGroup.groups.length === 0)
		? {
			...serverGroup,
			rules: [{ id: 'source-any', field: 'source', operator: 'equals', value: 'ANY', sourceScope: 'ANY' }],
			groups: []
		}
		: serverGroup;
	let cancelled = false;
	if (!hasRules(group)) {
		onUpdate(buildSearchResult([], query, { total: 0, totalIsExact: true, facets: computeFacets([]) }));
		return () => {};
	}

	const initialCursor = clientFiltering ? undefined : query.cursor;
	const result = await fetchCombinedPage(query, effectiveGroup, pageSize, initialCursor);
	if (cancelled) return () => {};

	if (!clientFiltering && query.page > 1 && seed) {
		onUpdate(
			buildSearchResult(result.citations, query, {
				nextCursor: result.nextCursor,
				total: seed.total,
				totalIsExact: seed.totalIsExact,
				facets: seed.facets
			})
		);
		return () => {
			cancelled = true;
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
					facets: computeFacets(filtered)
				})
			);
		};

		addPage(result.citations);
		updateFilteredResult(result.nextCursor);

		let cursor = result.nextCursor;
		while (cursor && !cancelled) {
			const pageResult = await fetchCombinedPage(query, effectiveGroup, pageSize, cursor);
			addPage(pageResult.citations);
			cursor = pageResult.nextCursor;
			updateFilteredResult(cursor);
		}

		if (!cancelled) {
			updateFilteredResult(undefined);
		}

		return () => {
			cancelled = true;
		};
	}

	const facetCounts = createFacetCounts();
	addFacetCounts(facetCounts, result.citations);

	const hasMore = !!result.nextCursor;
	const baseTotal = (query.page - 1) * pageSize + result.citations.length;
	const exactFromBackend = result.totalIsExact === true;
	const total = exactFromBackend ? (result.total ?? baseTotal) : baseTotal;
	const totalIsExact = exactFromBackend || (!hasMore && result.total === undefined);

	onUpdate(
		buildSearchResult(result.citations, query, {
			nextCursor: result.nextCursor,
			total,
			totalIsExact,
			loadingMore: hasMore,
			facets: countsToFacets(facetCounts)
		})
	);

	if (query.page === 1 && !query.cursor && hasMore) {
		let count = result.citations.length;
		let cursor = result.nextCursor;
		while (cursor && !cancelled) {
			const pageResult = await fetchCombinedPage(query, effectiveGroup, pageSize, cursor);
			count += pageResult.citations.length;
			addFacetCounts(facetCounts, pageResult.citations);
			cursor = pageResult.nextCursor;
			onUpdate(
				buildSearchResult(result.citations, query, {
					nextCursor: result.nextCursor,
					total: exactFromBackend ? total : count,
					totalIsExact: exactFromBackend,
					loadingMore: true,
					facets: countsToFacets(facetCounts)
				})
			);
		}
		if (!cancelled) {
			onUpdate(
				buildSearchResult(result.citations, query, {
					nextCursor: result.nextCursor,
					total: exactFromBackend ? total : count,
					totalIsExact: true,
					loadingMore: false,
					facets: countsToFacets(facetCounts)
				})
			);
		}
	}

	return () => {
		cancelled = true;
	};
}
