# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Environment variables

All `/api/**` requests are proxied server-side through Nitro to the backend, which
requires a bearer token. Configure these (see `.env.example`):

- `NUXT_API_BACKEND_URL` — backend API base URL (defaults to the production API).
- `NUXT_API_BEARER_TOKEN` — bearer token for the backend (server-only; the proxy
  adds the `Authorization: Bearer …` header, so set the raw token without a prefix).
  It is a service key (`mcit_live_v2_…`) minted in the Caselaw Access console:
  <https://access.caselawexplorer.tech> → Citations API → Service keys → Mint key.
  The secret is shown once; give each deployment its own key so it can be revoked
  on its own.

Env-var changes only apply after a redeploy.

The app searches Rechtspraak, ECHR and CJEU through `POST /api/combined`. The CJEU
metadata fields in the query builder (subject, referring country, party,
judge-rapporteur, Advocate General, EU law) need a citations-api that accepts them
on the combined endpoint (MaastrichtU-BISS/citations-api#56).

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
