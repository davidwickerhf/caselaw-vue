# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Environment variables

All `/api/**` requests are proxied server-side through Nitro to the backend, which
requires a bearer token. Configure these (see `.env.example`):

- `NUXT_API_BACKEND_URL` — backend API base URL (defaults to the production API).
- `NUXT_API_BEARER_TOKEN` — bearer token for the backend (server-only; the proxy
  adds the `Authorization: Bearer …` header, so set the raw token without a prefix).

On Vercel, set `NUXT_API_BEARER_TOKEN` for the Production environment and redeploy —
env-var changes only apply to new deployments.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
