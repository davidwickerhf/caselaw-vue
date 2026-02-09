<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Clock, Search, X, Trash2 } from 'lucide-vue-next'
import Badge from '~/components/ui/badge/Badge.vue'
import Button from '~/components/ui/button/Button.vue'
import { useHistory, type HistoryEntry } from '~/composables/useHistory'

const emit = defineEmits<{
  select: [entry: HistoryEntry]
}>()

const { entries, clear, remove } = useHistory()
const showAll = ref(false)
const maxVisible = 6

const visibleEntries = computed(() =>
  showAll.value ? entries.value : entries.value.slice(0, maxVisible)
)

function entryLabel(entry: HistoryEntry) {
  return (entry.mode ?? 'text') === 'advanced' ? 'Advanced search' : 'Search string'
}

function displayText(entry: HistoryEntry) {
  return entry.text?.trim() || 'Advanced search'
}

function formatTimestamp(timestamp: number) {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(timestamp).toLocaleDateString()
}
</script>

<template>
  <div v-if="entries.length > 0" class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Clock class="h-3 w-3" />
        Recent Searches
      </span>
      <Button variant="ghost" size="sm" class="h-6 px-2 text-[10px] text-muted-foreground" @click="clear()">
        <Trash2 class="h-3 w-3 mr-1" />
        Clear
      </Button>
    </div>

    <ul class="space-y-2">
      <li
        v-for="entry in visibleEntries"
        :key="entry.id"
        class="group flex items-center gap-2"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:border-primary/20 hover:bg-accent/50 hover:text-foreground hover:shadow-sm"
          @click="emit('select', entry)"
        >
          <Search class="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
          <span class="truncate text-[13px] font-medium text-foreground/90">
            {{ displayText(entry) }}
          </span>
          <span class="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <Badge v-if="entry.resultCount !== undefined" variant="secondary" class="text-[10px] h-4 px-1.5">
              {{ entry.resultCount }}
            </Badge>
            <span class="whitespace-nowrap">{{ formatTimestamp(entry.timestamp) }}</span>
            <ArrowRight class="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
          </span>
        </button>
        <button
          type="button"
          class="text-muted-foreground/40 hover:text-foreground transition-colors"
          @click.stop="remove(entry.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </li>
    </ul>

    <div v-if="entries.length > maxVisible" class="flex justify-center">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-[11px] text-muted-foreground"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : `Show all (${entries.length})` }}
      </Button>
    </div>
  </div>
</template>
