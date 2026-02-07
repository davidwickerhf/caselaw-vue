import type { Citation, SearchQuery, SearchResult, SearchFacets, FacetItem } from '~/lib/types';
import { fetchEchrPage, fetchNetworkPage, getSearchableSources, MAX_PAGES } from '~/lib/api/client';
import { buildEffectiveEchrFilters, buildEffectiveRsFilters } from '~/lib/utils/search-scope';
import type { PageResult } from '~/lib/api/client';

/**
 * Compute a simple text-based relevance score for client-side sorting.
 */
function computeRelevanceScore(citation: Citation, query: SearchQuery): number {
	const isEchr = citation.source === 'HUDOC';
	const effectiveText = isEchr
		? buildEffectiveEchrFilters(query).text
		: buildEffectiveRsFilters(query).text;
	if (!effectiveText.trim()) return 0.5;
	const terms = effectiveText.toLowerCase().split(/\s+/).filter(Boolean);
	let score = 0;
	const searchableText = [
		citation.title || '',
		citation.summary,
		citation.ecli,
		citation.conclusion || '',
		...(citation.keywords || []),
		citation.respondent_state || '',
		citation.headnote || '',
		...(citation.article_violated || []).map((a) => `article ${a}`),
		...(citation.article_applied || []).map((a) => `article ${a}`)
	]
		.join(' ')
		.toLowerCase();

	for (const term of terms) {
		if (searchableText.includes(term)) {
			score += 1;
			if (citation.title?.toLowerCase().includes(term)) score += 0.5;
			if (citation.ecli.toLowerCase().includes(term)) score += 2;
		}
	}

	score = score / Math.max(terms.length, 1);

	// Boost by importance
	if (citation.importance === 1) score += 0.3;
	else if (citation.importance === 2) score += 0.15;

	// Boost by citation count
	score += Math.min(citation.nCited / 500, 0.2);

	return Math.min(score, 1);
}

/**
 * Sort results client-side.
 */
