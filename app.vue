<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

useHead({
  style: [
    {
      key: 'fouc',
      innerHTML: `
        html { background-color: hsl(0 0% 100%); }
        html.dark { background-color: hsl(240 10% 3.9%); }
        #__nuxt { opacity: 0; }
        #__nuxt.ready { opacity: 1; transition: opacity 0.1s ease; }
      `,
    },
  ],
  script: [
    {
      key: 'color-mode-restore',
      innerHTML: `
        try {
          var m = localStorage.getItem('nuxt-color-mode');
          if (m === 'dark') document.documentElement.classList.add('dark');
        } catch(e) {}
      `,
      tagPosition: 'head',
    },
  ],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster position="bottom-right" close-button rich-colors />
</template>
