<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ExternalLink, Play, Copy, Link2, Sparkles, Loader2 } from 'lucide-vue-next'
import AppHeader from '~/components/shared/AppHeader.vue'
import AppFooter from '~/components/shared/AppFooter.vue'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderStandalone from '~/components/search/QueryBuilderStandalone.vue'
import QueryPreview from '~/components/search/QueryPreview.vue'
import QueryJsonPanel from '~/components/examples/QueryJsonPanel.vue'
import { queryBuilderGroupToParams } from '~/lib/utils/query-builder-url'
import { queryBuilderGroupToSearchQuery } from '~/lib/utils/search-query'
import { fetchCombinedPage } from '~/lib/api/client'
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser'
import { useSearch } from '~/composables/useSearch'
import { compressSearchParams } from '~/lib/utils/compressed-url'
import { TEXT_EXAMPLES, BUILDER_EXAMPLES } from '~/lib/utils/curated-examples'
import type { ExampleItem } from '~/lib/utils/curated-examples'

const router = useRouter()
const store = useSearch()

const textExamples = reactive<ExampleItem[]>([...TEXT_EXAMPLES])

const builderExamples = reactive<ExampleItem[]>([...BUILDER_EXAMPLES])

const filterScope = ref<'ALL' | 'ECHR' | 'RS' | 'MIXED'>('ALL')
const filterText = ref('')
const expandedTextId = ref<string | null>(null)

const tryLoading = reactive(new Map<string, boolean>())
const tryResults = reactive(new Map<string, { total: number; echrTotal: number; rsTotal: number }>())
const tryErrors = reactive(new Map<string, string>())

const scopeCounts = computed(() => {
  const all = [...textExamples, ...builderExamples]
  return {
    total: all.length,
    echr: all.filter((ex) => ex.scope === 'ECHR').length,
    rs: all.filter((ex) => ex.scope === 'RS').length,
    mixed: all.filter((ex) => ex.scope === 'MIXED').length
  }
})

