<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ExternalLink, BookOpen, Star, Calendar, MapPin,
  FileText, Tag, Scale, Search, Copy, Check, X
} from 'lucide-vue-next'
import Sheet from '~/components/ui/sheet/Sheet.vue'
import Badge from '~/components/ui/badge/Badge.vue'
import Button from '~/components/ui/button/Button.vue'
import Separator from '~/components/ui/separator/Separator.vue'
import type { Citation } from '~/lib/types'
import { formatDate } from '~/lib/utils/utils'

const props = defineProps<{
  citation: Citation | null
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  findSimilar: [citation: Citation]
}>()

const copied = ref(false)

function copyEcli() {
  if (!props.citation) return
  navigator.clipboard.writeText(props.citation.ecli)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const date = computed(() => props.citation?.date || props.citation?.date_judgment || '')
const importanceLabel = computed(() =>
  props.citation?.importance === 1
    ? 'Key case'
    : props.citation?.importance === 2
      ? 'Important'
      : props.citation?.importance === 3
        ? 'Moderate'
        : props.citation?.importance === 4
          ? 'Low importance'
          : ''
)
</script>

<template>
  <Sheet
    :open="open"
    side="right"
    class="w-[440px] overflow-y-auto sm:max-w-[440px]"
    @update:open="(v) => { if (!v) emit('close') }"
  >
    <template v-if="citation">
      <!-- Header -->
      <div class="pb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <Badge :variant="citation.source === 'HUDOC' ? 'default' : 'secondary'" class="text-xs">
              {{ citation.source === 'HUDOC' ? 'ECHR' : 'Rechtspraak' }}
            </Badge>
            <span v-if="importanceLabel" class="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
              <Star class="h-3 w-3 fill-current" />
              {{ importanceLabel }}
            </span>
          </div>
          <Button variant="ghost" size="icon" class="h-7 w-7" @click="emit('close')">
            <X class="h-4 w-4" />
          </Button>
        </div>
        <h2 class="text-base font-semibold leading-tight">
          {{ citation.title || citation.ecli }}
        </h2>
        <div class="flex items-center gap-1 mt-1">
          <code class="text-xs text-muted-foreground font-mono">{{ citation.ecli }}</code>
          <Button variant="ghost" size="icon" class="h-5 w-5" @click="copyEcli">
            <Check v-if="copied" class="h-3 w-3 text-emerald-500" />
            <Copy v-else class="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div class="space-y-4">
        <!-- Metadata grid -->
        <div class="grid grid-cols-2 gap-3">
          <div v-if="date" class="flex items-center gap-2 text-sm">
            <Calendar class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">Date</div>
              <div class="font-medium">{{ formatDate(date) }}</div>
            </div>
          </div>
          <div v-if="citation.respondent_state" class="flex items-center gap-2 text-sm">
            <MapPin class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">State</div>
              <div class="font-medium">{{ citation.respondent_state }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <FileText class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">Type</div>
              <div class="font-medium">{{ citation.document_type }}</div>
            </div>
          </div>
          <div v-if="citation.instance" class="flex items-center gap-2 text-sm">
            <Scale class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">Instance</div>
              <div class="font-medium">{{ citation.instance }}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <BookOpen class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">Citations</div>
              <div class="font-medium">{{ citation.nCited }} cited · {{ citation.nCiting }} citing</div>
            </div>
          </div>
          <div v-if="citation.domain" class="flex items-center gap-2 text-sm">
            <Tag class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <div class="text-[10px] text-muted-foreground">Domain</div>
              <div class="font-medium">{{ citation.domain }}</div>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Conclusion -->
        <div v-if="citation.conclusion">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Conclusion</h4>
          <p class="text-sm text-foreground">{{ citation.conclusion }}</p>
        </div>

        <!-- Summary -->
        <div>
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Summary</h4>
          <p class="text-sm text-foreground/80 leading-relaxed">{{ citation.summary }}</p>
        </div>

        <!-- Articles -->
        <div v-if="citation.article_violated && citation.article_violated.length > 0">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Articles Violated</h4>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="article in citation.article_violated" :key="article" variant="outline" class="text-xs bg-red-50/70 text-red-700 border-red-200/70 dark:bg-red-950/35 dark:text-red-200 dark:border-red-800/60">
              Art. {{ article }}
            </Badge>
          </div>
        </div>

        <div v-if="citation.article_applied && citation.article_applied.length > 0">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Articles Applied</h4>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="article in citation.article_applied" :key="article" variant="outline" class="text-xs bg-blue-50/70 text-blue-700 border-blue-200/70 dark:bg-blue-950/35 dark:text-blue-200 dark:border-blue-800/60">
              Art. {{ article }}
            </Badge>
          </div>
        </div>

        <div v-if="citation.article_non_violated && citation.article_non_violated.length > 0">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Articles Non-Violated</h4>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="article in citation.article_non_violated" :key="article" variant="outline" class="text-xs bg-emerald-50/70 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/35 dark:text-emerald-200 dark:border-emerald-800/60">
              Art. {{ article }}
            </Badge>
          </div>
        </div>

        <!-- Keywords -->
        <div v-if="citation.keywords && citation.keywords.length > 0">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Keywords</h4>
          <div class="flex flex-wrap gap-1">
            <Badge v-for="keyword in citation.keywords" :key="keyword" variant="secondary" class="text-xs">{{ keyword }}</Badge>
          </div>
        </div>

        <!-- Topics -->
        <div v-if="citation.topics">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Topics</h4>
          <p class="text-sm text-foreground/80">{{ citation.topics }}</p>
        </div>

        <Separator />

        <!-- Actions -->
        <div class="flex flex-col gap-2">
          <Button variant="outline" size="sm" class="justify-start gap-2" @click="window.open(citation!.url_publication, '_blank')">
            <ExternalLink class="h-3.5 w-3.5" />
            View Original Document
          </Button>
          <Button variant="outline" size="sm" class="justify-start gap-2" @click="emit('findSimilar', citation!)">
            <Search class="h-3.5 w-3.5" />
            Find Similar Cases
          </Button>
        </div>
      </div>
    </template>
  </Sheet>
</template>
