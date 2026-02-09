<script setup lang="ts">
import { ref } from 'vue'
import { Sparkles, Loader2 } from 'lucide-vue-next'
import AiBadge from '~/components/shared/AiBadge.vue'

defineProps<{
  total: number
  totalIsExact?: boolean
  rsTotal?: number
  echrTotal?: number
  hasMore?: boolean
  loadingMore?: boolean
  aiSummary?: string
  didYouMean?: string
}>()

const emit = defineEmits<{
  didYouMean: [text: string]
}>()

const summaryExpanded = ref(false)
</script>

<template>
  <div class="space-y-2">
    <!-- Result count line -->
    <div class="flex items-center gap-2 flex-wrap">
      <slot name="countPrefix" />

      <div class="flex items-baseline gap-1.5 text-xs text-muted-foreground">
        <span class="text-sm font-semibold text-foreground tabular-nums">
          <template v-if="totalIsExact || !hasMore">{{ total }}</template>
          <template v-else>{{ total }}+</template>
        </span>
        <span>result{{ total !== 1 ? 's' : '' }}</span>
        <template v-if="rsTotal != null && echrTotal != null">
          <span class="text-muted-foreground/50">&middot;</span>
          <span class="tabular-nums">{{ rsTotal }}</span>
          <span class="text-muted-foreground/60">RS</span>
          <span class="text-muted-foreground/50">&middot;</span>
          <span class="tabular-nums">{{ echrTotal }}</span>
          <span class="text-muted-foreground/60">ECHR</span>
        </template>
      </div>

      <span v-if="loadingMore" class="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 ml-1">
        <Loader2 class="h-3 w-3 animate-spin" />
      </span>
    </div>

    <!-- Did you mean -->
    <div v-if="didYouMean" class="text-xs text-muted-foreground">
      Did you mean:
      <button
        class="font-medium text-primary hover:underline"
        @click="emit('didYouMean', didYouMean!)"
      >
        {{ didYouMean }}
      </button>
      ?
    </div>

    <!-- AI Summary -->
    <div v-if="aiSummary" class="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
      <div class="flex items-start gap-2">
        <Sparkles class="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-semibold text-violet-700 dark:text-violet-300">AI Summary</span>
            <AiBadge />
          </div>
          <p :class="['text-sm text-foreground/80', summaryExpanded ? '' : 'line-clamp-2']">
            {{ aiSummary }}
          </p>
          <button
            v-if="aiSummary.length > 150"
            class="mt-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
            @click="summaryExpanded = !summaryExpanded"
          >
            {{ summaryExpanded ? 'Show less' : 'Show more' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
