<script setup lang="ts">
import { Download, Square, X } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

defineProps<{
  selectedCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  selectAll: []
  clear: []
  export: [format: 'json' | 'csv']
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div v-if="selectedCount > 0" class="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
      <span class="text-xs font-medium">{{ selectedCount }} selected</span>
      <Button variant="ghost" size="sm" class="h-6 px-2 text-xs gap-1" @click="emit('export', 'csv')">
        <Download class="h-3 w-3" /> CSV
      </Button>
      <Button variant="ghost" size="sm" class="h-6 px-2 text-xs gap-1" @click="emit('export', 'json')">
        <Download class="h-3 w-3" /> JSON
      </Button>
      <Button variant="ghost" size="icon" class="h-6 w-6" @click="emit('clear')">
        <X class="h-3 w-3" />
      </Button>
    </div>
    <Button v-else variant="ghost" size="sm" class="h-7 text-xs gap-1" @click="emit('selectAll')">
      <Square class="h-3 w-3" /> Select All
    </Button>
  </div>
</template>