function sortCases(cases: Citation[], sortBy: string, sortDirection: string): Citation[] {
	const sorted = [...cases];
	sorted.sort((a, b) => {
		let cmp = 0;
		switch (sortBy) {
			case 'relevance':
				cmp = (b.relevanceScore || 0) - (a.relevanceScore || 0);
				break;
			case 'date': {
				const dateA = a.date || a.date_judgment || '';
				const dateB = b.date || b.date_judgment || '';
				cmp = dateA.localeCompare(dateB);
				break;
			}
			case 'citations':
				cmp = b.nCited - a.nCited;
				break;
			case 'importance':
				cmp = (a.importance || 4) - (b.importance || 4);
				break;
		}
		return sortDirection === 'asc' ? -cmp : cmp;
	});
	return sorted;
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
 * Apply client-side filters to narrow down results.
 */
function applyClientFilters(cases: Citation[], query: SearchQuery): Citation[] {
	const echrFilters = buildEffectiveEchrFilters(query);
	const rsFilters = buildEffectiveRsFilters(query);
	return cases.filter((c) => {
		const isEchr = c.source === 'HUDOC';
		const filters = isEchr ? echrFilters : rsFilters;

		// Source filter
		if (query.sources.length > 0) {
			const isECHR = c.source === 'HUDOC';
			const isRS = c.source === 'Rechtspraak';
			if (
				!query.sources.some(
					(s) =>
						(s === 'ECHR' && isECHR) ||
						(s === 'RS' && isRS)
				)
			) {
				return false;
			}
		}

		// Article violated filter
		if (isEchr) {
			// Article violated filter
			if (filters.articleViolated.length > 0) {
				if (
					!c.article_violated ||
					!filters.articleViolated.some((a) => c.article_violated!.includes(a))
				)
					return false;
			}

			// Respondent state filter
			if (filters.respondentState.length > 0) {
				if (!c.respondent_state || !filters.respondentState.includes(c.respondent_state))
					return false;
			}

			// Document type filter
			if (filters.documentType.length > 0) {
				if (!filters.documentType.includes(c.document_type)) return false;
			}

			// Importance filter
			if (filters.importance.length > 0) {
				if (c.importance === undefined || !filters.importance.includes(c.importance)) return false;
			}
		} else {
			// Document type filter (RS)
			if (filters.documentType.length > 0) {
				if (!filters.documentType.includes(c.document_type)) return false;
			}

			// Instance filter
			if (filters.instances.length > 0) {
				if (!filters.instances.includes(c.instance)) return false;
			}

			// Domain filter
			if (filters.domains.length > 0) {
				const citationDomains = c.domains && c.domains.length > 0 ? c.domains : c.domain ? [c.domain] : [];
				if (!filters.domains.some((d) => citationDomains.includes(d))) return false;
			}
		}

		return true;
	});
}

/**
 * Build a SearchResult from accumulated citations.
 */
function buildSearchResult(allCitations: Citation[], query: SearchQuery, loadingMore: boolean): SearchResult {
	// Apply client-side filters
	let filtered = applyClientFilters(allCitations, query);

	// Sort
	filtered = sortCases(filtered, query.sortBy, query.sortDirection);

	// Compute facets on the full filtered set
	const facets = computeFacets(filtered);

	const total = filtered.length;

	// Paginate
	const start = (query.page - 1) * query.pageSize;
	const pageResults = filtered.slice(start, start + query.pageSize);

	return {
		results: pageResults,
		total,
		page: query.page,
		pageSize: query.pageSize,
		facets,
		loadingMore
	};
}

function scoreCitations(citations: Citation[], query: SearchQuery): Citation[] {
	return citations.map((c) => ({
		...c,
		relevanceScore: computeRelevanceScore(c, query)
	}));
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
	onUpdate: (result: SearchResult) => void
): Promise<() => void> {
	const sources = getSearchableSources(query);
	let aborted = false;
	const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;

	if (!sources.echr && !sources.rs) {
		onUpdate(buildSearchResult([], query, false));
		return () => {};
	}

	// Phase 1: Fetch first page from each source concurrently
	type FirstPageEntry = { source: 'echr' | 'rs'; citations: Citation[]; nextCursor?: string };
	const firstPagePromises: Promise<FirstPageEntry>[] = [];

	if (sources.echr) {
		firstPagePromises.push(
			fetchEchrPage(query, pageSize, query.echrCursor)
				.then((r) => ({ source: 'echr' as const, citations: r.citations, nextCursor: r.nextCursor }))
				.catch((err) => {
					console.error('ECHR first page failed:', err);
					return { source: 'echr' as const, citations: [] as Citation[], nextCursor: undefined };
				})
		);
	}

	if (sources.rs) {
		firstPagePromises.push(
			fetchNetworkPage(query, pageSize, query.rsCursor)
				.then((r) => ({ source: 'rs' as const, citations: r.citations, nextCursor: r.nextCursor }))
				.catch((err) => {
					console.error('Network first page failed:', err);
					return { source: 'rs' as const, citations: [] as Citation[], nextCursor: undefined };
				})
		);
	}

	const firstPages = await Promise.all(firstPagePromises);
	if (aborted) return () => {};

	// Collect first-page results and cursors for background loading
	const allCitations: Citation[] = [];
	const pendingCursors: { source: 'echr' | 'rs'; cursor: string }[] = [];

	for (const entry of firstPages) {
		allCitations.push(...scoreCitations(entry.citations, query));
		if (entry.nextCursor) {
			pendingCursors.push({ source: entry.source, cursor: entry.nextCursor });
		}
	}

	// Show first-page results immediately
	const hasMore = pendingCursors.length > 0;
	onUpdate(buildSearchResult(allCitations, query, hasMore));

	if (!hasMore) {
		return () => {};
	}

	// Phase 2: Fetch remaining pages in the background
	const fetchRemaining = async () => {
		for (const pending of pendingCursors) {
			let cursor: string | undefined = pending.cursor;
			let pageCount = 1; // Already fetched page 1

			while (cursor && pageCount < MAX_PAGES && !aborted) {
				try {
					const result: PageResult = pending.source === 'echr'
						? await fetchEchrPage(query, pageSize, cursor)
						: await fetchNetworkPage(query, pageSize, cursor);

					if (aborted) return;

					allCitations.push(...scoreCitations(result.citations, query));
					cursor = result.nextCursor;
					pageCount++;

					// Check if we're still loading
					const thisSourceDone = !cursor || pageCount >= MAX_PAGES;
					const allDone = thisSourceDone && pendingCursors.every((p) =>
						p === pending ? thisSourceDone : p.cursor === undefined
					);

					onUpdate(buildSearchResult(allCitations, query, !allDone));
				} catch (err) {
					console.error(`${pending.source} page ${pageCount + 1} failed:`, err);
					break;
				}
			}
			// Mark this source as done
			pending.cursor = undefined as unknown as string;
		}

		// Final update: all loading complete
		if (!aborted) {
			onUpdate(buildSearchResult(allCitations, query, false));
		}
	};

	// Start background loading (don't await)
	fetchRemaining();

	// Return abort function
	return () => { aborted = true; };
}
