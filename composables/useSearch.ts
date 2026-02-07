import { ref, computed } from 'vue'
import type { Citation, SearchQuery, SearchResult, SearchFacets } from '~/lib/types'
import { createDefaultSearchQuery } from '~/lib/types'
import { executeSearch, computeFacets } from '~/lib/utils/search-engine'
import { searchQueryToQueryBuilderGroup } from '~/lib/utils/search-query'

type CacheEntry = {
  results: Citation[]
  facets: SearchFacets
}

// Module-level singleton state so all components share the same instance
const query = ref<SearchQuery>(createDefaultSearchQuery())
const results = ref<SearchResult | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedResult = ref<Citation | null>(null)
const detailOpen = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const selectAllActive = ref(false)
const deselectedIds = ref<Set<string>>(new Set())
const cursorHistory = ref<Record<number, string | undefined>>({ 1: undefined })
const pageCache = ref<Record<string, Record<number, SearchResult>>>({})
const fullCache = ref<Record<string, CacheEntry>>({})
const isFullyLoaded = computed(() => !!fullCache.value[baseKey(query.value)])

// Abort function for cancelling background page loading on new searches
let abortBackground: (() => void) | null = null

function resolveGroup(q: SearchQuery) {
  return q.queryBuilderGroup || searchQueryToQueryBuilderGroup(q)
}

function serializeGroup(group: SearchQuery['queryBuilderGroup']): unknown {
  if (!group) return null
  const rules = group.rules.map((r) => ({
    field: r.field,
    operator: r.operator,
    value: r.value,
    sourceScope: r.sourceScope
  }))
  const groups = group.groups.map((g) => ({
    op: g.operator,
    rules: g.rules.map((r) => ({
      field: r.field,
      operator: r.operator,
      value: r.value,
      sourceScope: r.sourceScope
    }))
  }))
  return { op: group.operator, rules, groups }
}

function baseKey(q: SearchQuery): string {
  return JSON.stringify({ group: serializeGroup(resolveGroup(q)) })
}

function pageKey(q: SearchQuery): string {
  return JSON.stringify({
    group: serializeGroup(resolveGroup(q)),
    sortBy: q.sortBy,
    sortDirection: q.sortDirection,
    pageSize: q.pageSize
  })
}

function sortResults(list: Citation[], sortBy: SearchQuery['sortBy'], sortDirection: SearchQuery['sortDirection']) {
  const dir = sortDirection === 'asc' ? 1 : -1
  const getDate = (c: Citation) => {
    const dateStr = c.date_judgment || c.date_decision || c.date || ''
    const time = dateStr ? Date.parse(dateStr) : 0
    return Number.isNaN(time) ? 0 : time
  }
  const getRelevance = (c: Citation) => (c.relevanceScore ?? 0)
  const getCitations = (c: Citation) => (c.nCited ?? 0)
  const getImportance = (c: Citation) => (c.importance ?? 0)

  const comparer = (a: Citation, b: Citation) => {
    let diff = 0
    switch (sortBy) {
      case 'date':
        diff = getDate(a) - getDate(b)
        break
      case 'citations':
        diff = getCitations(a) - getCitations(b)
        break
      case 'importance':
        diff = getImportance(a) - getImportance(b)
        break
      case 'relevance':
      default:
        diff = getRelevance(a) - getRelevance(b)
        break
    }
    if (diff === 0) {
      diff = getDate(a) - getDate(b)
    }
    return diff * dir
  }

  return [...list].sort(comparer)
}

function getCachedPage(key: string, page: number) {
  return pageCache.value[key]?.[page]
}

function applySelectAllToResults(items: Citation[]) {
  if (!selectAllActive.value) return
  const next = new Set(selectedIds.value)
  for (const item of items) {
    if (!deselectedIds.value.has(item.id)) {
      next.add(item.id)
    }
  }
  selectedIds.value = next
}

function rebuildSelectedFromAll(items: Citation[]) {
  if (!selectAllActive.value) return
  const next = new Set<string>()
  for (const item of items) {
    if (!deselectedIds.value.has(item.id)) {
      next.add(item.id)
    }
  }
  selectedIds.value = next
}

function gatherCachedResults(key: string): Citation[] {
  const pages = pageCache.value[key]
  if (!pages) return []
  const seen = new Set<string>()
  const all: Citation[] = []
  for (const page of Object.values(pages)) {
    for (const item of page.results) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      all.push(item)
    }
  }
  return all
}

async function search() {
  // Abort any in-progress background loading from a previous search
  if (abortBackground) {
    abortBackground()
    abortBackground = null
  }

  const requestedPage = query.value.page
  const requestedCursor = query.value.cursor

  const key = pageKey(query.value)
  const base = baseKey(query.value)
  const cachedPage = getCachedPage(key, requestedPage)
  if (cachedPage) {
    results.value = cachedPage
    loading.value = false
    error.value = null
    applySelectAllToResults(cachedPage.results)
    return
  }

  const cachedFull = fullCache.value[base]
  if (cachedFull) {
    const sorted = sortResults(cachedFull.results, query.value.sortBy, query.value.sortDirection)
    const start = (requestedPage - 1) * query.value.pageSize
    const pageResults = sorted.slice(start, start + query.value.pageSize)
    const next: SearchResult = {
      results: pageResults,
      total: cachedFull.results.length,
      totalIsExact: true,
      page: requestedPage,
      pageSize: query.value.pageSize,
      facets: cachedFull.facets,
      nextCursor: undefined
    }
    results.value = next
    pageCache.value[key] = { ...(pageCache.value[key] || {}), [requestedPage]: next }
    loading.value = false
    error.value = null
    rebuildSelectedFromAll(cachedFull.results)
    return
  }

  loading.value = true
  error.value = null
  try {
    const seed = query.value.page > 1 && results.value
      ? { facets: results.value.facets, total: results.value.total, totalIsExact: results.value.totalIsExact }
      : undefined
    const abort = await executeSearch(query.value, (result) => {
      results.value = result
      if (result.nextCursor !== undefined) {
        cursorHistory.value = { ...cursorHistory.value, [requestedPage + 1]: result.nextCursor }
      }
      cursorHistory.value = { ...cursorHistory.value, [requestedPage]: requestedCursor }
      // Once we have first results, stop showing the main loading spinner
      loading.value = false
      pageCache.value[key] = { ...(pageCache.value[key] || {}), [requestedPage]: result }
      applySelectAllToResults(result.results)
    }, seed, (payload) => {
      if (!payload.complete) return
      const facets = computeFacets(payload.all)
      fullCache.value[base] = { results: payload.all, facets }
      rebuildSelectedFromAll(payload.all)
    })
    abortBackground = abort
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed'
    results.value = null
    loading.value = false
  }
}

