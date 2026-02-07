<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, X, Loader2 } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'
import SearchSuggestions from './SearchSuggestions.vue'
import { SEARCH_EXAMPLES } from '~/lib/utils/search-examples'

const props = withDefaults(defineProps<{
  loading?: boolean
  size?: 'default' | 'large'
  autofocus?: boolean
}>(), {
  loading: false,
  size: 'default',
  autofocus: false,
})

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{
  submit: [text: string]
}>()

const showSuggestions = ref(false)
const suggestions = ref<{ text: string; type: string; description?: string }[]>([])
const activeIndex = ref(-1)
const inputEl = ref<HTMLInputElement>()

function normalizeExampleQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

const exampleSuggestions = computed(() => {
  const query = normalizeExampleQuery(model.value)
  const pool = SEARCH_EXAMPLES
  const matches = query
    ? pool.filter((item) => normalizeExampleQuery(item).includes(query))
    : pool
  return matches.slice(0, 6)
})

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement
  model.value = target.value
  showSuggestions.value = true
  activeIndex.value = -1
  suggestions.value = []
}

function handleKeydown(e: KeyboardEvent) {
  const total = suggestions.value.length > 0 ? suggestions.value.length : exampleSuggestions.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, total - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0) {
      if (suggestions.value.length > 0) {
        selectSuggestion(suggestions.value[activeIndex.value].text)
      } else {
        selectExample(exampleSuggestions.value[activeIndex.value])
      }
    } else {
      submit()
    }
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
  }
}

function selectSuggestion(text: string) {
  model.value = text
  showSuggestions.value = false
  submit()
}

function submit() {
  showSuggestions.value = false
  emit('submit', model.value)
}

function selectExample(text: string) {
  model.value = text
  showSuggestions.value = false
  submit()
}

function clear() {
  model.value = ''
  inputEl.value?.focus()
}
</script>

<template>
  <div class="relative w-full" role="combobox" :aria-expanded="showSuggestions" aria-controls="search-suggestions" aria-haspopup="listbox">
    <div class="relative flex items-center">
      <Search :class="['absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none', size === 'large' ? 'left-4 h-5 w-5' : '']" />
      <input
        ref="inputEl"
        type="text"
        :value="model"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="showSuggestions = true"
        @blur="setTimeout(() => showSuggestions = false, 200)"
        placeholder="Search cases, articles, keywords..."
        :class="['w-full rounded-lg border border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', size === 'large' ? 'h-14 pl-12 pr-24 text-lg' : 'h-10 pl-10 pr-20 text-sm']"
        :autofocus="autofocus"
      />
      <div class="absolute right-2 flex items-center gap-1">
        <Button v-if="model" variant="ghost" size="icon" class="h-7 w-7" @click="clear">
          <X class="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          :class="size === 'large' ? 'h-9 px-4' : 'h-7 px-3 text-xs'"
          :disabled="loading"
          @click="submit"
        >
          <Loader2 v-if="loading" class="h-3.5 w-3.5 animate-spin" />
          <template v-else>Search</template>
        </Button>
      </div>
    </div>
    <SearchSuggestions
      :suggestions="[]"
      :examples="exampleSuggestions"
      :visible="showSuggestions"
      :active-index="activeIndex"
      @select-example="selectExample"
    />
  </div>
</template>
