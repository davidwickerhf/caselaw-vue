# Production image: builds the Nuxt app and serves it with the Nitro node server.
# Runtime config comes from the environment (see .env.example):
#   NUXT_API_BACKEND_URL, NUXT_API_BEARER_TOKEN, NUXT_PUBLIC_API_BASE_URL
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
# postinstall runs `nuxt prepare`, which needs the sources; the build prepares anyway.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
