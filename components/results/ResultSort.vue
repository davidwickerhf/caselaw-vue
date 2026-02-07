<script setup lang="ts">
import { ArrowUp, ArrowDown, List, LayoutGrid } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

const props = defineProps<{
  sortBy: string
  sortDirection: string
  viewMode: 'compact' | 'expanded'
}>()

const emit = defineEmits<{
  change: [sortBy: string, sortDirection: string]
  viewChange: [mode: 'compact' | 'expanded']
}>()

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'citations', label: 'Citations' },
  { value: 'importance', label: 'Importance' }
]

function handleSort(value: string) {
  if (props.sortBy === value) {
    emit('change', value, props.sortDirection === 'desc' ? 'asc' : 'desc')
  } else {
    emit('change', value, 'desc')
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-1">
      <span class="text-xs text-muted-foreground mr-1">Sort:</span>
      <Button
        v-for="option in sortOptions"
        :key="option.value"
        :variant="sortBy === option.value ? 'secondary' : 'ghost'"
        size="sm"
        class="h-7 text-xs gap-1"
        @click="handleSort(option.value)"
      >
        {{ option.label }}
        <template v-if="sortBy === option.value">
          <ArrowDown v-if="sortDirection === 'desc'" class="h-3 w-3" />
          <ArrowUp v-else class="h-3 w-3" />
        </template>
      </Button>
    </div>

    <div class="flex items-center gap-1">
      <Button
        :variant="viewMode === 'expanded' ? 'secondary' : 'ghost'"
        size="icon"
        class="h-7 w-7"
        @click="emit('viewChange', 'expanded')"
      >
        <LayoutGrid class="h-3.5 w-3.5" />
      </Button>
      <Button
        :variant="viewMode === 'compact' ? 'secondary' : 'ghost'"
        size="icon"
        class="h-7 w-7"
        @click="emit('viewChange', 'compact')"
      >
        <List class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
