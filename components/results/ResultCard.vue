<script setup lang="ts">
import { computed } from 'vue'
import { ExternalLink, BookOpen, Star } from 'lucide-vue-next'
import Badge from '~/components/ui/badge/Badge.vue'
import type { Citation } from '~/lib/types'
import { formatDate, highlightText } from '~/lib/utils/utils'

const props = defineProps<{
  citation: Citation
  query?: string
  isSelected?: boolean
  isChecked?: boolean
}>()

const emit = defineEmits<{
  click: []
  toggle: []
}>()

const importanceLabel = computed(() =>
  props.citation.importance === 1
    ? 'Key case'
    : props.citation.importance === 2
      ? 'Important'
      : props.citation.importance === 3
        ? 'Moderate'
        : ''
)

const date = computed(() => props.citation.date || props.citation.date_judgment || '')

const summaryHtml = computed(() =>
  props.query ? highlightText(props.citation.summary, props.query) : props.citation.summary
)
</script>

<template>
  <div
    :class="['group relative rounded-lg border bg-card p-4 transition-all cursor-pointer hover:shadow-md', isSelected ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'border-border']"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
  >
    <!-- Checkbox -->
    <div class="absolute top-4 left-4">
      <button
        :class="['flex h-4 w-4 items-center justify-center rounded border transition-colors', isChecked ? 'bg-primary border-primary' : 'border-input hover:border-primary/50']"
        @click.stop="emit('toggle')"
      >
        <svg v-if="isChecked" class="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5L2 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </button>
    </div>

    <div class="ml-7">
      <!-- Header row -->
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <Badge :variant="citation.source === 'HUDOC' ? 'default' : 'secondary'" class="text-[10px] shrink-0">
              {{ citation.source === 'HUDOC' ? 'ECHR' : 'Rechtspraak' }}
            </Badge>
            <span v-if="importanceLabel" class="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
              <Star class="h-3 w-3 fill-current" />
              {{ importanceLabel }}
            </span>
          </div>
          <h3 class="mt-1 text-sm font-semibold text-foreground line-clamp-1">
            {{ citation.title || citation.ecli }}
          </h3>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ citation.ecli }}
          </p>
        </div>
      </div>

      <!-- Meta row -->
      <div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span>{{ formatDate(date) }}</span>
        <span v-if="citation.respondent_state" class="flex items-center gap-1">
          <span class="h-1 w-1 rounded-full bg-muted-foreground"></span>
          {{ citation.respondent_state }}
        </span>
        <span v-if="citation.instance && citation.source === 'Rechtspraak'" class="flex items-center gap-1">
          <span class="h-1 w-1 rounded-full bg-muted-foreground"></span>
          {{ citation.instance }}
        </span>
        <span class="flex items-center gap-1">
          <BookOpen class="h-3 w-3" />
          {{ citation.nCited }} cited
        </span>
      </div>

      <!-- Summary -->
      <p class="mt-2 text-sm text-foreground/80 line-clamp-2" v-html="summaryHtml"></p>

      <!-- Article badges -->
      <div v-if="citation.article_violated && citation.article_violated.length > 0" class="mt-2.5 flex flex-wrap gap-1">
        <Badge
          v-for="article in citation.article_violated.slice(0, 5)"
          :key="article"
          variant="outline"
          class="text-[10px] h-5 bg-red-50/70 text-red-700 border-red-200/70 dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/60"
        >
          Art. {{ article }}
        </Badge>
        <Badge v-if="citation.article_violated.length > 5" variant="outline" class="text-[10px] h-5">
          +{{ citation.article_violated.length - 5 }} more
        </Badge>
      </div>

      <!-- Keywords -->
      <div v-if="citation.keywords && citation.keywords.length > 0" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="keyword in citation.keywords.slice(0, 4)"
          :key="keyword"
          class="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
        >
          {{ keyword }}
        </span>
      </div>
    </div>
  </div>
</template>
