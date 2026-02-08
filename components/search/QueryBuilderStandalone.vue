<script setup lang="ts">
import { computed } from 'vue'
import { Brackets, RotateCcw } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderGroupComp from './QueryBuilderGroup.vue'
import type { QueryBuilderGroup } from '~/lib/types'

const props = withDefaults(defineProps<{
  group: QueryBuilderGroup
  title?: string
  panelClass?: string
  showHeader?: boolean
  showReset?: boolean
}>(), {
  title: 'Query Builder',
  panelClass: '',
  showHeader: true,
  showReset: false
})

const emit = defineEmits<{
  change: []
  reset: []
}>()

const panelClasses = computed(() => [
  'rounded-xl border border-border/60 bg-white dark:bg-background backdrop-blur-sm p-4 shadow-sm',
  props.panelClass
])

function handleReset() {
  emit('reset')
}
</script>

<template>
  <div :class="panelClasses">
    <div v-if="props.showHeader" class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
          <Brackets class="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 class="text-sm font-semibold text-foreground">{{ props.title }}</h3>
      </div>
      <Button
        v-if="props.showReset"
        variant="ghost"
        size="sm"
        class="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
        @click="handleReset"
      >
        <RotateCcw class="h-3 w-3" />
        Reset
      </Button>
    </div>

    <QueryBuilderGroupComp
      :group="props.group"
      :parent="null"
      :depth="0"
      @change="emit('change')"
    />
  </div>
</template>
