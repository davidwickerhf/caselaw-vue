# Combined API Migration Guide — Frontend Changes Required

## Overview

The `/api/combined` backend has been significantly refactored. The frontend has already completed much of the migration (removing degree parameters, edge pagination, etc.), but several **new backend features are not yet consumed by the frontend**. This guide covers what's left to do.

### What's already done (no action needed)

- Degree parameters (`degreesSource`, `degreesTarget`, `isSubgraph`) removed from types, composables, UI, URL params, cache keys, and parser
- Edge pagination loop removed from `fetchCombinedPage()`
- `fetchExpandNode()` implemented in `lib/api/client.ts`
- `ExpandResult` type added
- `sortBy: "citations"` added to `SearchQuery` and sort UI
- `nCited` / `nCiting` fields on `Citation` type
- Client-side facet computation in `computeFacets()`
- Filter panel UI in `ResultFilters.vue`
- Sort by citations option in `ResultSort.vue`

### What still needs to change

The backend now returns **server-side totals, per-dataset breakdowns, and pre-computed facets** on the first page. The frontend currently ignores these and computes everything client-side by fetching all results in a background loop. This is inefficient and should be replaced.

---

## 1. Current Backend Response Shape

```json
{
  "nodes": [
    {
      "id": "ECLI:NL:HR:2020:...",
      "data": {
        "isResult": "True",
        "dataset": "RS",
        "relevanceScore": 0.87,
        "cites_count": 5,
        "cited_by_count": 12
      }
    },
    {
      "id": "ECLI:CE:ECHR:2020:...",
      "data": {
        "isResult": "True",
        "dataset": "ECHR",
        "relevanceScore": 0.82,
        "cites_count": 3,
        "cited_by_count": 8
      }
    }
  ],
  "pagination": {
    "pageSize": 20,
    "nextCursor": "eyJ...",
    "total": 1234,
    "rsTotal": 800,
    "echrTotal": 434
  },
  "facets": {
    "rs_document_type": [{"value": "Uitspraak", "count": 750}],
    "rs_domain": [{"value": "Strafrecht", "count": 200}],
    "rs_instance": [{"value": "Hoge Raad", "count": 100}],
    "echr_document_type": [{"value": "HEJUD", "count": 300}],
    "echr_respondent_state": [{"value": "TUR", "count": 50}],
    "echr_importance": [{"value": 1, "count": 40}],
    "echr_language": [{"value": "ENG", "count": 400}],
    "echr_article_violated": [{"value": "6", "count": 500}, {"value": "6-1", "count": 480}],
    "echr_article_applied": [{"value": "41", "count": 1200}, {"value": "35-1", "count": 900}],
    "echr_article_non_violated": [{"value": "6", "count": 50}]
  },
  "warnings": []
}
```

### Key points

- `pagination.total` — **exact** combined hit count (always available, every page)
- `pagination.rsTotal` / `echrTotal` — per-dataset breakdowns (always available)
- `facets` — **only on first page** (when no cursor is sent). Not included on subsequent pages.
- `nodes[].data.cites_count` / `cited_by_count` — pre-computed citation counts per node
- `sort.by` accepts `"date"`, `"relevance"`, or `"citations"`

### Facet keys returned

| Key | Dataset | Filter field | Description |
|-----|---------|-------------|-------------|
| `rs_document_type` | RS | `document_type` | Uitspraak, Conclusie, etc. |
| `rs_domain` | RS | `domain` | Legal domains (Strafrecht, Civiel recht, etc.) |
| `rs_instance` | RS | `instance` | Court instances (Hoge Raad, Rechtbank, etc.) |
| `rs_source` | RS | `source` | Data sources |
| `rs_jurisdiction_country` | RS | — | Jurisdiction countries |
| `echr_document_type` | ECHR | `document_type` | HUDOC document types (HEJUD, HEDEC, etc.) |
| `echr_respondent_state` | ECHR | `respondent_state` | ISO-3 country codes (TUR, GRC, etc.) |
| `echr_importance` | ECHR | `importance` | 1-4 importance levels |
| `echr_language` | ECHR | `language` | Language codes (ENG, FRE) |
| `echr_article_violated` | ECHR | `article_violated` | Per-article codes (e.g. "6", "6-1", "8") |
| `echr_article_applied` | ECHR | `article_applied` | Per-article codes (e.g. "41", "35-1", "13+3") |
| `echr_article_non_violated` | ECHR | `article_non_violated` | Per-article codes |

