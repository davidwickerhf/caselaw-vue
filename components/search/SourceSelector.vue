<script setup lang="ts">
import Button from '~/components/ui/button/Button.vue'
import { DataSource } from '~/lib/types'

const props = defineProps<{
  selected: DataSource[]
}>()

const emit = defineEmits<{
  change: [sources: DataSource[]]
}>()

function toggle(source: DataSource) {
  if (props.selected.includes(source)) {
    if (props.selected.length > 1) {
      emit('change', props.selected.filter((s) => s !== source))
    }
  } else {
    emit('change', [...props.selected, source])
  }
}

function selectAll() {
  emit('change', [DataSource.ECHR, DataSource.RS])
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <Button
      :variant="selected.includes(DataSource.ECHR) && selected.includes(DataSource.RS) ? 'default' : 'outline'"
      size="sm"
      class="h-8 text-xs"
      @click="selectAll"
    >
      All Sources
    </Button>
    <Button
      :variant="selected.includes(DataSource.ECHR) && !selected.includes(DataSource.RS) ? 'default' : 'outline'"
      size="sm"
      class="h-8 text-xs"
      @click="emit('change', [DataSource.ECHR])"
    >
      ECHR
    </Button>
    <Button
      :variant="selected.includes(DataSource.RS) && !selected.includes(DataSource.ECHR) ? 'default' : 'outline'"
      size="sm"
      class="h-8 text-xs"
      @click="emit('change', [DataSource.RS])"
    >
      Rechtspraak
    </Button>
  </div>
</template>
