<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { Sparkles, X, Loader2, Search } from 'lucide-vue-next'
import SearchSuggestions from './SearchSuggestions.vue'
import { useSmartSearch } from '~/composables/useSmartSearch'
import { useHistory } from '~/composables/useHistory'
import type { ParsedToken } from '~/lib/types'
import { smartSearchChipClasses } from '~/lib/utils/smart-search-chip'

const props = withDefaults(defineProps<{
  loading?: boolean
  size?: 'default' | 'large'
  autofocus?: boolean
}>(), {
  loading: false,
  size: 'default',
  autofocus: false,
})

const emit = defineEmits<{
  submit: []
  clear: []
}>()

const smartSearch = useSmartSearch()
const { recentTexts } = useHistory()

type EditorSegment =
  | { id: string; kind: 'text'; value: string }
  | { id: string; kind: 'token'; token: ParsedToken }

const containerEl = ref<HTMLElement>()
const editorEl = ref<HTMLDivElement>()
const showSuggestions = ref(false)
const activeIndex = ref(-1)
const suppressRender = ref(false)

onMounted(() => {
  if (props.autofocus) {
    nextTick(() => editorEl.value?.focus())
  }
  renderEditorFromSegments(smartSearch.segments.value)
})

onClickOutside(containerEl, () => {
  showSuggestions.value = false
})

const topSuggestion = computed(() => smartSearch.suggestions.value[0] ?? null)

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
  remove.className = 'smart-search-chip-remove ml-1 rounded-full px-1 opacity-60 hover:opacity-100'
  remove.textContent = 'x'

  wrapper.append(label, remove)
  return wrapper
}

function renderEditorFromSegments(segments: EditorSegment[]) {
  if (!editorEl.value) return
  const wasFocused = document.activeElement === editorEl.value
  editorEl.value.innerHTML = ''

  for (const segment of segments) {
    if (segment.kind === 'text') {
      if (segment.value) editorEl.value.append(document.createTextNode(segment.value))
    } else {
      editorEl.value.append(createTokenNode(segment.token))
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
  if (e.key === 'Backspace') {
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

  const totalSuggestions = (smartSearch.suggestions.value.length > 0 ? smartSearch.suggestions.value.length : 0)
    + Math.min(recentTexts.value.length, 3)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, totalSuggestions - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIndex.value >= 0) {
      const parserSuggestionCount = smartSearch.suggestions.value.length
      if (activeIndex.value < parserSuggestionCount) {
        smartSearch.acceptSuggestion(smartSearch.suggestions.value[activeIndex.value].id)
        nextTick(() => editorEl.value?.focus())
      } else {
        const recentIdx = activeIndex.value - parserSuggestionCount
        selectHistoryItem(recentTexts.value[recentIdx])
      }
    } else {
      submit()
    }
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
  }
}

function selectHistoryItem(text: string) {
  smartSearch.setFromText(text)
  showSuggestions.value = false
  nextTick(() => editorEl.value?.focus())
}

function submit() {
  smartSearch.setSearchString(smartSearch.rawText.value || '')
  smartSearch.acceptAllSuggestions()
  showSuggestions.value = false
  emit('submit')
}

function clear() {
  smartSearch.clearAll()
  emit('clear')
  nextTick(() => editorEl.value?.focus())
}

function onSuggestionSelect(id: string) {
  smartSearch.acceptSuggestion(id)
  nextTick(() => editorEl.value?.focus())
}

function onSuggestionReject(id: string) {
  smartSearch.rejectSuggestion(id)
  nextTick(() => editorEl.value?.focus())
}

function handleBlur() {
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

function suggestionTypeFromToken(token: ParsedToken) {
  if (token.type.startsWith('article')) return 'article'
  if (token.type === 'respondent_state') return 'state'
  if (token.type === 'year' || token.type === 'date_start' || token.type === 'date_end') return 'date'
  if (token.type === 'document_type') return 'document'
  return 'tag'
}

function handleEditorClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const removeButton = target?.closest('[data-remove-token]') as HTMLElement | null
  if (removeButton?.dataset.removeToken) {
    smartSearch.removeToken(removeButton.dataset.removeToken)
    nextTick(() => editorEl.value?.focus())
  }
}

watch(
  () => smartSearch.segments.value,
  (next) => {
    if (suppressRender.value) return
    renderEditorFromSegments(next)
  },
  { deep: true }
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
      <div
        v-once
        ref="editorEl"
        class="smart-search-editor flex-1 min-w-[140px] outline-none"
        :class="[size === 'large' ? 'text-base' : 'text-sm']"
        contenteditable="true"
        role="textbox"
        aria-multiline="false"
        spellcheck="false"
        data-placeholder="Search cases, articles, countries, years..."
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="showSuggestions = true"
        @blur="handleBlur"
        @click="handleEditorClick"
      />

      <!-- Action buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button
          v-if="hasContent"
          class="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-all"
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
      :recent-searches="recentTexts"
      :visible="showSuggestions && (dropdownSuggestions.length > 0 || recentTexts.length > 0)"
      :active-index="activeIndex"
      @select-suggestion="onSuggestionSelect"
      @reject-suggestion="onSuggestionReject"
      @select-recent="selectHistoryItem"
    />
  </div>
</template>
