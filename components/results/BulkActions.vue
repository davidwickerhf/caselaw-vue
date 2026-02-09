<script setup lang="ts">
import { Download, CheckSquare, X } from 'lucide-vue-next'

defineProps<{
  selectedCount: number
  totalCount: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  selectAll: []
  clear: []
  export: [format: 'json' | 'csv']
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Selection active -->
    <div
      v-if="selectedCount > 0"
      :class="[
        'inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5',
        disabled ? 'opacity-40 pointer-events-none' : ''
      ]"
    >
      <span class="px-2 text-[11px] font-semibold text-foreground tabular-nums">
        {{ selectedCount }} selected
      </span>
      <div class="h-4 w-px bg-border/60" />
      <button
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('export', 'csv')"
      >
        <Download class="h-3 w-3" /> CSV
      </button>
      <button
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('export', 'json')"
      >
        <Download class="h-3 w-3" /> JSON
      </button>
      <div class="h-4 w-px bg-border/60" />
      <button
        class="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('clear')"
        aria-label="Clear selection"
      >
        <X class="h-3 w-3" />
      </button>
    </div>

    <!-- No selection -->
    <button
      v-else
      :class="[
        'inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-muted/50',
        disabled ? 'opacity-40 pointer-events-none' : ''
      ]"
      :disabled="disabled"
      @click="emit('selectAll')"
    >
      <CheckSquare class="h-3 w-3" /> Select All
    </button>
  </div>
</template>
