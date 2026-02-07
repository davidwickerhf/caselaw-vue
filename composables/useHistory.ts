import { ref, computed } from 'vue'
import type { SearchQuery } from '~/lib/types'

export type HistoryEntry = {
  id: string
  text: string
  timestamp: number
  query: SearchQuery
  resultCount?: number
}

// Module-level singleton state
const entries = ref<HistoryEntry[]>([])
const maxEntries = 20
let initialized = false

function init() {
  if (initialized) return
  initialized = true
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('search-history')
    if (saved) {
      try {
        entries.value = JSON.parse(saved)
      } catch {
        entries.value = []
      }
    }
  }
}

function queryToText(query: SearchQuery): string {
  const parts: string[] = []
  if (query.text) parts.push(query.text)
  const scoped = query.scoped
  if (scoped?.echr?.text) parts.push(`ECHR: ${scoped.echr.text}`)
  if (scoped?.rs?.text) parts.push(`RS: ${scoped.rs.text}`)
  const allArticles = [...query.articleViolated, ...(scoped?.echr?.articleViolated || [])]
  if (allArticles.length) parts.push(`Art. ${allArticles.join(', ')}`)
  const allStates = [...query.respondentState, ...(scoped?.echr?.respondentState || [])]
  if (allStates.length) parts.push(allStates.join(', '))
  const allKeywords = [...query.keywords, ...(scoped?.echr?.keywords || []), ...(scoped?.rs?.keywords || [])]
  if (allKeywords.length) parts.push(allKeywords.join(', '))
  return parts.join(' · ') || 'Advanced search'
}

function persist() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('search-history', JSON.stringify(entries.value))
  }
}

function add(query: SearchQuery, resultCount?: number) {
  init()
  const text = queryToText(query)
  if (!text.trim()) return

  // Remove duplicate
  entries.value = entries.value.filter((e) => e.text !== text)

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    text,
    timestamp: Date.now(),
    query,
    resultCount
  }

  entries.value = [entry, ...entries.value].slice(0, maxEntries)
  persist()
}

function remove(id: string) {
  entries.value = entries.value.filter((e) => e.id !== id)
  persist()
}

function clear() {
  entries.value = []
  persist()
}

const recentTexts = computed(() => {
  return entries.value.slice(0, 8).map((e) => e.text)
})

export function useHistory() {
  init()
  return {
    entries,
    recentTexts,
    add,
    remove,
    clear
  }
}
