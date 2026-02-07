<script setup lang="ts">
import { computed } from 'vue'
import { Brackets, Code, RotateCcw } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderGroupComp from './QueryBuilderGroup.vue'
import { useSmartSearch } from '~/composables/useSmartSearch'
import type { QueryBuilderGroup } from '~/lib/types'
import { QUERY_BUILDER_OPERATORS, QUERY_BUILDER_FIELDS_BY_SCOPE } from '~/lib/utils/query-builder-config'

const smartSearch = useSmartSearch()

const props = withDefaults(defineProps<{
  showToggle?: boolean
  panelClass?: string
  transition?: 'default' | 'fade' | 'none'
}>(), {
  showToggle: true,
  panelClass: '',
  transition: 'default'
})

const emit = defineEmits<{
  reset: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const SCOPE_LABELS: Record<string, string> = {
  ANY: 'Any',
  ECHR: 'ECHR',
  RS: 'Rechtspraak'
}

function groupToText(group: QueryBuilderGroup, depth: number = 0): string {
  const parts: string[] = []
  for (const rule of group.rules) {
    if (rule.value.trim()) {
      const scopeLabel = SCOPE_LABELS[rule.sourceScope || 'ANY'] || 'Any'
      const fieldLabel = QUERY_BUILDER_FIELDS_BY_SCOPE[rule.sourceScope || 'ANY']?.find((f) => f.value === rule.field)?.label || rule.field
      const opLabel = QUERY_BUILDER_OPERATORS[rule.field]?.find((o) => o.value === rule.operator)?.label || rule.operator
      parts.push(`${scopeLabel}: ${fieldLabel} ${opLabel} "${rule.value}"`)
    }
  }
  for (const sub of group.groups) {
    const subText = groupToText(sub, depth + 1)
    if (subText) parts.push(`(${subText})`)
  }
  return parts.join(` ${group.operator} `)
}

const queryPreview = computed(() => groupToText(smartSearch.queryBuilderGroup.value))
const panelClasses = computed(() => [
  'mt-4 overflow-hidden rounded-xl border border-border/60 bg-white dark:bg-background backdrop-blur-sm p-5 shadow-sm',
  props.panelClass
])
const transitionClasses = computed(() => {
  if (props.transition === 'fade') {
    return {
      enterActive: 'transition-opacity duration-200 ease-out',
      enterFrom: 'opacity-0',
      enterTo: 'opacity-100',
      leaveActive: 'transition-opacity duration-150 ease-in',
      leaveFrom: 'opacity-100',
      leaveTo: 'opacity-0'
    }
  }
  if (props.transition === 'none') {
    return {
      enterActive: '',
      enterFrom: '',
      enterTo: '',
      leaveActive: '',
      leaveFrom: '',
      leaveTo: ''
    }
  }
  return {
    enterActive: 'transition-all duration-200 ease-out',
    enterFrom: 'max-h-0 opacity-0 -translate-y-2',
    enterTo: 'max-h-[1000px] opacity-100 translate-y-0',
    leaveActive: 'transition-all duration-150 ease-in',
    leaveFrom: 'max-h-[1000px] opacity-100 translate-y-0',
    leaveTo: 'max-h-0 opacity-0 -translate-y-2'
  }
})

const ruleCount = computed(() => {
  function count(group: QueryBuilderGroup): number {
    let n = group.rules.filter((r) => r.value.trim()).length
    for (const sub of group.groups) n += count(sub)
    return n
  }
  return count(smartSearch.queryBuilderGroup.value)
})

function handleChange() {
  smartSearch.onQueryBuilderEdit(smartSearch.queryBuilderGroup.value)
}

function handleReset() {
  smartSearch.clearAll()
  emit('reset')
}
</script>

<template>
  <div class="w-full">
    <button
      v-if="props.showToggle"
      :class="[
        'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-all',
        isOpen
          ? 'bg-primary/10 text-primary border border-primary/20'
          : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 border border-transparent'
      ]"
      @click="isOpen = !isOpen"
    >
      <Brackets class="h-3.5 w-3.5" />
      Query Builder
      <span v-if="ruleCount > 0" class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
        {{ ruleCount }}
      </span>
    </button>

    <Transition
      :enter-active-class="transitionClasses.enterActive"
      :enter-from-class="transitionClasses.enterFrom"
      :enter-to-class="transitionClasses.enterTo"
      :leave-active-class="transitionClasses.leaveActive"
      :leave-from-class="transitionClasses.leaveFrom"
      :leave-to-class="transitionClasses.leaveTo"
    >
      <div v-if="isOpen" :class="panelClasses">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
              <Brackets class="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 class="text-sm font-semibold text-foreground">Query Builder</h3>
          </div>
          <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" @click="handleReset">
            <RotateCcw class="h-3 w-3" />
            Reset
          </Button>
        </div>

        <QueryBuilderGroupComp
          :group="smartSearch.queryBuilderGroup.value"
          :parent="null"
          :depth="0"
          @change="handleChange"
        />

        <!-- Preview -->
        <div v-if="queryPreview" class="mt-4 rounded-lg bg-muted/40 border border-border/40 p-3">
          <div class="flex items-center gap-2 mb-1.5">
            <Code class="h-3.5 w-3.5 text-muted-foreground/60" />
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Preview</span>
          </div>
          <code class="text-xs text-foreground/80 font-mono break-all leading-relaxed">{{ queryPreview }}</code>
        </div>
      </div>
    </Transition>
  </div>
</template>
