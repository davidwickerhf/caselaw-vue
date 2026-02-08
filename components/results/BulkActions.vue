<script setup lang="ts">
import { Download, Square, X } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

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
    <div
      v-if="selectedCount > 0"
      :class="[
        'inline-flex items-center rounded-lg border border-border/60 bg-muted/30 px-2 py-1 shadow-sm',
        disabled ? 'opacity-40 pointer-events-none' : ''
      ]"
    >
      <span class="px-2 text-[11px] font-semibold text-foreground">
        {{ selectedCount }} selected
      </span>
      <div class="h-4 w-px bg-border/60" />
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('export', 'csv')"
      >
        <Download class="h-3 w-3" /> CSV
      </button>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('export', 'json')"
      >
        <Download class="h-3 w-3" /> JSON
      </button>
      <div class="h-4 w-px bg-border/60" />
      <button
        class="inline-flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('clear')"
        aria-label="Clear selection"
      >
        <X class="h-3 w-3" />
      </button>
    </div>

    <div
      v-else
      :class="[
        'inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-sm',
        disabled ? 'opacity-40 pointer-events-none' : ''
      ]"
    >
      <button
        class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-background/40"
        :disabled="disabled"
        @click="emit('selectAll')"
      >
        <Square class="h-3 w-3" /> Select All
      </button>
    </div>
  </div>
</template>
