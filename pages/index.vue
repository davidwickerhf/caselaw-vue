<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Scale, ArrowRight, Search } from 'lucide-vue-next'
import SmartSearchBar from '~/components/search/SmartSearchBar.vue'
import QueryBuilder from '~/components/search/QueryBuilder.vue'
import SearchHistory from '~/components/shared/SearchHistory.vue'
import AppHeader from '~/components/shared/AppHeader.vue'
import AppFooter from '~/components/shared/AppFooter.vue'
import { useSmartSearch } from '~/composables/useSmartSearch'
import { queryBuilderGroupToSearchQuery } from '~/lib/utils/search-query'
import { queryBuilderGroupToParams, paramsToQueryBuilderState } from '~/lib/utils/query-builder-url'
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser'
import { useSearch } from '~/composables/useSearch'
import { useHistory, type HistoryEntry } from '~/composables/useHistory'

const route = useRoute()
const router = useRouter()
const store = useSearch()
const history = useHistory()
const smartSearch = useSmartSearch()
const queryBuilderOpen = ref(false)
const showCompactLogo = computed(() => queryBuilderOpen.value)
const submitError = ref<string | null>(null)

const exampleSearches = [
  'Article 3 violation Turkey',
  'Right to fair trial',
  'Privacy and family life',
  'Freedom of expression',
  'Discrimination cases 2020',
  'Rechtspraak intellectual property',
]

function navigateToResults() {
  const parsed = queryBuilderGroupToSearchQuery(smartSearch.queryBuilderGroup.value)
  if (!parsed.query) {
    submitError.value = parsed.error || 'Unable to parse query builder.'
    return
  }
  submitError.value = null
  store.setQuery({ ...parsed.query, queryBuilderGroup: smartSearch.queryBuilderGroup.value })
  const includeSearchString = smartSearch.lastEditSource.value === 'searchbar' && !!smartSearch.searchString.value
  const rawSearchText = includeSearchString ? smartSearch.searchString.value : ''
  history.add(parsed.query, undefined, rawSearchText)
  const params = queryBuilderGroupToParams(smartSearch.queryBuilderGroup.value, {
    pageSize: parsed.query.pageSize,
    cursor: parsed.query.cursor,
    searchString: includeSearchString ? smartSearch.searchString.value : undefined
  })
  router.push({ path: '/results', query: Object.fromEntries(params.entries()) })
}

function handleSubmit() {
  navigateToResults()
}

function handleClear() {
  store.resetQuery()
  submitError.value = null
}

function handleExampleSearch(text: string) {
  smartSearch.setFromText(text)
  navigateToResults()
}

function handleHistorySelect(entry: HistoryEntry) {
  const entryText = entry?.text?.trim()
  if (entryText) {
    smartSearch.setFromText(entryText)
    navigateToResults()
    return
  }
  if (entry?.query) {
    smartSearch.setFromSearchQuery(entry.query)
    navigateToResults()
  }
}

onMounted(() => {
  store.resetQuery()
  smartSearch.clearAll()
  submitError.value = null

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) params.set(key, value.join(','))
    else if (value) params.set(key, value)
  }
  if ([...params.keys()].length === 0) return

  const parsed = paramsToQueryBuilderState(params)
  if (!parsed.state) {
    const searchString = params.get('searchString')
    if (searchString) {
      const group = parseNaturalLanguageToQueryBuilderGroup(searchString)
      const result = queryBuilderGroupToSearchQuery(group)
      if (!result.query) {
        submitError.value = result.error || 'Unable to parse query builder.'
        return
      }
      smartSearch.setFromText(searchString)
      smartSearch.setSearchString(searchString)
      smartSearch.queryBuilderGroup.value = group
      smartSearch.lastEditSource.value = 'searchbar'
      store.setQuery({ ...result.query, queryBuilderGroup: group })
      submitError.value = null
      return
    }
    submitError.value = parsed.error || 'Invalid URL parameters.'
    return
  }

  const group = parsed.state.group
  const result = queryBuilderGroupToSearchQuery(group)
  if (!result.query) {
    submitError.value = result.error || 'Unable to parse query builder.'
    return
  }

  const nextQuery = {
    ...result.query,
    pageSize: parsed.state.pageSize || result.query.pageSize,
    cursor: parsed.state.cursor
  }

  if (parsed.state.searchString) {
    smartSearch.setFromText(parsed.state.searchString)
    smartSearch.setSearchString(parsed.state.searchString)
    smartSearch.queryBuilderGroup.value = group
    smartSearch.lastEditSource.value = 'searchbar'
  } else {
    smartSearch.setFromText('')
    smartSearch.onQueryBuilderEdit(group)
    smartSearch.setSearchString('')
  }
  store.setQuery({ ...nextQuery, queryBuilderGroup: group })
  submitError.value = null
})
</script>

<template>
  <div class="h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/30">
    <AppHeader fixed />

    <!-- Scrollable middle -->
    <main class="h-full overflow-y-auto px-6 pt-20 pb-20">
      <div class="mx-auto flex min-h-[calc(100vh-10rem)] max-w-[680px] flex-col justify-center space-y-10">
        <!-- Logo & Title -->
        <div
          class="text-center space-y-4 overflow-hidden transition-all duration-300 ease-out"
          :class="showCompactLogo ? 'max-h-0 opacity-0 -translate-y-2 pointer-events-none' : 'max-h-[320px] opacity-100 translate-y-0'"
        >
          <div class="inline-flex items-center justify-center rounded-2xl bg-primary/5 p-4 mb-2">
            <Scale class="h-12 w-12 text-primary" />
          </div>
          <h1 class="text-5xl font-bold tracking-tight text-foreground">
            Legal<span class="text-primary/70">Search</span>
          </h1>
          <p class="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            Search across ECHR and Rechtspraak case law with smart query parsing
          </p>
        </div>

        <!-- Smart search bar -->
        <div class="space-y-4">
          <SmartSearchBar
            :loading="store.loading.value"
            size="large"
            autofocus
            :chips="false"
            @submit="handleSubmit"
            @clear="handleClear"
          />

          <!-- Query builder toggle -->
          <div class="flex justify-center">
            <QueryBuilder v-model:open="queryBuilderOpen" @reset="handleClear" />
          </div>
          <p v-if="submitError" class="text-xs text-destructive text-center">
            {{ submitError }}
          </p>
        </div>

        <!-- Search history -->
        <SearchHistory @select="handleHistorySelect" />

        <!-- Example searches -->
        <div class="space-y-4">
          <div class="flex items-center justify-center gap-2">
            <div class="h-px flex-1 bg-border/50" />
            <span class="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-3">Try searching</span>
            <div class="h-px flex-1 bg-border/50" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="example in exampleSearches"
              :key="example"
              class="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground hover:border-primary/20 hover:bg-accent/50 hover:shadow-sm transition-all"
              @click="handleExampleSearch(example)"
            >
              <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              <span class="truncate">{{ example }}</span>
              <ArrowRight class="h-3.5 w-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
          </div>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
