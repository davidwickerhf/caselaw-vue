<script setup lang="ts">
import { ArrowUp, ArrowDown, List, LayoutGrid } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

const props = defineProps<{
  sortBy: string
  sortDirection: string
  viewMode: 'compact' | 'expanded'
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [sortBy: string, sortDirection: string]
  viewChange: [mode: 'compact' | 'expanded']
}>()

const sortOptions = [
  { value: 'date', label: 'Date' },
  { value: 'citations', label: 'Citations' }
]

function handleSort(value: string) {
  if (props.disabled) return
  if (props.sortBy === value) {
    emit('change', value, props.sortDirection === 'desc' ? 'asc' : 'desc')
  } else {
    emit('change', value, 'desc')
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <span class="text-[10px] uppercase tracking-wider text-muted-foreground/70">Sort by</span>
    <div class="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-sm">
      <button
        v-for="option in sortOptions"
        :key="option.value"
        :class="[
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold transition-all',
          sortBy === option.value
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
          disabled ? 'opacity-40 pointer-events-none' : ''
        ]"
        :disabled="disabled"
        @click="handleSort(option.value)"
      >
        {{ option.label }}
        <template v-if="sortBy === option.value">
          <ArrowDown v-if="sortDirection === 'desc'" class="h-3 w-3" />
          <ArrowUp v-else class="h-3 w-3" />
        </template>
      </button>
    </div>
    </div>

    <div class="inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-sm">
      <button
        :class="[
          'inline-flex h-7 w-7 items-center justify-center rounded-md transition-all',
          viewMode === 'expanded'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        ]"
        @click="emit('viewChange', 'expanded')"
        aria-label="Expanded view"
      >
        <LayoutGrid class="h-3.5 w-3.5" />
      </button>
      <button
        :class="[
          'inline-flex h-7 w-7 items-center justify-center rounded-md transition-all',
          viewMode === 'compact'
            ? 'bg-foreground text-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
        ]"
        @click="emit('viewChange', 'compact')"
        aria-label="Compact view"
      >
        <List class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
