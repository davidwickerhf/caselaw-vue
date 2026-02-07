<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import ResultCard from './ResultCard.vue'
import type { Citation } from '~/lib/types'

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
