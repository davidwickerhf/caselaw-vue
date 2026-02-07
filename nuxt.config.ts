// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { port: 3001 },
  modules: ['@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [
      // @ts-expect-error - tailwindcss vite plugin
      (await import('@tailwindcss/vite')).default()
    ]
  },
  alias: {
    '~': '/Users/davidwickerhf/Projects/work/maastricht/citations/caselaw-vue'
  }
})
