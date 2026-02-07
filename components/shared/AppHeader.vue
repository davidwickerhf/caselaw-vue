<script setup lang="ts">
import { computed } from 'vue'
import { Scale, Moon, Sun } from 'lucide-vue-next'
import Button from '~/components/ui/button/Button.vue'

const props = defineProps<{
  showSearch?: boolean
  fixed?: boolean
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const headerClasses = computed(() => [
  'border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  props.fixed ? 'fixed top-0 inset-x-0 z-40' : ''
])

function toggleMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <header :class="headerClasses">
    <div class="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
      <NuxtLink to="/" class="flex items-center gap-2.5 font-semibold tracking-tight text-foreground">
        <Scale class="h-5 w-5 text-primary" />
        <span class="text-lg">LegalSearch</span>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <NuxtLink
          v-if="showSearch"
          to="/"
          target="_blank"
          rel="noopener"
          class="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          New Search
        </NuxtLink>
        <Button variant="ghost" size="icon" class="h-9 w-9" @click="toggleMode">
          <Sun v-if="isDark" class="h-4 w-4" />
          <Moon v-else class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </header>
</template>
