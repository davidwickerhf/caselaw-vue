<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, ChevronRight, X, Filter, Search, PanelLeftClose } from 'lucide-vue-next'
import Badge from '~/components/ui/badge/Badge.vue'
import type { SearchFacets, SearchQuery } from '~/lib/types'

const props = defineProps<{
  facets: SearchFacets
  query: SearchQuery
  collapsed?: boolean
}>()

const emit = defineEmits<{
  change: [partial: Partial<SearchQuery>]
  toggleCollapse: []
}>()

const filterSearch = ref('')

const expandedSections = ref<Set<string>>(new Set([
  'sources',
  'articles',
  'articlesApplied',
  'articlesNonViolated',
  'respondentStates',
  'documentTypes',
  'importance',
  'years',
  'instances',
  'domains'
]))

function toggleSection(section: string) {
  const next = new Set(expandedSections.value)
  if (next.has(section)) {
    next.delete(section)
  } else {
    next.add(section)
  }
  expandedSections.value = next
}

const activeFilters = computed(() => {
  const chips: { label: string; onremove: () => void }[] = []
  if ((props.query.sources?.length ?? 0) === 1) {
    for (const src of props.query.sources) {
      const label = src === 'ECHR' ? 'ECHR' : src === 'RS' ? 'Rechtspraak' : src
      chips.push({ label: `Source: ${label}`, onremove: () => emit('change', { sources: props.query.sources.filter((s) => s !== src) }) })
    }
  }
  for (const state of props.query.respondentState) {
    chips.push({ label: state, onremove: () => emit('change', { respondentState: props.query.respondentState.filter((s) => s !== state) }) })
  }
  for (const art of props.query.articleViolated) {
    chips.push({ label: `Violated: Art. ${art}`, onremove: () => emit('change', { articleViolated: props.query.articleViolated.filter((a) => a !== art) }) })
  }
  for (const art of props.query.articleApplied) {
    chips.push({ label: `Applied: Art. ${art}`, onremove: () => emit('change', { articleApplied: props.query.articleApplied.filter((a) => a !== art) }) })
  }
  for (const art of props.query.articleNonViolated) {
    chips.push({ label: `Not violated: Art. ${art}`, onremove: () => emit('change', { articleNonViolated: props.query.articleNonViolated.filter((a) => a !== art) }) })
  }
  for (const dt of props.query.documentType) {
    chips.push({ label: dt, onremove: () => emit('change', { documentType: props.query.documentType.filter((d) => d !== dt) }) })
  }
  for (const imp of props.query.importance) {
    const labels: Record<number, string> = { 1: 'Key case', 2: 'Important', 3: 'Moderate', 4: 'Low importance' }
    chips.push({ label: labels[imp] || `Imp. ${imp}`, onremove: () => emit('change', { importance: props.query.importance.filter((i) => i !== imp) }) })
  }
  for (const inst of props.query.instances) {
    chips.push({ label: inst, onremove: () => emit('change', { instances: props.query.instances.filter((i) => i !== inst) }) })
  }
  for (const dom of props.query.domains) {
    chips.push({ label: dom, onremove: () => emit('change', { domains: props.query.domains.filter((d) => d !== dom) }) })
  }
  return chips
})

// Map between display names (facets) and internal DataSource values
const SOURCE_DISPLAY_TO_INTERNAL: Record<string, string> = { 'Rechtspraak': 'RS', 'HUDOC': 'ECHR' }
const SOURCE_INTERNAL_TO_DISPLAY: Record<string, string> = { 'RS': 'Rechtspraak', 'ECHR': 'HUDOC' }

function toggleFacetValue(field: keyof SearchQuery, value: string) {
  const current = props.query[field] as string[]
  if (field === 'sources') {
    const internal = SOURCE_DISPLAY_TO_INTERNAL[value] || value
    // Source filter: click = "show only this source"; click again = "show all"
    if (current.length === 1 && current[0] === internal) {
      // Already filtering to this source, restore both
      emit('change', { [field]: ['ECHR', 'RS'] })
    } else {
      // Filter to only this source
      emit('change', { [field]: [internal] })
    }
    return
  }
  if (current.includes(value)) {
    emit('change', { [field]: current.filter((v) => v !== value) })
  } else {
    emit('change', { [field]: [...current, value] })
  }
}

