<script setup lang="ts">
import { computed } from 'vue'
import { Brackets, Code, RotateCcw, Check, Copy, GitBranch } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import QueryBuilderGroupComp from './QueryBuilderGroup.vue'
import { useSmartSearch } from '~/composables/useSmartSearch'
import type { QueryBuilderGroup } from '~/lib/types'
import { buildQuerySummarySegments } from '~/lib/utils/query-summary'

const smartSearch = useSmartSearch()

const props = withDefaults(defineProps<{
  showToggle?: boolean
  panelClass?: string
  transition?: 'default' | 'fade' | 'none'
  showApply?: boolean
  applyLabel?: string
}>(), {
  showToggle: true,
  panelClass: '',
  transition: 'default',
  showApply: false,
  applyLabel: 'Apply'
})

const emit = defineEmits<{
  reset: []
  apply: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })

const queryPreview = computed(() =>
  buildQuerySummarySegments(smartSearch.queryBuilderGroup.value, {
    degreesSource: smartSearch.degreesSource.value,
    degreesTarget: smartSearch.degreesTarget.value,
    isSubgraph: smartSearch.isSubgraph.value
  })
    .map((seg) => seg.text)
    .join('')
    .trim()
)
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

const degreeOptions = [0, 1, 2, 3, 4, 5]

const degreeSourceValue = computed({
  get: () => smartSearch.degreesSource.value,
  set: (value: number | string) => smartSearch.setDegrees({ source: Number(value) }, 'querybuilder')
})

const degreeTargetValue = computed({
  get: () => smartSearch.degreesTarget.value,
  set: (value: number | string) => smartSearch.setDegrees({ target: Number(value) }, 'querybuilder')
})

const subgraphValue = computed({
  get: () => smartSearch.isSubgraph.value,
  set: (value: boolean) => smartSearch.setDegrees({ isSubgraph: value }, 'querybuilder')
})

function handleChange() {
  smartSearch.onQueryBuilderEdit(smartSearch.queryBuilderGroup.value)
}

function handleReset() {
  smartSearch.clearAll()
  emit('reset')
}

function handleApply() {
  emit('apply')
}

async function copyPreview() {
  if (!queryPreview.value || typeof navigator === 'undefined') return
  try {
    await navigator.clipboard.writeText(queryPreview.value)
  } catch {
    // noop
  }
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
          <div class="flex items-center gap-2">
            <Button
              v-if="props.showApply"
              variant="default"
              size="sm"
              class="h-7 text-xs gap-1.5"
              @click="handleApply"
            >
              <Check class="h-3 w-3" />
              {{ props.applyLabel }}
            </Button>
            <Button variant="ghost" size="sm" class="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" @click="handleReset">
              <RotateCcw class="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        <QueryBuilderGroupComp
          :group="smartSearch.queryBuilderGroup.value"
          :parent="null"
          :depth="0"
          @change="handleChange"
        />

        <div class="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3">
          <div class="flex items-center gap-2 mb-2">
            <GitBranch class="h-3.5 w-3.5 text-muted-foreground/70" />
            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Graph expansion</span>
          </div>
          <div class="grid gap-3 sm:grid-cols-3 items-end">
            <div class="space-y-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Breadth (source)</label>
              <select
                v-model="degreeSourceValue"
                class="h-8 w-full rounded-lg border border-border/50 bg-background px-2 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              >
                <option v-for="opt in degreeOptions" :key="`ds-${opt}`" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Target degree</label>
              <select
                v-model="degreeTargetValue"
                class="h-8 w-full rounded-lg border border-border/50 bg-background px-2 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              >
                <option v-for="opt in degreeOptions" :key="`dt-${opt}`" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <label class="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground">
              <input v-model="subgraphValue" type="checkbox" class="h-3.5 w-3.5 rounded border-border/60 text-primary focus:ring-primary/30" />
              Subgraph only
            </label>
          </div>
          <p class="mt-2 text-[11px] text-muted-foreground/70">
            Degrees expand citation edges per dataset. Subgraph restricts edges to results in the current page.
          </p>
        </div>

        <!-- Preview -->
        <div v-if="queryPreview" class="mt-4 rounded-lg bg-muted/40 border border-border/40 p-3">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <Code class="h-3.5 w-3.5 text-muted-foreground/60" />
              <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Preview</span>
            </div>
            <button
              class="h-6 w-6 rounded-full border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all flex items-center justify-center"
              aria-label="Copy preview"
              @click="copyPreview"
            >
              <Copy class="h-3 w-3" />
            </button>
          </div>
          <code class="text-xs text-foreground/80 font-mono break-all leading-relaxed">{{ queryPreview }}</code>
        </div>
      </div>
    </Transition>
  </div>
</template>
