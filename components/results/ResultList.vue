<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import Badge from '~/components/ui/badge/Badge.vue'
import ResultCard from './ResultCard.vue'
import type { Citation } from '~/lib/types'
import { formatDate } from '~/lib/utils/utils'

const props = defineProps<{
  results: Citation[]
  query: string
  selectedResultId?: string
  selectedIds: Set<string>
  page: number
  totalPages?: number | null
  hasNext?: boolean
  estimatedTotalPages?: number
  totalIsExact?: boolean
  disabled?: boolean
  viewMode?: 'compact' | 'expanded'
}>()

const emit = defineEmits<{
  select: [citation: Citation]
  toggle: [id: string]
  page: [page: number]
}>()

const pageNumbers = computed(() => {
  const pages: (number | '...')[] = []
  if (!props.totalPages) return pages
  if (props.totalPages <= 7) {
    for (let i = 1; i <= props.totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (props.page > 3) pages.push('...')
    for (let i = Math.max(2, props.page - 1); i <= Math.min(props.totalPages - 1, props.page + 1); i++) {
      pages.push(i)
    }
    if (props.page < props.totalPages - 2) pages.push('...')
    pages.push(props.totalPages)
  }
  return pages
})

const pageLabel = computed(() => {
  if (props.totalPages) return `Page ${props.page} of ${props.totalPages}`
  if (props.estimatedTotalPages && props.estimatedTotalPages > 0) {
    const suffix = props.totalIsExact ? '' : '+'
    return `Page ${props.page} of ${props.estimatedTotalPages}${suffix}`
  }
  return `Page ${props.page}`
})
</script>

<template>
  <div class="flex min-h-full flex-col gap-3">
    <div class="space-y-3">
      <template v-if="viewMode !== 'compact'">
        <ResultCard
          v-for="citation in results"
          :key="citation.id"
          :citation="citation"
          :query="query"
          :is-selected="selectedResultId === citation.id"
          :is-checked="selectedIds.has(citation.id)"
          @click="emit('select', citation)"
          @toggle="emit('toggle', citation.id)"
        />
      </template>

      <div v-else class="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
        <div class="grid grid-cols-[36px_minmax(220px,1fr)_110px_100px_140px_70px] gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div class="text-center">Select</div>
          <div>Case</div>
          <div>Date</div>
          <div>Source</div>
          <div>Jurisdiction</div>
          <div class="text-right">Cited</div>
        </div>
        <div class="divide-y divide-border/40">
          <div
            v-for="citation in results"
            :key="citation.id"
            :class="[
              'grid grid-cols-[36px_minmax(220px,1fr)_110px_100px_140px_70px] gap-3 px-3 py-2 text-xs transition-colors cursor-pointer',
              selectedResultId === citation.id
                ? 'bg-primary/5'
                : 'hover:bg-muted/40'
            ]"
            @click="emit('select', citation)"
          >
            <div class="flex items-center justify-center">
              <button
                :class="[
                  'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                  selectedIds.has(citation.id)
                    ? 'bg-primary border-primary'
                    : 'border-input hover:border-primary/50'
                ]"
                @click.stop="emit('toggle', citation.id)"
                aria-label="Select case"
              >
                <svg
                  v-if="selectedIds.has(citation.id)"
                  class="h-3 w-3 text-primary-foreground"
                  viewBox="0 0 12 12"
                >
                  <path d="M10 3L4.5 8.5L2 6" fill="none" stroke="currentColor" stroke-width="2" />
                </svg>
              </button>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-foreground truncate">
                {{ citation.title || citation.ecli }}
              </div>
              <div class="text-[11px] text-muted-foreground truncate">
                {{ citation.ecli }}
              </div>
            </div>
            <div class="text-[11px] text-muted-foreground">
              {{ formatDate(citation.date || citation.date_judgment || citation.date_decision || '') }}
            </div>
            <div class="flex items-center">
              <Badge
                :variant="citation.source === 'HUDOC' ? 'default' : 'secondary'"
                class="text-[10px]"
              >
                {{ citation.source === 'HUDOC' ? 'ECHR' : 'Rechtspraak' }}
              </Badge>
            </div>
            <div class="text-[11px] text-muted-foreground truncate">
              {{ citation.respondent_state || citation.instance || '—' }}
            </div>
            <div class="text-[11px] text-muted-foreground text-right">
              {{ citation.nCited }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="results.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-4xl mb-3">&#128269;</div>
        <h3 class="text-lg font-semibold text-foreground">No results found</h3>
        <p class="text-sm text-muted-foreground mt-1 max-w-sm">
          Try adjusting your search terms or removing some filters to see more results.
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="(totalPages && totalPages > 1) || hasNext || page > 1"
      class="sticky bottom-2 z-10 mt-auto flex items-center justify-center pt-6 pb-2"
    >
      <div
        :class="[
          'inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1 shadow-sm backdrop-blur-md',
          disabled ? 'opacity-40 pointer-events-none' : ''
        ]"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 rounded-full"
          :disabled="disabled || page <= 1"
          @click="disabled ? undefined : emit('page', page - 1)"
        >
          <ChevronLeft class="h-4 w-4" />
        </Button>

        <template v-if="totalPages">
          <template v-for="p in pageNumbers" :key="p">
            <span v-if="p === '...'" class="px-2 text-[11px] text-muted-foreground">...</span>
            <Button
              v-else
              :variant="page === p ? 'default' : 'ghost'"
              size="sm"
              class="h-7 w-7 rounded-full p-0 text-[11px]"
              :disabled="disabled"
              @click="disabled ? undefined : emit('page', p as number)"
            >
              {{ p }}
            </Button>
          </template>
        </template>
        <span v-else class="px-2 text-[11px] text-muted-foreground">{{ pageLabel }}</span>

        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7 rounded-full"
          :disabled="disabled || (totalPages ? page >= totalPages : !hasNext)"
          @click="disabled ? undefined : emit('page', page + 1)"
        >
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