**Naming convention:** `{dataset}_{filter_field}`. Use the `Filter field` value as the `field` in a query builder rule with the appropriate `sourceScope`.

### `/api/combined/expand` (unchanged)

Single-node, degree-1 citation expansion. Already implemented in `fetchExpandNode()`.

```json
// Request:
{ "nodeId": "ECLI:CE:ECHR:1968:...", "degreesSource": 1, "degreesTarget": 1 }

// Response:
{ "nodeId": "...", "edges": [...], "expandedNodes": [...] }
```

---

## 2. Required Changes

### 2.1 `lib/api/client.ts` — Use server-side totals and facets

**Current behavior:** `fetchCombinedPage()` extracts `total` and `totalIsExact` from the response but ignores `rsTotal`, `echrTotal`, and `facets`. The `CombinedResponse` type is just `ApiNetworkResponse` and doesn't reflect the new pagination fields.

**Required changes:**

1. **Update `CombinedResponse` type** (line 11) — Replace the alias with a proper type:
   ```typescript
   type CombinedResponse = {
     nodes: ApiNode[];
     pagination: {
       pageSize: number;
       nextCursor: string | null;
       total: number;
       rsTotal: number;
       echrTotal: number;
     };
     facets?: Record<string, Array<{ value: string | number; count: number }>>;
     warnings: string[];
   };
   ```

2. **Update `PageResult` type** (lines 290-295) — Add the new fields:
   ```typescript
   export type PageResult = {
     citations: Citation[];
     nextCursor?: string;
     total?: number;
     totalIsExact?: boolean;  // Can be removed — totals are now always exact
     rsTotal?: number;
     echrTotal?: number;
     facets?: Record<string, Array<{ value: string | number; count: number }>>;
   };
   ```

3. **Update `fetchCombinedPage()`** (lines 320-382) — Extract and return the new fields:
   ```typescript
   // After parsing the response:
   return {
     citations,
     nextCursor: result.pagination?.nextCursor,
     total: result.pagination?.total,
     totalIsExact: true,  // Backend totals are always exact now
     rsTotal: result.pagination?.rsTotal,
     echrTotal: result.pagination?.echrTotal,
     facets: result.facets,  // Only present on first page
   };
   ```

4. **Use `cites_count` / `cited_by_count` from the API** — Currently, `nCiting` and `nCited` are computed from `cites.length` and `cited_by.length` arrays. The backend now provides pre-computed `cites_count` and `cited_by_count` on every node. These are more accurate because:
   - For ECHR: counts come from a trigger-maintained `echr_citation_counts` table (includes cross-dataset citations)
   - For RS: counts come from `len(cites)` / `len(cited_by)` in ES (same as current client-side computation)

   Update the citation extraction in `fetchCombinedPage()` to prefer `cites_count`/`cited_by_count` when available:
   ```typescript
   nCiting: data.cites_count ?? (data.cites?.length || 0),
   nCited: data.cited_by_count ?? (data.cited_by?.length || 0),
   ```

---

### 2.2 `lib/types/index.ts` — Add rsTotal/echrTotal to SearchResult

**Current state:** `SearchResult` has `total` and `facets` but no `rsTotal`/`echrTotal`.

**Required changes:**

1. **Update `SearchResult`** (lines 126-138) — Add per-dataset totals:
   ```typescript
   export type SearchResult = {
     results: Citation[];
     total: number;
     totalIsExact: boolean;
     rsTotal?: number;        // NEW
     echrTotal?: number;      // NEW
     page: number;
     pageSize: number;
     facets: SearchFacets;
     nextCursor?: string;
     loadingMore?: boolean;
     aiSummary?: string;
     relatedSearches?: string[];
     didYouMean?: string;
   };
   ```

2. **Update `SearchFacets`** (lines 140-149) — The backend now provides richer facets with per-dataset prefixed keys. Consider updating `SearchFacets` to accept the backend facet format directly, or map from the API format (`rs_domain`, `echr_respondent_state`, etc.) to the current internal format.