function toggleImportanceFacet(value: number) {
  if (props.query.importance.includes(value)) {
    emit('change', { importance: props.query.importance.filter((v) => v !== value) })
  } else {
    emit('change', { importance: [...props.query.importance, value] })
  }
}

// Source scope for each filter section
type SourceScope = 'ECHR' | 'RS' | 'all'

type FacetSection = {
  key: string
  label: string
  source: SourceScope
  items: { value: string; count: number }[]
  field: keyof SearchQuery
  activeValues: string[] | number[]
  isNumeric?: boolean
  formatValue?: (v: string) => string
}

const allSections = computed<FacetSection[]>(() =>
  ([
    { key: 'sources', label: 'Source', source: 'all' as SourceScope, items: props.facets.sources, field: 'sources' as keyof SearchQuery, activeValues: (props.query.sources?.length ?? 0) >= 2 ? [] : (props.query.sources || []).map((s) => SOURCE_INTERNAL_TO_DISPLAY[s] || s) },
    { key: 'documentTypes', label: 'Document Type', source: 'all' as SourceScope, items: props.facets.documentTypes, field: 'documentType' as keyof SearchQuery, activeValues: props.query.documentType },
    { key: 'articles', label: 'Articles Violated', source: 'ECHR' as SourceScope, items: props.facets.articles.slice(0, 15), field: 'articleViolated' as keyof SearchQuery, activeValues: props.query.articleViolated, formatValue: (v: string) => `Art. ${v}` },
    { key: 'articlesApplied', label: 'Articles Applied', source: 'ECHR' as SourceScope, items: (props.facets.articlesApplied ?? []).slice(0, 15), field: 'articleApplied' as keyof SearchQuery, activeValues: props.query.articleApplied, formatValue: (v: string) => `Art. ${v}` },
    { key: 'articlesNonViolated', label: 'Articles Not Violated', source: 'ECHR' as SourceScope, items: (props.facets.articlesNonViolated ?? []).slice(0, 15), field: 'articleNonViolated' as keyof SearchQuery, activeValues: props.query.articleNonViolated, formatValue: (v: string) => `Art. ${v}` },
    { key: 'respondentStates', label: 'Respondent State', source: 'ECHR' as SourceScope, items: props.facets.respondentStates.slice(0, 15), field: 'respondentState' as keyof SearchQuery, activeValues: props.query.respondentState },
    { key: 'importance', label: 'Importance', source: 'ECHR' as SourceScope, items: [...props.facets.importance].sort((a, b) => Number(a.value) - Number(b.value)), field: 'importance' as keyof SearchQuery, activeValues: props.query.importance, isNumeric: true },
    { key: 'years', label: 'Year', source: 'all' as SourceScope, items: props.facets.years.slice(0, 10), field: 'dateStart' as keyof SearchQuery, activeValues: [] },
    { key: 'instances', label: 'Court Instance', source: 'RS' as SourceScope, items: props.facets.instances.slice(0, 10), field: 'instances' as keyof SearchQuery, activeValues: props.query.instances },
    { key: 'domains', label: 'Legal Domain', source: 'RS' as SourceScope, items: props.facets.domains.slice(0, 10), field: 'domains' as keyof SearchQuery, activeValues: props.query.domains }
  ] as FacetSection[]).filter((s) => s.items.length > 0)
)

// Filter sections and their items based on the search text
const sections = computed<FacetSection[]>(() => {
  const q = filterSearch.value.trim().toLowerCase()
  if (!q) return allSections.value

  return allSections.value
    .map((section) => {
      // If section label matches, show the whole section
      if (section.label.toLowerCase().includes(q)) return section
      // Otherwise filter individual items
      const filtered = section.items.filter((item) => {
        const display = formatItemValue(section, item.value).toLowerCase()
        return display.includes(q) || item.value.toLowerCase().includes(q)
      })
      if (filtered.length === 0) return null
      return { ...section, items: filtered }
    })
    .filter((s): s is FacetSection => s !== null)
})

function getImportanceLabel(value: string): string {
  const labels: Record<string, string> = { '1': 'Key case', '2': 'Important', '3': 'Moderate', '4': 'Low importance' }
  return labels[value] || value
}

