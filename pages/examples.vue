<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ExternalLink, Play, Copy, Link2, Sparkles } from 'lucide-vue-next'
import AppHeader from '~/components/shared/AppHeader.vue'
import AppFooter from '~/components/shared/AppFooter.vue'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderStandalone from '~/components/search/QueryBuilderStandalone.vue'
import QueryPreview from '~/components/search/QueryPreview.vue'
import QueryJsonPanel from '~/components/examples/QueryJsonPanel.vue'
import type { QueryBuilderGroup } from '~/lib/types'
import { queryBuilderGroupToParams } from '~/lib/utils/query-builder-url'
import { parseNaturalLanguageToQueryBuilderGroup } from '~/lib/parser/nl-query-parser'
import { defaultScopeForField } from '~/lib/utils/query-builder-config'
import { useSearch } from '~/composables/useSearch'
import { compressSearchParams } from '~/lib/utils/compressed-url'

const router = useRouter()
const store = useSearch()

type ExampleItem = {
  id: string
  title: string
  description: string
  searchText?: string
  group: QueryBuilderGroup
  scope: 'ECHR' | 'RS' | 'MIXED'
  tags: string[]
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function makeRule(field: string, value: string, operator: string = 'contains', scope?: QueryBuilderGroup['rules'][number]['sourceScope']) {
  return {
    id: genId(),
    field,
    operator,
    value,
    sourceScope: scope ?? defaultScopeForField(field)
  }
}

function makeGroup(operator: 'AND' | 'OR' | 'NOT', rules: ReturnType<typeof makeRule>[], groups: QueryBuilderGroup[] = []): QueryBuilderGroup {
  return {
    id: genId(),
    operator,
    rules,
    groups
  }
}

function buildTextExample(
  text: string,
  title: string,
  description: string,
  scope: ExampleItem['scope'],
  tags: string[]
): ExampleItem {
  return {
    id: genId(),
    title,
    description,
    searchText: text,
    group: parseNaturalLanguageToQueryBuilderGroup(text),
    scope,
    tags
  }
}

const textExamples = reactive<ExampleItem[]>([
  buildTextExample(
    'Article 3 violated Turkey between 2014 and 2016',
    'Article + date range',
    'Use plain language with articles, countries, and date ranges.',
    'ECHR',
    ['article', 'date range', 'respondent state']
  ),
  buildTextExample(
    'ECHR respondent state Armenia importance 1',
    'Source + importance',
    'Scope to ECHR and specify importance (1-4) in the same sentence.',
    'ECHR',
    ['source scope', 'importance']
  ),
  buildTextExample(
    'Rechtspraak "intellectual property" 2020',
    'Rechtspraak topical search',
    'Mention Rechtspraak and add a quoted topic plus a year.',
    'RS',
    ['keyword', 'year']
  ),
  buildTextExample(
    'ECLI:NL:HR:2019:1234',
    'Direct ECLI lookup',
    'Paste an ECLI to target a specific decision.',
    'RS',
    ['ecli', 'identifier']
  ),
  buildTextExample(
    'Cases in Germany in 2010 with Article 6 violated',
    'Country + article + year',
    'Combine respondent state, year, and article in one sentence.',
    'ECHR',
    ['article', 'year', 'state']
  ),
  buildTextExample(
    'Rechtspraak Bestuursrecht 2015 instance Raad van State',
    'Domain + instance',
    'Combine a Rechtspraak domain with a specific court instance.',
    'RS',
    ['instance', 'domain']
  ),
  buildTextExample(
    'ECHR Article 8 non-violated "privacy" 2021',
    'Non-violation signal',
    'Use “non-violated” to target negative findings alongside a quoted topic.',
    'ECHR',
    ['article', 'non-violated', 'keyword']
  ),
  buildTextExample(
    'Cases with ECLI ECLI:NL:RBAMS and "privacy"',
    'ECLI prefix',
    'Search by an ECLI prefix plus a quoted topic keyword.',
    'RS',
    ['ecli', 'keyword']
  ),
  buildTextExample(
    'ECHR "fair trial" AND "freedom of expression" 2018',
    'Boolean + multi-topic',
    'Use AND/OR to combine multiple quoted concepts.',
    'ECHR',
    ['boolean', 'keyword']
  ),
  buildTextExample(
    'Rechtspraak "tax law" between 2012 and 2014',
    'Year range (RS)',
    'Use “between” to set a range with a quoted topic.',
    'RS',
    ['year range', 'keyword']
  ),
  buildTextExample(
    'ECHR "right to life" Germany 2010',
    'Keyword + state',
    'Quote a human rights phrase and combine it with a respondent state.',
    'ECHR',
    ['keyword', 'respondent state']
  ),
  buildTextExample(
    'Rechtspraak "asylum seeker" 2019',
    'Keyword only',
    'Pure keyword search works when it is wrapped in quotes.',
    'RS',
    ['keyword']
  ),
  buildTextExample(
    'ECHR "inhuman treatment" Turkey between 2014 and 2016',
    'Keyword + range',
    'Combine a quoted phrase with a date range and a state.',
    'ECHR',
    ['keyword', 'date range', 'respondent state']
  ),
  buildTextExample(
    'Rechtspraak "contract breach" AND "damages" 2018',
    'Boolean keyword',
    'Use AND between two quoted phrases.',
    'RS',
    ['keyword', 'boolean']
  ),
  buildTextExample(
    'ECHR Article 6 violated "fair trial" 2016',
    'Article + keyword',
    'Combine an article filter with a quoted phrase.',
    'ECHR',
    ['article', 'keyword']
  ),
  buildTextExample(
    'Rechtspraak "freedom of information" 2021',
    'Public law keyword',
    'Search for public law topics with quoted phrases.',
    'RS',
    ['keyword', 'year']
  ),
  buildTextExample(
    'ECHR "family life" AND "privacy" 2020',
    'Multiple keywords',
    'Multiple quoted phrases are parsed as separate keywords.',
    'ECHR',
    ['keyword', 'boolean']
  ),
  buildTextExample(
    'Rechtspraak "eminent domain" 2017',
    'Property keyword',
    'Use a quoted property-related phrase.',
    'RS',
    ['keyword']
  ),
  buildTextExample(
    'ECHR "freedom of expression" 2019',
    'Single keyword',
    'Simple quoted phrases are parsed as keywords.',
    'ECHR',
    ['keyword', 'year']
  ),
  buildTextExample(
    'Rechtspraak "child custody" 2013',
    'Family law keyword',
    'Quoted phrases map to keyword filters.',
    'RS',
    ['keyword', 'year']
  ),
  buildTextExample(
    'ECHR language ENG judgment date on 2020-05-01',
    'Language + judgment date',
    'Use ISO‑3 language codes and an exact judgment date.',
    'ECHR',
    ['language', 'judgment date']
  ),
  buildTextExample(
    'ECHR decision date before 2019-06-01 respondent state France',
    'Decision date bound',
    'Filter by decision date before a specific day.',
    'ECHR',
    ['decision date', 'respondent state']
  ),
  buildTextExample(
    'Rechtspraak selected law BWBX1234|56 2020',
    'Selected law',
    'Target a specific BWBX law identifier in Rechtspraak.',
    'RS',
    ['selected laws', 'year']
  ),
  buildTextExample(
    'Rechtspraak articles "BWBR0001830" 2018',
    'Rechtspraak articles',
    'Filter by legal provisions using the Articles field.',
    'RS',
    ['articles', 'year']
  ),
  buildTextExample(
    'title "freedom of expression" date start 2019-01-01 date end 2019-12-31',
    'Title + exact date range',
    'Use Title with explicit date start/end for exact ranges.',
    'MIXED',
    ['title', 'date start', 'date end']
  ),
  buildTextExample(
    'ECHR "right to life" AND "fair trial" 2019',
    'Multiple keywords (AND)',
    'Combine multiple keyword phrases with AND logic.',
    'ECHR',
    ['keyword', 'boolean']
  )
])

const builderExamples = reactive<ExampleItem[]>([
  {
    id: genId(),
    title: 'ECHR Article Violations',
    description: 'Combine multiple ECHR-specific filters and a global year rule.',
    group: makeGroup('AND', [
      makeRule('article_violated', '3', 'equals', 'ECHR'),
      makeRule('respondent_state', 'Turkey', 'equals', 'ECHR'),
      makeRule('year', '2014', 'after', 'ANY')
    ]),
    scope: 'ECHR',
    tags: ['article', 'respondent state', 'year']
  },
  {
    id: genId(),
    title: 'Rechtspraak domains',
    description: 'Use an OR subgroup to search across multiple domains.',
    group: makeGroup('AND', [
      makeRule('instance', 'Hoge Raad', 'equals', 'RS')
    ], [
      makeGroup('OR', [
        makeRule('domain', 'Intellectueel-eigendomsrecht', 'equals', 'RS'),
        makeRule('domain', 'Civiel recht', 'equals', 'RS')
      ])
    ]),
    scope: 'RS',
    tags: ['domain', 'instance', 'grouping']
  },
  {
    id: genId(),
    title: 'Mixed source query',
    description: 'Combine a title keyword with an ECLI prefix filter.',
    group: makeGroup('AND', [
      makeRule('title', 'privacy', 'contains', 'ANY'),
      makeRule('ecli', 'ECLI:NL:HR', 'contains', 'ANY')
    ]),
    scope: 'MIXED',
    tags: ['title', 'ecli', 'any']
  },
  {
    id: genId(),
    title: 'Mixed: ECHR article + RS domain',
    description: 'Search across both datasets with scoped rules.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('article_violated', '5', 'equals', 'ECHR'),
        makeRule('year', '2018', 'after', 'ANY')
      ]),
      makeGroup('AND', [
        makeRule('domain', 'Bestuursrecht', 'equals', 'RS'),
        makeRule('year', '2018', 'after', 'ANY')
      ])
    ]),
    scope: 'MIXED',
    tags: ['article', 'domain', 'year']
  },
  {
    id: genId(),
    title: 'Mixed: respondent state + instance',
    description: 'Combine an ECHR respondent state with a Rechtspraak instance.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('respondent_state', 'Italy', 'equals', 'ECHR'),
        makeRule('year', '2016', 'equals', 'ANY')
      ]),
      makeGroup('AND', [
        makeRule('instance', 'Raad van State', 'equals', 'RS'),
        makeRule('year', '2016', 'equals', 'ANY')
      ])
    ]),
    scope: 'MIXED',
    tags: ['respondent state', 'instance', 'year']
  },
  {
    id: genId(),
    title: 'Mixed: OR grouping by dataset',
    description: 'OR between ECHR article filter and Rechtspraak domain filter.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('article_applied', '8', 'equals', 'ECHR'),
        makeRule('year', '2012', 'after', 'ANY')
      ]),
      makeGroup('AND', [
        makeRule('domain', 'Belastingrecht', 'equals', 'RS'),
        makeRule('year', '2012', 'after', 'ANY')
      ])
    ]),
    scope: 'MIXED',
    tags: ['grouping', 'article', 'domain']
  },
  {
    id: genId(),
    title: 'Mixed: text + dataset filters',
    description: 'Use full text with dataset-specific filters side by side.',
    group: makeGroup('OR', [], [
      makeGroup('AND', [
        makeRule('text', 'privacy', 'contains', 'ANY'),
        makeRule('article_non_violated', '8', 'equals', 'ECHR')
      ]),
      makeGroup('AND', [
        makeRule('text', 'privacy', 'contains', 'ANY'),
        makeRule('instance', 'Hoge Raad', 'equals', 'RS')
      ])
    ]),
    scope: 'MIXED',
    tags: ['text', 'article', 'instance']
  },
  {
    id: genId(),
    title: 'ECHR application numbers',
    description: 'Filter by a known application number and a respondent state.',
    group: makeGroup('AND', [
      makeRule('application_number', '23459/03', 'equals', 'ECHR'),
      makeRule('respondent_state', 'Germany', 'equals', 'ECHR')
    ]),
    scope: 'ECHR',
    tags: ['application number', 'respondent state']
  },
  {
    id: genId(),
    title: 'Rechtspraak opinion type',
    description: 'Target a specific decision type and domain.',
    group: makeGroup('AND', [
      makeRule('document_type', 'OPI', 'equals', 'RS'),
      makeRule('domain', 'Belastingrecht', 'equals', 'RS')
    ]),
    scope: 'RS',
    tags: ['document type', 'domain']
  },
  {
    id: genId(),
    title: 'NOT grouping',
    description: 'Exclude a domain with a NOT group while keeping a global year.',
    group: makeGroup('AND', [
      makeRule('year', '2019', 'equals', 'ANY')
    ], [
      makeGroup('NOT', [
        makeRule('domain', 'Personen- en familierecht', 'equals', 'RS')
      ])
    ]),
    scope: 'RS',
    tags: ['not', 'grouping', 'year']
  },
  {
    id: genId(),
    title: 'ECHR language + judgment date',
    description: 'Combine ISO‑3 language codes with an exact judgment date.',
    group: makeGroup('AND', [
      makeRule('language', 'ENG', 'equals', 'ECHR'),
      makeRule('date_judgment_start', '2020-05-01', 'equals', 'ECHR')
    ]),
    scope: 'ECHR',
    tags: ['language', 'judgment date']
  },
  {
    id: genId(),
    title: 'ECHR decision date range',
    description: 'Filter by decision date boundaries.',
    group: makeGroup('AND', [
      makeRule('date_decision_start', '2019-01-01', 'after', 'ECHR'),
      makeRule('date_decision_end', '2019-12-31', 'before', 'ECHR')
    ]),
    scope: 'ECHR',
    tags: ['decision date', 'range']
  },
  {
    id: genId(),
    title: 'Rechtspraak selected laws + articles',
    description: 'Combine selected law identifiers with legal provisions.',
    group: makeGroup('AND', [
      makeRule('selectedLaws', 'BWBX1234|56', 'equals', 'RS'),
      makeRule('articles', 'BWBR0001830', 'contains', 'RS')
    ]),
    scope: 'RS',
    tags: ['selected laws', 'articles']
  },
  {
    id: genId(),
    title: 'Exact date bounds',
    description: 'Use explicit start/end dates for precise ranges.',
    group: makeGroup('AND', [
      makeRule('dateStart', '2020-02-01', 'equals', 'ANY'),
      makeRule('dateEnd', '2020-03-15', 'equals', 'ANY')
    ]),
    scope: 'MIXED',
    tags: ['date start', 'date end']
  }
])

const filterScope = ref<'ALL' | 'ECHR' | 'RS' | 'MIXED'>('ALL')
const filterText = ref('')
const expandedTextId = ref<string | null>(null)

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
                        <Button variant="default" size="sm" class="h-8 gap-2 rounded-lg px-4" @click="testQuery(example)">
                          <Play class="h-3 w-3" />
                          Test query
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
                    <Button variant="default" size="sm" class="h-8 gap-2 rounded-lg px-4" @click="testQuery(example)">
                      <Play class="h-3.5 w-3.5" />
                      Test query
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
