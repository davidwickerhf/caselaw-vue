// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { port: 3001 },
  modules: ['@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || (process.env.NODE_ENV === 'production'
        ? 'https://api.caselawexplorer.tech'
        : 'http://localhost:3000'),
    },
  },
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
