<script setup lang="ts">
import Button from '~/components/ui/button/Button.vue'
import { ALL_DATA_SOURCES, DataSource } from '~/lib/types'
import { DATA_SOURCE_LABELS } from '~/lib/utils/sources'

const props = defineProps<{
  selected: DataSource[]
}>()

const emit = defineEmits<{
  change: [sources: DataSource[]]
}>()

const isAll = () => ALL_DATA_SOURCES.every((s) => props.selected.includes(s))
const isOnly = (source: DataSource) => props.selected.length === 1 && props.selected[0] === source

function selectAll() {
  emit('change', [...ALL_DATA_SOURCES])
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <Button
      :variant="isAll() ? 'default' : 'outline'"
      size="sm"
      class="h-8 text-xs"
      @click="selectAll"
    >
      All Sources
    </Button>
    <Button
      v-for="source in ALL_DATA_SOURCES"
      :key="source"
      :variant="isOnly(source) ? 'default' : 'outline'"
      size="sm"
      class="h-8 text-xs"
      @click="emit('change', [source])"
    >
      {{ DATA_SOURCE_LABELS[source] }}
    </Button>
  </div>
</template>
