<script setup lang="ts">
import { computed } from 'vue'
import { Code, Copy } from 'lucide-vue-next'
import type { QueryBuilderGroup } from '~/lib/types'
import { buildQuerySummarySegments } from '~/lib/utils/query-summary'

const props = withDefaults(defineProps<{
  group: QueryBuilderGroup
  class?: string
  showCopy?: boolean
  label?: string
}>(), {
  class: '',
  showCopy: true,
  label: 'Query preview',
})

const summary = computed(() =>
  buildQuerySummarySegments(props.group)
    .map((seg) => seg.text)
    .join('')
    .trim()
)

const displayText = computed(() => summary.value || 'No query parameters.')

async function copyPreview() {
  if (!summary.value || typeof navigator === 'undefined') return
  try {
    await navigator.clipboard.writeText(summary.value)
  } catch {
    // noop
  }
}
</script>

<template>
  <div :class="['rounded-lg bg-muted/40 border border-border/40 p-3', props.class]">
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-2">
        <Code class="h-3.5 w-3.5 text-muted-foreground/60" />
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {{ props.label }}
        </span>
      </div>
      <button
        v-if="props.showCopy"
        class="h-6 w-6 rounded-lg border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all flex items-center justify-center"
        aria-label="Copy query preview"
        @click="copyPreview"
      >
        <Copy class="h-3 w-3" />
      </button>
    </div>
    <code class="text-xs text-foreground/80 font-mono break-all leading-relaxed">{{ displayText }}</code>
  </div>
</template>
