<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { Sparkles, X, Loader2, Search } from 'lucide-vue-next'
import SearchSuggestions from './SearchSuggestions.vue'
import { useSmartSearch } from '~/composables/useSmartSearch'
import type { ParsedToken } from '~/lib/types'
import { smartSearchChipClasses } from '~/lib/utils/smart-search-chip'
import { SEARCH_EXAMPLES } from '~/lib/utils/search-examples'

const props = withDefaults(defineProps<{
  loading?: boolean
  size?: 'default' | 'large'
  autofocus?: boolean
  chips?: boolean
}>(), {
  loading: false,
  size: 'default',
  autofocus: false,
  chips: true,
})

const emit = defineEmits<{
  submit: []
  clear: []
}>()

const smartSearch = useSmartSearch()

type EditorSegment =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'token'; token: ParsedToken }

const containerEl = ref<HTMLElement>()
const editorEl = ref<HTMLDivElement>()
const showSuggestions = ref(false)
const activeIndex = ref(-1)
const suppressRender = ref(false)
const isFocused = ref(false)
const animatedText = ref('')
const animateChar = ref(0)
let animateTimer: ReturnType<typeof setTimeout> | null = null
const shuffledExamples = ref<string[]>([])

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => editorEl.value?.focus())
  }
  shuffledExamples.value = shuffleExamples(SEARCH_EXAMPLES)
  renderEditorFromSegments(smartSearch.segments.value)
})

onBeforeUnmount(() => {
  if (animateTimer) {
    clearTimeout(animateTimer)
    animateTimer = null
  }
})

onClickOutside(containerEl, () => {
  showSuggestions.value = false
})

const topSuggestion = computed(() => smartSearch.suggestions.value[0] ?? null)
const hasParsedParameters = computed(() => smartSearch.allSuggestions.value.length > 0)

type HighlightRange = { start: number; end: number }

