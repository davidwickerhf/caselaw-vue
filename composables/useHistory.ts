import { ref, computed } from 'vue'
import type { SearchQuery } from '~/lib/types'

export type HistoryEntry = {
  id: string
  text: string
  timestamp: number
  query: SearchQuery
  resultCount?: number
  mode?: 'text' | 'advanced'
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

function persist() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('search-history', JSON.stringify(entries.value))
  }
}

function add(query: SearchQuery, resultCount?: number, rawText?: string) {
  init()
  const cleanedText = (rawText ?? '').trim()
  if (!cleanedText) return
  const text = cleanedText
  const mode: HistoryEntry['mode'] = 'text'

  // Remove duplicate
  entries.value = entries.value.filter((e) => e.text !== text)

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    text,
    timestamp: Date.now(),
    query,
    resultCount,
    mode
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
  return entries.value
    .filter((entry) => (entry.mode ?? 'text') === 'text')
    .slice(0, 8)
    .map((e) => e.text)
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
