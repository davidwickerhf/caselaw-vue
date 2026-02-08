<script setup lang="ts">
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
import Badge from '~/components/ui/badge/Badge.vue'
import Button from '~/components/ui/button/Button.vue'
import { ECHR_ARTICLES } from '~/lib/utils/constants'

const props = defineProps<{
  label: string
  selected: string[]
}>()

const emit = defineEmits<{
  change: [articles: string[]]
}>()

const searchText = ref('')
const isOpen = ref(false)

const filtered = computed(() =>
  searchText.value.length >= 1
    ? ECHR_ARTICLES.filter(
        (a) =>
          a.number.toLowerCase().includes(searchText.value.toLowerCase()) ||
          a.title.toLowerCase().includes(searchText.value.toLowerCase())
      )
    : []
)

function toggle(articleNumber: string) {
  if (props.selected.includes(articleNumber)) {
    emit('change', props.selected.filter((a) => a !== articleNumber))
  } else {
    emit('change', [...props.selected, articleNumber])
    searchText.value = ''
  }
}

function removeAll() {
  emit('change', [])
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-foreground">{{ label }}</span>
      <Button v-if="selected.length > 0" variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="removeAll">
        Clear
      </Button>
    </div>

    <div v-if="selected.length > 0" class="flex flex-wrap gap-1">
      <Badge v-for="articleNum in selected" :key="articleNum" variant="secondary" class="gap-1 pr-1">
        Art. {{ articleNum }}
        <button class="ml-0.5 rounded-md hover:bg-muted-foreground/20" @click="toggle(articleNum)">
          <X class="h-3 w-3" />
        </button>
      </Badge>
    </div>

    <div class="relative">
      <input
        type="text"
        v-model="searchText"
        @focus="isOpen = true"
        @blur="setTimeout(() => isOpen = false, 200)"
        placeholder="Search articles (e.g., 3, 6, 10, P1-1)..."
        class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div v-if="isOpen && filtered.length > 0" class="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
        <button
          v-for="article in filtered.slice(0, 20)"
          :key="article.number"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left transition-colors"
          @mousedown.prevent="toggle(article.number)"
        >
          <div :class="['flex h-4 w-4 items-center justify-center rounded border shrink-0', selected.includes(article.number) ? 'bg-primary border-primary' : 'border-input']">
            <svg v-if="selected.includes(article.number)" class="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12"><path d="M10 3L4.5 8.5L2 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </div>
          <span class="truncate">{{ article.title }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
