<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '~/lib/utils/utils'

const props = withDefaults(defineProps<{
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}>(), {
  variant: 'default',
})

const classes = computed(() => {
  const base = 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
  const variants: Record<string, string> = {
    default: 'border-transparent bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:hover:bg-secondary/70',
    destructive: 'border-transparent bg-destructive/10 text-destructive hover:bg-destructive/15 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90',
    outline: 'text-foreground',
  }
  return cn(base, variants[props.variant])
})
</script>

<template>
  <div :class="classes" v-bind="$attrs">
    <slot />
  </div>
</template>