function isActive(section: FacetSection, itemValue: string): boolean {
  if (section.isNumeric) {
    return (section.activeValues as number[]).includes(Number(itemValue))
  }
  return (section.activeValues as string[]).includes(itemValue)
}

function formatItemValue(section: FacetSection, value: string): string {
  if (section.formatValue) return section.formatValue(value)
  if (section.key === 'importance') return getImportanceLabel(value)
  return value
}
</script>

<template>
  <template v-if="collapsed">
    <button
      class="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50 ml-4"
      @click="emit('toggleCollapse')"
    >
      <Filter class="h-3 w-3" />
      Filters
    </button>
  </template>
  <div v-else class="flex h-full w-full shrink-0 flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3">
      <div class="flex items-center gap-2">
        <Filter class="h-3.5 w-3.5 text-muted-foreground/70" />
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Filters</span>
        <Badge v-if="activeFilters.length > 0" variant="secondary" class="text-[10px] h-4 px-1.5 tabular-nums">
          {{ activeFilters.length }}
        </Badge>
      </div>
      <button
        class="text-[10px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors"
        @click="emit('toggleCollapse')"
      >
        <PanelLeftClose class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- Search input -->
    <div class="px-3 pb-2.5">
      <div class="relative">
        <Search class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
        <input
          v-model="filterSearch"
          type="text"
          placeholder="Search filters..."
          class="w-full rounded-md border border-border/60 bg-muted/20 py-1.5 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border focus:bg-background transition-colors"
        />
        <button
          v-if="filterSearch"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
          @click="filterSearch = ''"
        >
          <X class="h-3 w-3" />
        </button>
      </div>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilters.length > 0" class="flex flex-wrap gap-1 pb-2.5 px-3">
      <Badge v-for="(chip, i) in activeFilters" :key="i" variant="secondary" class="gap-1 pr-1 text-[10px]">
        {{ chip.label }}
        <button class="ml-0.5 rounded-md hover:bg-muted-foreground/20" @click="chip.onremove()">
          <X class="h-2.5 w-2.5" />
        </button>
      </Badge>
    </div>

    <!-- Separator -->
    <div class="h-px bg-border" />

    <!-- No results for search -->
    <div v-if="filterSearch && sections.length === 0" class="px-4 py-6 text-center">
      <p class="text-xs text-muted-foreground/60">No filters match "{{ filterSearch }}"</p>
    </div>

    <!-- Facet sections -->
    <div class="flex-1 overflow-y-auto pr-0 pb-16">
      <div
        v-for="(section, idx) in sections"
        :key="section.key"
        :class="['border-b border-border px-4', idx === sections.length - 1 ? 'border-b-0' : '', expandedSections.has(section.key) ? 'pb-2' : '']"
      >
        <button
          class="flex w-full items-center justify-between py-2.5 text-left"
          @click="toggleSection(section.key)"
        >
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {{ section.label }}
            </span>
            <Badge
              v-if="section.source !== 'all'"
              :variant="section.source === 'ECHR' ? 'default' : 'secondary'"
              class="text-[9px] h-3.5 px-1 font-medium"
            >
              {{ section.source === 'ECHR' ? 'ECHR' : 'RS' }}
            </Badge>
          </div>
          <ChevronDown v-if="expandedSections.has(section.key)" class="h-3.5 w-3.5 text-muted-foreground/60" />
          <ChevronRight v-else class="h-3.5 w-3.5 text-muted-foreground/60" />
        </button>
        <div v-if="expandedSections.has(section.key)" class="space-y-0.5 pb-1">
          <button
            v-for="item in section.items"
            :key="item.value"
            :class="['flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent transition-colors', isActive(section, item.value) ? 'bg-accent font-medium' : '']"
            @click="() => {
              if (section.key === 'importance') {
                toggleImportanceFacet(Number(item.value))
              } else if (section.key !== 'years') {
                toggleFacetValue(section.field, item.value)
              }
            }"
          >
            <span class="truncate text-left">
              {{ formatItemValue(section, item.value) }}
            </span>
            <Badge variant="outline" class="ml-2 h-4 text-[10px] shrink-0">{{ item.count }}</Badge>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
