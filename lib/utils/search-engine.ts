import type { Citation, SearchQuery, SearchResult, SearchFacets, FacetItem, QueryBuilderGroup } from '~/lib/types';
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
	let cancelled = false;
	if (!hasRules(group)) {
		onUpdate(buildSearchResult([], query, { total: 0, totalIsExact: true, facets: computeFacets([]) }));
		return () => {};
	}

	const result = await fetchCombinedPage(query, group, pageSize, query.cursor);
	if (cancelled) return () => {};

	if (query.page > 1 && seed) {
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
			const pageResult = await fetchCombinedPage(query, group, pageSize, cursor);
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
