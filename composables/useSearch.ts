import { ref, computed } from 'vue'
import type { Citation, SearchQuery, SearchResult } from '~/lib/types'
import { createDefaultSearchQuery } from '~/lib/types'
import { executeSearch } from '~/lib/utils/search-engine'

// Module-level singleton state so all components share the same instance
const query = ref<SearchQuery>(createDefaultSearchQuery())
const results = ref<SearchResult | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedResult = ref<Citation | null>(null)
const detailOpen = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const cursorHistory = ref<Record<number, string | undefined>>({ 1: undefined })

// Abort function for cancelling background page loading on new searches
let abortBackground: (() => void) | null = null

async function search() {
  // Abort any in-progress background loading from a previous search
  if (abortBackground) {
    abortBackground()
    abortBackground = null
  }

  const requestedPage = query.value.page
  const requestedCursor = query.value.cursor

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
    }, seed)
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
  cursorHistory.value = { 1: undefined }
}

function selectResult(citation: Citation) {
  selectedResult.value = citation
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
}

function toggleSelection(id: string) {
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
  selectedIds.value = new Set(results.value.results.map((r) => r.id))
}

function clearSelection() {
  selectedIds.value = new Set()
}

const hasSelection = computed(() => selectedIds.value.size > 0)
const selectedCount = computed(() => selectedIds.value.size)
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
  const selected = results.value.results.filter((r) => selectedIds.value.has(r.id))
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
    exportSelected
  }
}
