// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { port: 3001 },
  modules: ['@vueuse/nuxt'],
  experimental: {
    appManifest: false,
  },
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
    ],
    optimizeDeps: {
      include: ['d3-force', 'd3-zoom', 'd3-selection', 'd3-drag'],
    },
    ssr: {
      // Keep d3 as external for SSR to avoid module resolution timeouts
      external: ['d3-force', 'd3-zoom', 'd3-selection', 'd3-drag', 'd3-dispatch', 'd3-quadtree', 'd3-timer', 'd3-interpolate', 'd3-color', 'd3-transition', 'd3-ease'],
    },
  },
  alias: {
    '~': '/Users/davidwickerhf/Projects/work/maastricht/citations/caselaw-vue'
  }
})