---

### 2.3 `lib/utils/search-engine.ts` — Use server-side facets instead of client-side computation

**Current behavior:** `computeFacets()` (lines 163-197) iterates over all fetched citations client-side to build facet counts. `executeSearch()` fetches all pages in a background loop to compute complete facets.

**This is the biggest performance win.** The backend now provides complete, pre-computed facets on the first page response. The client no longer needs to fetch all results just to populate filter panels.

**Required changes:**

1. **Update `buildSearchResult()`** (lines 202-227) — When server-side facets are available, use them instead of computing client-side:
   ```typescript
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
       facets?: SearchFacets;           // Client-side computed (fallback)
       serverFacets?: Record<string, Array<{ value: string | number; count: number }>>;  // From API
     }
   ): SearchResult {
     // Prefer server-side facets; fall back to client-side
     const facets = opts.serverFacets
       ? mapServerFacets(opts.serverFacets)
       : (opts.facets ?? computeFacets(citations));
     // ...
   }
   ```

2. **Add `mapServerFacets()` helper** — Converts backend facet format (`rs_domain`, `echr_respondent_state`, etc.) to the frontend `SearchFacets` structure. The mapping depends on how `SearchFacets` is structured. Example:
   ```typescript
   function mapServerFacets(
     raw: Record<string, Array<{ value: string | number; count: number }>>
   ): SearchFacets {
     return {
       sources: [
         ...(raw.rs_source || []).map(f => ({ value: f.value as string, count: f.count })),
       ],
       articlesViolated: (raw.echr_article_violated || []).map(f => ({
         value: f.value as string, count: f.count
       })),
       respondentStates: (raw.echr_respondent_state || []).map(f => ({
         value: f.value as string, count: f.count
       })),
       documentTypes: [
         ...(raw.rs_document_type || []),
         ...(raw.echr_document_type || []),
       ].map(f => ({ value: f.value as string, count: f.count })),
       importance: (raw.echr_importance || []).map(f => ({
         value: String(f.value), count: f.count
       })),
       // years: not provided by backend facets (range filter, not facetable)
       years: [],
       instances: (raw.rs_instance || []).map(f => ({
         value: f.value as string, count: f.count
       })),
       domains: (raw.rs_domain || []).map(f => ({
         value: f.value as string, count: f.count
       })),
     };
   }
   ```

3. **Remove or reduce the background fetch loop** — The first-page response now includes `pagination.total` (exact) and `facets` (complete). The background loop that fetches all pages to compute client-side facets and exact totals is no longer necessary. Either:
   - Remove the loop entirely (recommended)
   - Keep it only for features that genuinely need all results loaded (e.g., client-side filtering beyond what the backend supports)

---

### 2.4 `composables/useSearch.ts` — Expose rsTotal/echrTotal

**Current state:** `results` ref contains `total` but no per-dataset breakdowns.

**Required changes:**

1. Pass `rsTotal` and `echrTotal` through from `fetchCombinedPage()` to `buildSearchResult()` and into the `SearchResult` object.

2. Store server-side facets from the first page and use them for the initial facet display (instead of waiting for the background loop to complete).

---

### 2.5 `pages/results.vue` and `components/ResultStats.vue` — Show per-dataset totals

**Current state:** Shows "X results found" with a unified total.

**Optional enhancement:** Display per-dataset breakdown:
```
1,234 results (800 Rechtspraak + 434 ECHR)
```

This requires passing `rsTotal` and `echrTotal` from the search result to the stats component.

---

## 3. Migration Checklist

### Remaining work

- [ ] Update `CombinedResponse` type in `lib/api/client.ts` to match actual backend response shape
- [ ] Update `PageResult` type to include `rsTotal`, `echrTotal`, `facets`
- [ ] Update `fetchCombinedPage()` to extract and return `rsTotal`, `echrTotal`, `facets` from API response
- [ ] Use `cites_count`/`cited_by_count` from API instead of computing from array lengths
- [ ] Add `rsTotal`, `echrTotal` to `SearchResult` type
- [ ] Add `mapServerFacets()` function to convert backend facet format to `SearchFacets`
- [ ] Update `buildSearchResult()` to accept and prefer server-side facets
- [ ] Update `executeSearch()` to pass server-side facets from first page response
- [ ] Remove or reduce background fetch loop (no longer needed for totals/facets)
- [ ] (Optional) Update `ResultStats.vue` to show per-dataset breakdown (rsTotal/echrTotal)
- [ ] (Optional) Update `SearchFacets` type to include ECHR article facets (`article_applied`, `article_non_violated`)
- [ ] Run all tests and verify no regressions