const highlightRanges = computed<HighlightRange[]>(() => {
  if (props.chips) return []
  const raw = smartSearch.highlightSuggestions.value
    .map((s) => ({ start: s.triggerStart, end: s.triggerEnd }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  const merged: HighlightRange[] = []
  for (const range of raw) {
    if (merged.length === 0) {
      merged.push({ ...range })
      continue
    }
    const last = merged[merged.length - 1]
    if (range.start <= last.end) {
      last.end = Math.max(last.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
})

function normalizeExampleQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

const exampleSuggestions = computed(() => {
  const query = normalizeExampleQuery(smartSearch.rawText.value)
  const pool = shuffledExamples.value.length ? shuffledExamples.value : SEARCH_EXAMPLES
  const matches = query
    ? pool.filter((item) => normalizeExampleQuery(item).includes(query))
    : pool
  return matches.slice(0, 6)
})

function genSegId() {
  return Math.random().toString(36).slice(2, 10)
}

function createTokenNode(token: ParsedToken): HTMLElement {
  const wrapper = document.createElement('span')
  wrapper.dataset.tokenId = token.id
  wrapper.dataset.tokenType = token.type
  wrapper.dataset.tokenValue = token.value
  wrapper.dataset.tokenDisplay = token.display
  wrapper.contentEditable = 'false'
  wrapper.className = [
    'smart-search-chip',
    'inline-flex',
    'items-center',
    'gap-1',
    'rounded-lg',
    'px-2',
    'py-1',
    'text-xs',
    'font-medium',
    'leading-none',
    'select-none',
    'align-middle',
    smartSearchChipClasses(token.type),
  ].join(' ')

  const label = document.createElement('span')
  label.textContent = token.display

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.dataset.removeToken = token.id
  remove.className = 'smart-search-chip-remove ml-1 rounded-md px-1 opacity-60 hover:opacity-100'
  remove.textContent = 'x'

  wrapper.append(label, remove)
  return wrapper
}

function renderHighlightedText(text: string, ranges: HighlightRange[]) {
  if (!editorEl.value) return
  let cursor = 0
  const len = text.length
  for (const range of ranges) {
    const start = Math.max(0, Math.min(range.start, len))
    const end = Math.max(0, Math.min(range.end, len))
    if (end <= start) continue
    if (start > cursor) {
      editorEl.value.append(document.createTextNode(text.slice(cursor, start)))
    }
    const span = document.createElement('span')
    span.className = 'text-primary/80 font-medium'
    span.textContent = text.slice(start, end)
    editorEl.value.append(span)
    cursor = end
  }
  if (cursor < len) {
    editorEl.value.append(document.createTextNode(text.slice(cursor)))
  }
}

function renderEditorFromSegments(segments: EditorSegment[]) {
  if (!editorEl.value) return
  const wasFocused = document.activeElement === editorEl.value
  editorEl.value.innerHTML = ''

  if (!props.chips) {
    const text = smartSearch.rawText.value
    if (text) {
      renderHighlightedText(text, highlightRanges.value)
    }
    if (wasFocused) {
      placeCaretAtEnd(editorEl.value)
    }
    return
  }

  for (const segment of segments) {
    if (segment.kind === 'text') {
      if (segment.value) editorEl.value.append(document.createTextNode(segment.value))
    } else {
      if (props.chips) {
        editorEl.value.append(createTokenNode(segment.token))
      }
    }
  }

  if (wasFocused) {
    placeCaretAtEnd(editorEl.value)
  }
}

function placeCaretAtEnd(el: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function readSegmentsFromEditor(): EditorSegment[] {
  if (!editorEl.value) return []
  const segments: EditorSegment[] = []
  const nodes = Array.from(editorEl.value.childNodes)

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) segments.push({ id: genSegId(), kind: 'text', value: text })
      continue
    }

    if (!(node instanceof HTMLElement)) continue

    if (node.dataset.tokenId) {
      const tokenId = node.dataset.tokenId
      const existing = smartSearch.confirmedTokens.value.find((t) => t.id === tokenId)
      if (existing) {
        segments.push({ id: tokenId, kind: 'token', token: existing })
      } else if (node.dataset.tokenType && node.dataset.tokenValue && node.dataset.tokenDisplay) {
        segments.push({
          id: tokenId,
          kind: 'token',
          token: {
            id: tokenId,
            type: node.dataset.tokenType as ParsedToken['type'],
            value: node.dataset.tokenValue,
            display: node.dataset.tokenDisplay,
          },
        })
      }
      continue
    }

    const text = node.textContent ?? ''
    if (text) segments.push({ id: genSegId(), kind: 'text', value: text })
  }

  return segments
}

function handleInput() {
  const segments = readSegmentsFromEditor()
  suppressRender.value = true
  smartSearch.onSegmentsChange(segments)
  showSuggestions.value = true
  activeIndex.value = -1
  nextTick(() => {
    suppressRender.value = false
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (props.chips && e.key === 'Backspace') {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (range.collapsed && editorEl.value) {
        let anchor: HTMLElement | null =
          range.startContainer instanceof HTMLElement
            ? range.startContainer
            : range.startContainer.parentElement

        while (anchor && anchor.parentElement !== editorEl.value) {
          anchor = anchor.parentElement
        }

        const previous = anchor?.previousSibling instanceof HTMLElement ? anchor.previousSibling : null
        const tokenId = previous?.dataset?.tokenId
        if (tokenId && range.startOffset === 0) {
          e.preventDefault()
          smartSearch.removeToken(tokenId)
          nextTick(() => editorEl.value?.focus())
          return
        }
      }
    }
    if (smartSearch.rawText.value.length === 0 && smartSearch.confirmedTokens.value.length > 0) {
      const lastToken = smartSearch.confirmedTokens.value[smartSearch.confirmedTokens.value.length - 1]
      smartSearch.removeToken(lastToken.id)
      return
    }
  }

  const totalSuggestions = showParsedSuggestions.value
    ? smartSearch.suggestions.value.length
    : (showExampleSuggestions.value ? exampleSuggestions.value.length : 0)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, totalSuggestions - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0) {
      if (showParsedSuggestions.value) {
        const id = smartSearch.suggestions.value[activeIndex.value].id
        if (props.chips) smartSearch.acceptSuggestion(id)
        else smartSearch.acceptSuggestionSoft(id)
        nextTick(() => editorEl.value?.focus())
      } else if (showExampleSuggestions.value) {
        selectExampleItem(exampleSuggestions.value[activeIndex.value])
      }
    } else {
      submit()
    }
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
  }
}

function selectExampleItem(text: string) {
  smartSearch.setFromText(text)
  showSuggestions.value = false
  nextTick(() => editorEl.value?.focus())
}

function submit() {
  smartSearch.parseNow()
  smartSearch.setSearchString(smartSearch.rawText.value || '')
  if (props.chips) smartSearch.acceptAllSuggestions()
  else smartSearch.acceptAllSuggestionsSoft()
  showSuggestions.value = false
  emit('submit')
}

function clear() {
  smartSearch.clearAll()
  renderEditorFromSegments([])
  emit('clear')
  nextTick(() => editorEl.value?.focus())
}

function onSuggestionSelect(id: string) {
  if (props.chips) smartSearch.acceptSuggestion(id)
  else smartSearch.acceptSuggestionSoft(id)
  nextTick(() => editorEl.value?.focus())
}

function onSuggestionReject(id: string) {
  smartSearch.rejectSuggestion(id)
  nextTick(() => editorEl.value?.focus())
}

function handleBlur() {
  isFocused.value = false
  // Delay to allow click events on suggestions to fire first,
  // then check if focus is still within the container
  globalThis.setTimeout(() => {
    if (containerEl.value && !containerEl.value.contains(document.activeElement)) {
      showSuggestions.value = false
    }
  }, 150)
}

function handleContainerClick() {
  editorEl.value?.focus()
}

const hasContent = computed(() =>
  smartSearch.confirmedTokens.value.length > 0 || smartSearch.rawText.value.length > 0
)

const dropdownSuggestions = computed(() => {
  return smartSearch.suggestions.value.map((s) => ({
    id: s.id,
    text: s.preview,
    type: suggestionTypeFromToken(s.token),
    description: s.token.display === s.preview ? undefined : s.token.display,
  }))
})

const showParsedSuggestions = computed(
  () => showSuggestions.value && smartSearch.suggestions.value.length > 0
)
const showExampleSuggestions = computed(
  () => showSuggestions.value && !hasParsedParameters.value && exampleSuggestions.value.length > 0
)
const hasQueryContext = computed(() => {
  const group = smartSearch.queryBuilderGroup.value
  const hasRules = (g: typeof group): boolean => {
    if (g.rules.some((rule) => rule.value && rule.value.trim())) return true
    if (g.groups.some((sub) => hasRules(sub))) return true
    return false
  }
  return hasRules(group)
})
const shouldAnimatePlaceholder = computed(() => {
  return !isFocused.value && !hasContent.value && !hasQueryContext.value && !showParsedSuggestions.value
})

function suggestionTypeFromToken(token: ParsedToken) {
  if (token.type.startsWith('article')) return 'article'
  if (token.type === 'respondent_state') return 'state'
  if (token.type === 'year' || token.type === 'date_start' || token.type === 'date_end') return 'date'
  if (token.type === 'document_type') return 'document'
  if (token.type === 'degree_source' || token.type === 'degree_target' || token.type === 'degree_depth' || token.type === 'subgraph') return 'graph'
  return 'tag'
}

function handleEditorClick(event: MouseEvent) {
  if (!props.chips) return
  const target = event.target as HTMLElement | null
  const removeButton = target?.closest('[data-remove-token]') as HTMLElement | null
  if (removeButton?.dataset.removeToken) {
    smartSearch.removeToken(removeButton.dataset.removeToken)
    nextTick(() => editorEl.value?.focus())
  }
}

function pickNextExample(): string {
  const pool = shuffledExamples.value.length ? shuffledExamples.value : SEARCH_EXAMPLES
  if (!pool.length) return ''
  const index = Math.floor(Math.random() * pool.length)
  return pool[index]
}

function shuffleExamples(list: string[]): string[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function stopPlaceholderAnimation() {
  if (animateTimer) {
    clearTimeout(animateTimer)
    animateTimer = null
  }
  animatedText.value = ''
  animateChar.value = 0
}

function schedulePlaceholderAnimation() {
  if (animateTimer) {
    clearTimeout(animateTimer)
    animateTimer = null
  }
  if (!shouldAnimatePlaceholder.value) {
    animatedText.value = ''
    animateChar.value = 0
    return
  }
  if (!animatedText.value) {
    animatedText.value = pickNextExample()
    animateChar.value = 0
  }

  const full = animatedText.value
  const nextCharCount = animateChar.value + 1

  if (nextCharCount <= full.length) {
    animateChar.value = nextCharCount
    animateTimer = setTimeout(schedulePlaceholderAnimation, 55)
    return
  }

  animateTimer = setTimeout(() => {
    const erase = () => {
      if (!shouldAnimatePlaceholder.value) {
        stopPlaceholderAnimation()
        return
      }
      if (animateChar.value > 0) {
        animateChar.value -= 1
        animateTimer = setTimeout(erase, 22)
      } else {
        animatedText.value = pickNextExample()
        animateTimer = setTimeout(schedulePlaceholderAnimation, 200)
      }
    }
    erase()
  }, 1200)
}

watch(
  () => smartSearch.segments.value,
  (next) => {
    if (suppressRender.value) {
      if (next.length === 0) {
        renderEditorFromSegments(next)
      }
      return
    }
    renderEditorFromSegments(next)
  },
  { deep: true }
)

watch(
  () => highlightRanges.value,
  () => {
    if (suppressRender.value || props.chips) return
    renderEditorFromSegments(smartSearch.segments.value)
  },
  { deep: true }
)

watch(
  () => shouldAnimatePlaceholder.value,
  () => {
    schedulePlaceholderAnimation()
  },
  { immediate: true }
)
</script>

<template>
  <div ref="containerEl" class="relative w-full">
    <!-- Main input container -->
    <div
      :class="[
        'group/bar flex flex-wrap items-center gap-1.5 rounded-2xl border bg-card text-foreground transition-all cursor-text',
        'shadow-sm hover:shadow-md focus-within:shadow-lg',
        'border-border/60 focus-within:border-primary/30',
        'focus-within:ring-4 focus-within:ring-primary/5',
        size === 'large' ? 'min-h-[3.75rem] px-4 py-2.5' : 'min-h-[2.75rem] px-3 py-1.5',
      ]"
      @click="handleContainerClick"
    >
      <!-- Search / Sparkles icon -->
      <div :class="['shrink-0 flex items-center justify-center', size === 'large' ? 'h-8 w-8' : 'h-6 w-6']">
        <Sparkles
          v-if="hasContent"
          :class="['text-violet-500 transition-colors', size === 'large' ? 'h-[18px] w-[18px]' : 'h-4 w-4']"
        />
        <Search
          v-else
          :class="['text-muted-foreground/40 group-focus-within/bar:text-primary/50 transition-colors', size === 'large' ? 'h-[18px] w-[18px]' : 'h-4 w-4']"
        />
      </div>

      <!-- Inline editor with chips -->
      <div class="relative flex-1 min-w-[140px]">
        <div
          ref="editorEl"
          class="smart-search-editor relative z-10 outline-none"
          :class="[
            size === 'large' ? 'text-base' : 'text-sm',
            shouldAnimatePlaceholder ? 'hide-placeholder' : ''
          ]"
          contenteditable="true"
          role="textbox"
          aria-multiline="false"
          spellcheck="false"
          :data-placeholder="shouldAnimatePlaceholder ? '' : 'Search cases, articles, countries, years...'"
          @input="handleInput"
          @keydown="handleKeydown"
          @focus="() => { isFocused = true; showSuggestions = true }"
          @blur="handleBlur"
          @click="handleEditorClick"
        />
        <div
          v-if="shouldAnimatePlaceholder"
          class="pointer-events-none absolute inset-0 flex items-center text-muted-foreground/50"
          :class="[size === 'large' ? 'text-base' : 'text-sm']"
          aria-hidden="true"
        >
          {{ animatedText.slice(0, animateChar) }}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          v-if="hasContent"
          class="flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-all"
          @click.stop="clear"
        >
          <X class="h-3.5 w-3.5" />
        </button>
        <button
          :class="[
            'flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
            size === 'large' ? 'h-10 px-5 text-sm gap-2' : 'h-8 px-3.5 text-xs gap-1.5',
          ]"
          :disabled="loading"
          @click.stop="submit"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <template v-else>
            <Search :class="size === 'large' ? 'h-4 w-4' : 'h-3.5 w-3.5'" />
            Search
          </template>
        </button>
      </div>
    </div>

    <!-- Suggestions dropdown -->
    <SearchSuggestions
      :suggestions="dropdownSuggestions"
      :examples="exampleSuggestions"
      :visible="showParsedSuggestions || showExampleSuggestions"
      :active-index="activeIndex"
      @select-suggestion="onSuggestionSelect"
      @reject-suggestion="onSuggestionReject"
      @select-example="selectExampleItem"
    />
  </div>
</template>