function matchesFilter(example: ExampleItem) {
  if (filterScope.value !== 'ALL' && example.scope !== filterScope.value) return false
  const needle = filterText.value.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    example.title,
    example.description,
    example.searchText || '',
    ...example.tags
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

const filteredTextExamples = computed(() =>
  textExamples.filter(matchesFilter)
)
const filteredBuilderExamples = computed(() =>
  builderExamples.filter(matchesFilter)
)

function buildResultsUrl(example: ExampleItem) {
  const params = queryBuilderGroupToParams(example.group, {
    searchString: example.searchText || undefined
  })
  const compressed = compressSearchParams(params)
  return `/results?${compressed.toString()}`
}

function testQuery(example: ExampleItem) {
  store.abortAll()
  router.push(buildResultsUrl(example))
}

function openInNewTab(example: ExampleItem) {
  if (typeof window === 'undefined') return
  window.open(buildResultsUrl(example), '_blank', 'noopener')
}

async function tryQuery(example: ExampleItem) {
  if (tryLoading.get(example.id)) return
  tryLoading.set(example.id, true)
  tryResults.delete(example.id)
  tryErrors.delete(example.id)

  try {
    const parsed = queryBuilderGroupToSearchQuery(example.group)
    if (!parsed.query) {
      tryErrors.set(example.id, parsed.error || 'Invalid query')
      return
    }
    const result = await fetchCombinedPage(parsed.query, example.group, 1)
    tryResults.set(example.id, {
      total: result.total ?? 0,
      echrTotal: result.echrTotal ?? 0,
      rsTotal: result.rsTotal ?? 0,
    })
  } catch (err: unknown) {
    tryErrors.set(example.id, err instanceof Error ? err.message : 'Request failed')
  } finally {
    tryLoading.set(example.id, false)
  }
}

function toggleExpanded(id: string) {
  expandedTextId.value = expandedTextId.value === id ? null : id
}

async function copySearch(example: ExampleItem) {
  if (!example.searchText || typeof navigator === 'undefined') return
  try {
    await navigator.clipboard.writeText(example.searchText)
  } catch {
    // noop
  }
}

async function copyUrl(example: ExampleItem) {
  if (typeof navigator === 'undefined') return
  try {
    const url = buildResultsUrl(example)
    const absolute = typeof window !== 'undefined'
      ? new URL(url, window.location.origin).toString()
      : url
    await navigator.clipboard.writeText(absolute)
  } catch {
    // noop
  }
}

function openRandomExample() {
  const pool = [...textExamples, ...builderExamples]
  const picked = pool[Math.floor(Math.random() * pool.length)]
  if (picked) testQuery(picked)
}

function updateExampleSearch(example: ExampleItem, value: string) {
  example.searchText = value
  example.group = parseNaturalLanguageToQueryBuilderGroup(value)
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-background via-background to-muted/30">
    <AppHeader fixed />

    <main class="px-6 pt-20 pb-24">
      <div class="mx-auto max-w-6xl">
        <div class="relative">
          <div class="mx-auto max-w-5xl space-y-12">
            <header id="overview" class="space-y-6">
              <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-start">
                <div class="space-y-4">
                  <div class="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground/80">
                    <Sparkles class="h-3.5 w-3.5 text-primary/70" />
                    Example library
                  </div>
                  <h1 class="text-3xl font-semibold tracking-tight text-foreground">
                    Explore ready-made searches and templates.
                  </h1>
                  <p class="text-sm text-muted-foreground max-w-2xl">
                    Use the search bar for natural-language queries or assemble precise filters with the query builder.
                    Every example below is live: test it, open it, or inspect the exact query payload.
                    Tip: keywords are only parsed when wrapped in quotation marks. Exact dates use YYYY‑MM‑DD, language uses ISO‑3, and selected laws look like BWBX1234|56.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <Button variant="default" size="sm" class="h-8 gap-2" @click="openRandomExample">
                      <Play class="h-3.5 w-3.5" />
                      Try a random example
                    </Button>
                    <Button variant="outline" size="sm" class="h-8 gap-2" @click="filterScope = 'ALL'">
                      Reset filters
                    </Button>
                  </div>
                </div>
                <div class="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-sm">
                  <div class="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-3">Quick start</div>
                  <ol class="space-y-3 text-xs text-muted-foreground">
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">1</span>
                      Pick an example and test it.
                    </li>
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">2</span>
                      Adjust the rules in the query builder.
                    </li>
                    <li class="flex gap-3">
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">3</span>
                      Share the URL to preserve filters and pagination.
                    </li>
                  </ol>
                  <div class="mt-4 rounded-xl border border-border/40 bg-background/80 p-3 text-xs text-muted-foreground">
                    <div class="font-semibold text-foreground/80 mb-1">Library stats</div>
                    <div class="flex flex-wrap gap-2">
                      <span class="rounded-lg border border-border/50 px-2 py-1">Total {{ scopeCounts.total }}</span>
                      <span class="rounded-lg border border-border/50 px-2 py-1">ECHR {{ scopeCounts.echr }}</span>
                      <span class="rounded-lg border border-border/50 px-2 py-1">Rechtspraak {{ scopeCounts.rs }}</span>
                      <span class="rounded-lg border border-border/50 px-2 py-1">Mixed {{ scopeCounts.mixed }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid gap-4 xl:grid-cols-[1fr_auto] items-center">
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    class="rounded-lg border px-3 py-1 text-xs transition-colors"
                    :class="filterScope === 'ALL' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'"
                    @click="filterScope = 'ALL'"
                  >All</button>
                  <button
                    class="rounded-lg border px-3 py-1 text-xs transition-colors"
                    :class="filterScope === 'ECHR' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'"
                    @click="filterScope = 'ECHR'"
                  >ECHR</button>
                  <button
                    class="rounded-lg border px-3 py-1 text-xs transition-colors"
                    :class="filterScope === 'RS' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'"
                    @click="filterScope = 'RS'"
                  >Rechtspraak</button>
                  <button
                    class="rounded-lg border px-3 py-1 text-xs transition-colors"
                    :class="filterScope === 'MIXED' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'"
                    @click="filterScope = 'MIXED'"
                  >Mixed</button>
                </div>
                <div class="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5">
                  <span class="text-[10px] uppercase tracking-wider text-muted-foreground/60">Filter</span>
                  <input
                    v-model="filterText"
                    type="text"
                    placeholder="Search examples..."
                    class="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none w-40"
                  />
                </div>
              </div>
            </header>

            <section id="search-bar-examples" class="space-y-6">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Search bar examples</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>

              <div class="space-y-2">
                <article
                  v-for="example in filteredTextExamples"
                  :key="example.id"
                  class="space-y-4 py-6 border-b border-border/40 last:border-b-0"
                >
                  <div class="space-y-4">
                    <div class="flex items-start justify-between gap-4">
                      <div class="space-y-1">
                        <h3 class="text-sm font-semibold text-foreground">{{ example.title }}</h3>
                        <p class="text-xs text-muted-foreground">{{ example.description }}</p>
                      </div>
                      <span class="rounded-lg border border-border/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {{ example.scope }}
                      </span>
                    </div>

                    <div class="rounded-xl border border-border/50 bg-background/80 px-4 py-3">
                      <div class="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Editable search bar query</div>
                      <input
                        :value="example.searchText || ''"
                        type="text"
                        class="w-full bg-transparent text-sm font-medium text-foreground/90 outline-none"
                        @input="updateExampleSearch(example, ($event.target as HTMLInputElement).value)"
                      />
                    </div>

                    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="tag in example.tags"
                          :key="tag"
                          class="rounded-lg border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >{{ tag }}</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" class="h-8 rounded-lg" @click="toggleExpanded(example.id)">
                          {{ expandedTextId === example.id ? 'Hide builder' : 'View builder' }}
                        </Button>
                        <Button variant="default" size="sm" class="h-8 gap-2 rounded-lg px-4" :disabled="tryLoading.get(example.id)" @click="tryQuery(example)">
                          <Loader2 v-if="tryLoading.get(example.id)" class="h-3 w-3 animate-spin" />
                          <Play v-else class="h-3 w-3" />
                          {{ tryLoading.get(example.id) ? 'Loading...' : 'Try example' }}
                        </Button>
                        <Button variant="outline" size="sm" class="h-8 gap-2 rounded-lg px-4" @click="openInNewTab(example)">
                          <ExternalLink class="h-3 w-3" />
                          Open in new tab
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          class="h-7 w-7 rounded-lg"
                          aria-label="Copy search text"
                          @click="copySearch(example)"
                        >
                          <Copy class="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          class="h-7 w-7 rounded-lg"
                          aria-label="Copy URL"
                          @click="copyUrl(example)"
                        >
                          <Link2 class="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div v-if="tryResults.has(example.id)" class="rounded-lg border border-border/50 bg-card/60 px-4 py-2 text-xs text-muted-foreground flex items-center gap-3">
                      <span class="font-semibold text-foreground">{{ tryResults.get(example.id)!.total }} results</span>
                      <span>ECHR: {{ tryResults.get(example.id)!.echrTotal }}</span>
                      <span>RS: {{ tryResults.get(example.id)!.rsTotal }}</span>
                      <Button variant="default" size="sm" class="h-6 ml-auto gap-1.5 rounded-lg px-3 text-[11px]" @click="testQuery(example)">
                        <ExternalLink class="h-3 w-3" />
                        View results
                      </Button>
                    </div>
                    <div v-else-if="tryErrors.has(example.id)" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                      {{ tryErrors.get(example.id) }}
                    </div>
                  </div>

                  <div v-if="expandedTextId === example.id" class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <QueryBuilderStandalone :group="example.group" panel-class="p-3" />
                    <QueryJsonPanel
                      :group="example.group"
                    />
                  </div>
                  <QueryPreview
                    :group="example.group"
                    class="mt-4"
                  />
                </article>
              </div>
            </section>

            <section id="query-builder-examples" class="space-y-6">
              <div class="flex items-center gap-3">
                <div class="h-px flex-1 bg-border/60" />
                <h2 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Query builder examples</h2>
                <div class="h-px flex-1 bg-border/60" />
              </div>

              <div class="space-y-2">
                <article
                  v-for="example in filteredBuilderExamples"
                  :key="example.id"
                  class="space-y-4 py-6 border-b border-border/40 last:border-b-0"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1">
                      <h3 class="text-sm font-semibold text-foreground">{{ example.title }}</h3>
                      <p class="text-xs text-muted-foreground">{{ example.description }}</p>
                    </div>
                    <span class="rounded-lg border border-border/50 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {{ example.scope }}
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in example.tags"
                      :key="tag"
                      class="rounded-lg border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >{{ tag }}</span>
                  </div>

                  <div class="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                    <QueryBuilderStandalone :group="example.group" />
                    <QueryJsonPanel
                      :group="example.group"
                    />
                  </div>
                  <QueryPreview
                    :group="example.group"
                    class="mt-4"
                  />

                  <div class="mt-4 flex flex-wrap gap-2">
                    <Button variant="default" size="sm" class="h-8 gap-2 rounded-lg px-4" :disabled="tryLoading.get(example.id)" @click="tryQuery(example)">
                      <Loader2 v-if="tryLoading.get(example.id)" class="h-3.5 w-3.5 animate-spin" />
                      <Play v-else class="h-3.5 w-3.5" />
                      {{ tryLoading.get(example.id) ? 'Loading...' : 'Try example' }}
                    </Button>
                    <Button variant="outline" size="sm" class="h-8 gap-2 rounded-lg px-4" @click="openInNewTab(example)">
                      <ExternalLink class="h-3.5 w-3.5" />
                      Open in new tab
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      class="rounded-lg"
                      aria-label="Copy URL"
                      @click="copyUrl(example)"
                    >
                      <Link2 class="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div v-if="tryResults.has(example.id)" class="rounded-lg border border-border/50 bg-card/60 px-4 py-2 text-xs text-muted-foreground flex items-center gap-3">
                    <span class="font-semibold text-foreground">{{ tryResults.get(example.id)!.total }} results</span>
                    <span>ECHR: {{ tryResults.get(example.id)!.echrTotal }}</span>
                    <span>RS: {{ tryResults.get(example.id)!.rsTotal }}</span>
                    <Button variant="default" size="sm" class="h-6 ml-auto gap-1.5 rounded-lg px-3 text-[11px]" @click="testQuery(example)">
                      <ExternalLink class="h-3 w-3" />
                      View results
                    </Button>
                  </div>
                  <div v-else-if="tryErrors.has(example.id)" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                    {{ tryErrors.get(example.id) }}
                  </div>
                </article>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