### Already completed (no action needed)

- [x] Remove `degreesSource`, `degreesTarget`, `isSubgraph` from types, composables, UI
- [x] Remove edge pagination loop from `fetchCombinedPage()`
- [x] Remove degree UI controls from `QueryBuilder.vue`
- [x] Remove degree-recognizer from parser
- [x] Remove degree segments from query summary
- [x] Remove degree params from URL serialization and cache keys
- [x] Add `fetchExpandNode()` to API client
- [x] Add `ExpandResult` type
- [x] Add `sortBy: "citations"` to SearchQuery
- [x] Add citations sort option to ResultSort.vue
- [x] Add filter panel UI (`ResultFilters.vue`)

---

## 4. How the New Features Work

### Server-side totals

The first API response (and every subsequent page) includes exact total counts in `pagination`:

```typescript
const response = await fetchCombinedPage(query);
// response.pagination.total   → 1234  (combined)
// response.pagination.rsTotal →  800  (Rechtspraak only)
// response.pagination.echrTotal → 434 (ECHR only)
```

These totals are **exact** (not estimated) and consistent across all pages. The frontend no longer needs to accumulate results in a background loop to count totals.

### Server-side facets

Facets are **only returned on the first page** (when no cursor is sent). Cache them in the search state and use them to populate filter panels immediately.

```typescript
// First page:
const firstPage = await fetchCombinedPage(query);
if (firstPage.facets) {
  // Server-side facets are complete and accurate
  // No need to wait for background fetch loop
  const mappedFacets = mapServerFacets(firstPage.facets);
  updateFacets(mappedFacets);
}

// Subsequent pages (cursor):
const nextPage = await fetchCombinedPage(query, cursor);
// nextPage.facets is undefined — use stored facets from first page
```

### Citation counts from API

Every node now includes pre-computed `cites_count` and `cited_by_count`. Prefer these over computing from array lengths:

```typescript
// Old (client-side computation):
nCiting: data.cites?.length || 0,
nCited: data.cited_by?.length || 0,

// New (use pre-computed counts from API):
nCiting: data.cites_count ?? (data.cites?.length || 0),
nCited: data.cited_by_count ?? (data.cited_by?.length || 0),
```

### Facet-to-filter mapping

When a user clicks a facet value to filter, construct a query builder rule:

```typescript
// User clicks "TUR" in the echr_respondent_state facet:
const rule = {
  field: "respondent_state",        // from facet table "Filter field" column
  operator: "equals",
  value: "TUR",
  sourceScope: "ECHR"              // from facet key prefix
};
```

### Citations sort mode

Already implemented. The `"citations"` sort mode orders results by `cited_by_count` (most cited first):

```typescript
{ sort: { by: "citations", direction: "desc" } }
```

---

## 5. Typical Integration Flow

```
1. User enters search query
2. Client calls POST /api/combined → returns:
   - nodes (with cites_count + cited_by_count on each)
   - pagination.total / rsTotal / echrTotal (exact counts)
   - facets (first page only — use these to populate filter dropdowns)
3. UI immediately displays:
   - Results with citation counts
   - Total hit counts ("1,234 results (800 RS + 434 ECHR)")
   - Filter panels populated from server-side facets
4. User pages through results via cursor pagination
   - Totals stay consistent (carried in cursor)
   - Facets are NOT re-sent on subsequent pages (use first page facets)
5. User clicks on a specific case in the results
6. Client calls POST /api/combined/expand { nodeId, degreesSource: 1, degreesTarget: 1 }
   → returns edges + neighbour nodes for that single case
7. UI shows the expanded citations alongside the case detail
```

**Important:** The frontend no longer needs a background-fetch loop to accumulate all results. The first page response includes `pagination.total`, `rsTotal`, `echrTotal`, and `facets` — everything needed to render filter panels and result counts immediately.
