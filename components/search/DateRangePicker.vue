<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  startValue?: string
  endValue?: string
}>(), {
  startValue: '',
  endValue: '',
})

const emit = defineEmits<{
  startChange: [value: string]
  endChange: [value: string]
}>()
</script>

<template>
  <div class="space-y-2">
    <span class="text-sm font-medium text-foreground">{{ label }}</span>
    <div class="flex items-center gap-2">
      <input
        type="date"
        :value="startValue"
        @change="emit('startChange', ($event.target as HTMLInputElement).value)"
        class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <span class="text-sm text-muted-foreground">to</span>
      <input
        type="date"
        :value="endValue"
        @change="emit('endChange', ($event.target as HTMLInputElement).value)"
        class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  </div>
</template>
