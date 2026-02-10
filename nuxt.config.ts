// https://nuxt.com/docs/api/configuration/nuxt-config

// The backend API base URL. All /api/** requests are proxied through Nitro
// so the browser never makes cross-origin requests (no CORS issues).
// Nuxt auto-reads NUXT_PUBLIC_API_BASE_URL from .env / environment at startup.
declare const process: { env: Record<string, string | undefined> };
const apiBaseUrl = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

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
    // Server-only: the actual backend URL (used by the proxy).
    apiBackendUrl: apiBaseUrl,
    public: {
      // No longer needed client-side — all API calls go through the proxy
      // at /api/** (same origin). Kept for reference / edge cases.
      apiBaseUrl,
    },
  },
  nitro: {
    // Proxy all /api/** requests to the backend API server.
    // This eliminates CORS in both dev (localhost:3001 → localhost:3000)
    // and production on Vercel (yourapp.vercel.app → api.caselawexplorer.tech).
    devProxy: {
      '/api': `${apiBaseUrl}/api`,
    },
  },
  vite: {
    plugins: [
      // @ts-expect-error - tailwindcss vite plugin
      (await import('@tailwindcss/vite')).default()
    ],
    optimizeDeps: {
      include: ['d3-force', 'd3-zoom', 'd3-selection', 'd3-drag', 'pako'],
    },
    ssr: {
      // Keep d3 as external for SSR to avoid module resolution timeouts
      external: ['d3-force', 'd3-zoom', 'd3-selection', 'd3-drag', 'd3-dispatch', 'd3-quadtree', 'd3-timer', 'd3-interpolate', 'd3-color', 'd3-transition', 'd3-ease'],
    },
  },
})
