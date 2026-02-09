<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, ChevronRight, X, Filter } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
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
    const labels: Record<number, string> = { 1: 'Key case', 2: 'Important', 3: 'Moderate', 4: 'Low' }
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
    if (current.includes(internal)) {
      emit('change', { [field]: current.filter((v) => v !== internal) })
    } else {
      emit('change', { [field]: [...current, internal] })
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

const sections = computed<FacetSection[]>(() =>
  ([
    { key: 'sources', label: 'Source', source: 'all' as SourceScope, items: props.facets.sources, field: 'sources' as keyof SearchQuery, activeValues: (props.query.sources?.length ?? 0) >= 2 ? [] : (props.query.sources || []).map((s) => SOURCE_INTERNAL_TO_DISPLAY[s] || s) },
    { key: 'documentTypes', label: 'Document Type', source: 'all' as SourceScope, items: props.facets.documentTypes, field: 'documentType' as keyof SearchQuery, activeValues: props.query.documentType },
    { key: 'articles', label: 'Articles Violated', source: 'ECHR' as SourceScope, items: props.facets.articles.slice(0, 15), field: 'articleViolated' as keyof SearchQuery, activeValues: props.query.articleViolated, formatValue: (v: string) => `Art. ${v}` },
    { key: 'articlesApplied', label: 'Articles Applied', source: 'ECHR' as SourceScope, items: (props.facets.articlesApplied ?? []).slice(0, 15), field: 'articleApplied' as keyof SearchQuery, activeValues: props.query.articleApplied, formatValue: (v: string) => `Art. ${v}` },
    { key: 'articlesNonViolated', label: 'Articles Not Violated', source: 'ECHR' as SourceScope, items: (props.facets.articlesNonViolated ?? []).slice(0, 15), field: 'articleNonViolated' as keyof SearchQuery, activeValues: props.query.articleNonViolated, formatValue: (v: string) => `Art. ${v}` },
    { key: 'respondentStates', label: 'Respondent State', source: 'ECHR' as SourceScope, items: props.facets.respondentStates.slice(0, 15), field: 'respondentState' as keyof SearchQuery, activeValues: props.query.respondentState },
    { key: 'importance', label: 'Importance', source: 'ECHR' as SourceScope, items: props.facets.importance, field: 'importance' as keyof SearchQuery, activeValues: props.query.importance, isNumeric: true },
    { key: 'years', label: 'Year', source: 'all' as SourceScope, items: props.facets.years.slice(0, 10), field: 'dateStart' as keyof SearchQuery, activeValues: [] },
    { key: 'instances', label: 'Court Instance', source: 'RS' as SourceScope, items: props.facets.instances.slice(0, 10), field: 'instances' as keyof SearchQuery, activeValues: props.query.instances },
    { key: 'domains', label: 'Legal Domain', source: 'RS' as SourceScope, items: props.facets.domains.slice(0, 10), field: 'domains' as keyof SearchQuery, activeValues: props.query.domains }
  ] as FacetSection[]).filter((s) => s.items.length > 0)
)

function getImportanceLabel(value: string): string {
  const labels: Record<string, string> = { '1': 'Key case', '2': 'Important', '3': 'Moderate', '4': 'Low' }
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
    <Button variant="outline" size="sm" class="gap-1.5 ml-4" @click="emit('toggleCollapse')">
      <Filter class="h-3.5 w-3.5" />
      Filters
    </Button>
  </template>
  <div v-else class="flex h-full w-full shrink-0 flex-col">
    <div class="flex items-center justify-between mb-2 px-4">
      <h3 class="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Filter class="h-4 w-4" />
        Filters
      </h3>
      <Button variant="ghost" size="sm" class="h-7 text-xs" @click="emit('toggleCollapse')">
        Hide
      </Button>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilters.length > 0" class="flex flex-wrap gap-1 pb-3 px-4">
      <Badge v-for="(chip, i) in activeFilters" :key="i" variant="secondary" class="gap-1 pr-1 text-[10px]">
        {{ chip.label }}
        <button class="ml-0.5 rounded-md hover:bg-muted-foreground/20" @click="chip.onremove()">
          <X class="h-2.5 w-2.5" />
        </button>
      </Badge>
    </div>

    <!-- Separator (always visible) -->
    <div class="h-px bg-border" />

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
