<script setup lang="ts">
import { computed } from 'vue'
import { Copy } from 'lucide-vue-next'
import type { QueryBuilderGroup } from '~/lib/types'
import { buildCombinedPayload } from '~/lib/api/client'
import { createDefaultSearchQuery } from '~/lib/types'

const props = defineProps<{
  group: QueryBuilderGroup
}>()

const payload = computed(() => {
  const defaults = createDefaultSearchQuery()
  const body = buildCombinedPayload(defaults, props.group, defaults.pageSize)
  return { json: JSON.stringify(body, null, 2), error: '' }
})

async function copyJson() {
  if (!payload.value.json || typeof navigator === 'undefined') return
  try {
    await navigator.clipboard.writeText(payload.value.json)
  } catch {
    // noop
  }
}
</script>

<template>
  <div class="rounded-xl border border-border/50 bg-background/80 p-4">
    <div class="flex items-center justify-between mb-2">
      <div class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Query body JSON
      </div>
      <button
        class="h-6 w-6 rounded-lg border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-all flex items-center justify-center"
        aria-label="Copy query JSON"
        @click="copyJson"
      >
        <Copy class="h-3 w-3" />
      </button>
    </div>
    <pre class="text-[11px] leading-relaxed text-foreground/80 overflow-auto max-h-72">{{ payload.json }}</pre>
    <p v-if="payload.error" class="text-xs text-destructive mt-2">{{ payload.error }}</p>
  </div>
</template>
