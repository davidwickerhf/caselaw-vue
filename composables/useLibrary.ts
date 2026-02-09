import { ref } from 'vue'

// ── Sidebar sizing constants ──
export const LIBRARY_MIN = 300
export const LIBRARY_MAX = 420
export const LIBRARY_DEFAULT = 320

// ── Singleton state ──
const libraryOpen = ref(false)
const libraryWidth = ref(LIBRARY_DEFAULT)

function toggleLibrary() {
  libraryOpen.value = !libraryOpen.value
}

function openLibrary() {
  libraryOpen.value = true
}

function closeLibrary() {
  libraryOpen.value = false
}

export function useLibrary() {
  return {
    libraryOpen,
    libraryWidth,
    toggleLibrary,
    openLibrary,
    closeLibrary,
    LIBRARY_MIN,
    LIBRARY_MAX,
  }
}
