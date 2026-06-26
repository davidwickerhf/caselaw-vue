// https://nuxt.com/docs/api/configuration/nuxt-config

// The backend API base URL. All /api/** requests are proxied through Nitro
// so the browser never makes cross-origin requests (no CORS issues).
// Nuxt auto-reads these values from .env / environment at startup.
declare const process: { env: Record<string, string | undefined> };
const apiBackendUrl = process.env.NUXT_API_BACKEND_URL || process.env.NUXT_PUBLIC_API_BASE_URL || 'https://api.caselawexplorer.tech';
const publicApiBaseUrl = process.env.NUXT_PUBLIC_API_BASE_URL || apiBackendUrl;
const apiBearerToken = process.env.NUXT_API_BEARER_TOKEN || process.env.API_BEARER_TOKEN || process.env.TOKEN || '';

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
    apiBackendUrl,
    // Server-only: bearer token for the backend API.
    apiBearerToken,
    public: {
      // No longer needed client-side — all API calls go through the proxy
      // at /api/** (same origin). Kept for reference / edge cases.
      apiBaseUrl: publicApiBaseUrl,
    },
  },
  vite: {
    plugins: [
      {
        name: 'ignore-build-assets-directory-request',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/_nuxt/' || req.url === '/_nuxt') {
              res.statusCode = 204;
              res.end();
              return;
            }
            next();
          });
        },
      },
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
