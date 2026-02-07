<script setup lang="ts">
import { Clock, X, Trash2 } from 'lucide-vue-next'
import Badge from '~/components/ui/badge/Badge.vue'
import Button from '~/components/ui/button/Button.vue'
import { useHistory } from '~/composables/useHistory'

const emit = defineEmits<{
  select: [text: string]
}>()

const { entries, clear, remove } = useHistory()
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
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="entry in entries.slice(0, 8)"
        :key="entry.id"
        class="group inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-accent transition-colors"
      >
        <button class="truncate max-w-[180px]" @click="emit('select', entry.text)">
          {{ entry.text }}
        </button>
        <Badge v-if="entry.resultCount !== undefined" variant="secondary" class="text-[10px] h-4 ml-1">
          {{ entry.resultCount }}
        </Badge>
        <button
          class="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="remove(entry.id)"
        >
          <X class="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  </div>
</template>
