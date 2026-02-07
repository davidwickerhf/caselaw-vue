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
  totalPages: number
}>()

const emit = defineEmits<{
  select: [citation: Citation]
  toggle: [id: string]
  page: [page: number]
}>()

const pageNumbers = computed(() => {
  const pages: (number | '...')[] = []
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
</script>

<template>
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

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-1 pt-4 pb-2">
      <Button
        variant="outline"
        size="icon"
        class="h-8 w-8"
        :disabled="page <= 1"
        @click="emit('page', page - 1)"
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>

      <template v-for="p in pageNumbers" :key="p">
        <span v-if="p === '...'" class="px-2 text-sm text-muted-foreground">...</span>
        <Button
          v-else
          :variant="page === p ? 'default' : 'outline'"
          size="sm"
          class="h-8 w-8 p-0"
          @click="emit('page', p as number)"
        >
          {{ p }}
        </Button>
      </template>

      <Button
        variant="outline"
        size="icon"
        class="h-8 w-8"
        :disabled="page >= totalPages"
        @click="emit('page', page + 1)"
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
