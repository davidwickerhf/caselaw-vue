<script setup lang="ts">
import { computed } from 'vue'
import { X, Scale, MapPin, Calendar, FileText, Star, Database, Building, Briefcase, Tag } from 'lucide-vue-next'
import type { ParsedToken } from '~/lib/types'
import { smartSearchChipClasses } from '~/lib/utils/smart-search-chip'

const props = withDefaults(defineProps<{
  token: ParsedToken
  removable?: boolean
  size?: 'default' | 'compact'
  variant?: 'default' | 'summary'
}>(), {
  removable: true,
  size: 'default',
  variant: 'default'
})

const emit = defineEmits<{
  remove: []
}>()

const colorClasses = computed(() => smartSearchChipClasses(props.token.type, props.variant))

const sizeClasses = computed(() => {
  return props.size === 'compact'
    ? 'px-2 py-1 text-[11px]'
    : 'px-2.5 py-1.5 text-xs'
})

const icon = computed(() => {
  switch (props.token.type) {
    case 'article_violated':
    case 'article_applied':
    case 'article_non_violated':
      return Scale
    case 'respondent_state':
      return MapPin
    case 'year':
    case 'date_start':
    case 'date_end':
      return Calendar
    case 'document_type':
      return FileText
    case 'importance':
      return Star
    case 'source':
      return Database
    case 'instance':
      return Building
    case 'domain':
      return Briefcase
    case 'keyword':
      return Tag
    default:
      return FileText
  }
})
</script>

<template>
  <span
    :class="[
      'group/chip inline-flex items-center gap-1 rounded-lg font-medium leading-none transition-all select-none',
      'hover:shadow-sm',
      sizeClasses,
      colorClasses,
    ]"
  >
    <component :is="icon" class="h-3 w-3 shrink-0 opacity-60" />
    <span class="truncate max-w-[160px]">{{ token.display }}</span>
    <button
      v-if="removable"
      class="-mr-0.5 ml-0.5 flex items-center justify-center h-4 w-4 rounded-full opacity-40 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/15 transition-all focus:outline-none"
      @click.stop="emit('remove')"
    >
      <X class="h-2.5 w-2.5" />
    </button>
  </span>
</template>
