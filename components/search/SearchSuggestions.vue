<script setup lang="ts">
import { computed } from 'vue'
import { Sparkles, Scale, MapPin, Calendar, FileText, Tag, GitBranch } from 'lucide-vue-next'

interface Suggestion {
  id: string
  text: string
  type: string
  description?: string
}

const props = defineProps<{
  suggestions: Suggestion[]
  examples: string[]
  visible: boolean
  activeIndex: number
}>()

const emit = defineEmits<{
  selectSuggestion: [id: string]
  rejectSuggestion: [id: string]
  selectExample: [text: string]
}>()
const showExamples = computed(() => props.suggestions.length === 0 && props.examples.length > 0)

function suggestionIcon(type: string) {
  if (type === 'article') return Scale
  if (type === 'state') return MapPin
  if (type === 'date') return Calendar
  if (type === 'document') return FileText
  if (type === 'graph') return GitBranch
  if (type === 'tag') return Tag
  return Sparkles
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 translate-y-1 scale-[0.98]"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-1 scale-[0.98]"
  >
    <div
      v-if="visible && (suggestions.length > 0 || examples.length > 0)"
      class="absolute top-full left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl shadow-black/[0.08] dark:shadow-black/30"
    >
      <template v-if="suggestions.length > 0">
        <div class="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Parsed Search Parameters</div>
        <button
          v-for="(suggestion, i) in suggestions"
          :key="suggestion.id"
          :class="[
            'flex w-full items-center gap-3 px-3.5 py-2.5 text-sm text-left transition-colors',
            activeIndex === i ? 'bg-accent/70' : 'hover:bg-accent/40',
          ]"
          @mousedown.prevent="emit('selectSuggestion', suggestion.id)"
        >
          <div class="flex items-center justify-center h-7 w-7 rounded-lg bg-violet-100/60 dark:bg-violet-900/30 shrink-0">
            <component :is="suggestionIcon(suggestion.type)" class="h-3.5 w-3.5 text-violet-500 dark:text-violet-400" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-foreground">{{ suggestion.text }}</div>
            <div v-if="suggestion.description" class="truncate text-xs text-muted-foreground/70 mt-0.5">
              {{ suggestion.description }}
            </div>
          </div>
          <div class="hidden sm:inline-flex items-center gap-1">
            <button
              class="inline-flex h-5 items-center rounded-md border border-border/50 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground/80"
              @mousedown.prevent.stop="emit('rejectSuggestion', suggestion.id)"
            >
              x
            </button>
          </div>
        </button>
      </template>
      <template v-if="showExamples">
        <div class="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Try a search</div>
        <button
          v-for="(example, i) in examples"
          :key="'example-' + i"
          :class="[
            'flex w-full items-center gap-3 px-3.5 py-2.5 text-sm text-left transition-colors',
            activeIndex === i ? 'bg-accent/70' : 'hover:bg-accent/40',
          ]"
          @mousedown.prevent="emit('selectExample', example)"
        >
          <div class="flex items-center justify-center h-7 w-7 rounded-lg bg-muted/60 shrink-0">
            <Sparkles class="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          <span class="truncate text-foreground/80">{{ example }}</span>
        </button>
      </template>
      <div class="h-1" />
    </div>
  </Transition>
</template>