function setQuery(partial: Partial<SearchQuery>) {
  query.value = { ...query.value, ...partial }
}

function resetPagination() {
  cursorHistory.value = { 1: undefined }
  query.value = { ...query.value, page: 1, cursor: undefined }
}

function resetQuery() {
  if (abortBackground) {
    abortBackground()
    abortBackground = null
  }
  query.value = createDefaultSearchQuery()
  results.value = null
  error.value = null
  selectedResult.value = null
  selectedIds.value = new Set()
  selectAllActive.value = false
  deselectedIds.value = new Set()
  cursorHistory.value = { 1: undefined }
}

function hasCachedPage(page: number) {
  const key = pageKey(query.value)
  return !!pageCache.value[key]?.[page]
}

function hasFullCache() {
  const key = baseKey(query.value)
  return !!fullCache.value[key]
}

function selectResult(citation: Citation) {
  selectedResult.value = citation
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

function toggleSelection(id: string) {
  if (selectAllActive.value) {
    const nextDeselected = new Set(deselectedIds.value)
    const nextSelected = new Set(selectedIds.value)
    if (nextDeselected.has(id)) {
      nextDeselected.delete(id)
      nextSelected.add(id)
    } else {
      nextDeselected.add(id)
      nextSelected.delete(id)
    }
    deselectedIds.value = nextDeselected
    selectedIds.value = nextSelected
    return
  }

  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function selectAll() {
  if (!results.value) return
  selectAllActive.value = true
  deselectedIds.value = new Set()
  const base = baseKey(query.value)
  const cachedFull = fullCache.value[base]
  if (cachedFull) {
    rebuildSelectedFromAll(cachedFull.results)
    return
  }
  const cached = gatherCachedResults(pageKey(query.value))
  if (cached.length > 0) {
    rebuildSelectedFromAll(cached)
    return
  }
  selectedIds.value = new Set(results.value.results.map((r) => r.id))
}

function clearSelection() {
  selectedIds.value = new Set()
  selectAllActive.value = false
  deselectedIds.value = new Set()
}

const hasSelection = computed(() => {
  if (selectAllActive.value) {
    const total = results.value?.total ?? selectedIds.value.size
    return total - deselectedIds.value.size > 0
  }
  return selectedIds.value.size > 0
})
const selectedCount = computed(() => {
  if (selectAllActive.value) {
    const total = results.value?.total ?? selectedIds.value.size
    return Math.max(total - deselectedIds.value.size, 0)
  }
  return selectedIds.value.size
})
const totalPages = computed(() => {
  if (!results.value || !results.value.totalIsExact) return null
  return Math.ceil(results.value.total / query.value.pageSize)
})

async function goToPage(page: number) {
  const cursor = cursorHistory.value[page]
  query.value = { ...query.value, page, cursor }
  await search()
}

async function setSort(sortBy: SearchQuery['sortBy'], sortDirection?: SearchQuery['sortDirection']) {
  cursorHistory.value = { 1: undefined }
  query.value = {
    ...query.value,
    sortBy,
    sortDirection: sortDirection || query.value.sortDirection,
    page: 1,
    cursor: undefined
  }
  await search()
}

function exportSelected(format: 'json' | 'csv') {
  if (!results.value) return
  let selected: Citation[] = []
  if (selectAllActive.value) {
    const base = baseKey(query.value)
    const cachedFull = fullCache.value[base]
    if (cachedFull) {
      selected = cachedFull.results.filter((r) => !deselectedIds.value.has(r.id))
    } else {
      const cached = gatherCachedResults(pageKey(query.value))
      selected = cached.length > 0
        ? cached.filter((r) => !deselectedIds.value.has(r.id))
        : results.value.results.filter((r) => selectedIds.value.has(r.id))
    }
  } else {
    selected = results.value.results.filter((r) => selectedIds.value.has(r.id))
  }
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' })
    downloadBlob(blob, 'search-results.json')
  } else {
    const headers = ['ECLI', 'Title', 'Date', 'Source', 'Summary']
    const rows = selected.map((r) => [
      r.ecli,
      r.title || '',
      r.date || r.date_judgment || '',
      r.source,
      `"${(r.summary || '').replace(/"/g, '""')}"`
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    downloadBlob(blob, 'search-results.csv')
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function useSearch() {
  return {
    query,
    results,
    loading,
    error,
    selectedResult,
    detailOpen,
    selectedIds,
    cursorHistory,
    search,
    setQuery,
    resetQuery,
    resetPagination,
    selectResult,
    closeDetail,
    toggleSelection,
    selectAll,
    clearSelection,
    hasSelection,
    selectedCount,
    totalPages,
    goToPage,
    setSort,
    exportSelected,
    hasCachedPage,
    hasFullCache,
    isFullyLoaded
  }
}
