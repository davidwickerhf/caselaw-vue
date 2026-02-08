<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'
</script>

<template>
  <span class="inline-flex items-center gap-1 rounded-lg bg-violet-50/80 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-200">
    <Sparkles class="h-3 w-3" />
    <slot>AI</slot>
  </span>
</template>
