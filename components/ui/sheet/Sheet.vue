<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
  side?: 'left' | 'right'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

function close() {
  emit('update:open', false)
}

function handleOverlayClick() {
  close()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

if (import.meta.client) {
  watch(() => props.open, (val) => {
    if (val) {
      document.addEventListener('keydown', handleKeydown)
    } else {
      document.removeEventListener('keydown', handleKeydown)
    }
  }, { immediate: true })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-overlay">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/80"
        @click="handleOverlayClick"
      />
    </Transition>
    <Transition :name="side === 'left' ? 'sheet-left' : 'sheet-right'">
      <div
        v-if="open"
        :class="[
          'fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform',
          side === 'left'
            ? 'inset-y-0 left-0 h-full border-r'
            : 'inset-y-0 right-0 h-full border-l'
        ]"
        v-bind="$attrs"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-overlay-enter-active,
.sheet-overlay-leave-active {
  transition: opacity 0.3s ease;
}
.sheet-overlay-enter-from,
.sheet-overlay-leave-to {
  opacity: 0;
}
.sheet-right-enter-active,
.sheet-right-leave-active,
.sheet-left-enter-active,
.sheet-left-leave-active {
  transition: transform 0.3s ease;
}
.sheet-right-enter-from,
.sheet-right-leave-to {
  transform: translateX(100%);
}
.sheet-left-enter-from,
.sheet-left-leave-to {
  transform: translateX(-100%);
}
</style>
