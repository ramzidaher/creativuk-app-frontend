# Local setup (development)

## Prerequisites

- Node.js (use an LTS version)
- npm
- Optional: Expo tooling (this repo uses Expo CLI via `npx`/local installs)

## Install

```bash
npm ci
```

## Run (development)

Start the Expo dev server:

```bash
npm start
```

Useful variants:

```bash
npm run web
npm run ios
npm run android
```

## Lint

```bash
npm run lint
```

## Backend URL switching (dev convenience)

This repo includes a small system for switching which backend URL the frontend uses in development.

### Switch via script (recommended)

```bash
npm run switch-url production
npm run switch-url local
npm run switch-url relative
```

- **production**: `https://app.creativuk.co.uk/api/`
- **local**: `http://localhost:3000/api/`
- **relative**: `/api/` (matches how IIS deploys the frontend)

The active selection is stored in `src/config/development.js` (`ACTIVE_URL`).

### Switch at runtime (browser console)

When running on web, you can use:

```js
CreativSolarConfig.switchBackendUrl("PRODUCTION")
CreativSolarConfig.switchBackendUrl("LOCAL")
CreativSolarConfig.switchBackendUrl("RELATIVE")
```

## Production build (for IIS)

Create a deployable build in `dist/`:

```bash
npm run build:production
```

This build is intended to be copied to IIS (see `docs/DEPLOYMENT-IIS-AZURE.md`).

## Test the production build locally

After `npm run build:production`, serve the `dist/` output locally:

```bash
npm run test-production
```

This starts a local server on port `3001` and prints a list of URLs to test (deep links / refresh behavior).

## Notes about `.env`

There is a `.env` file in the repo root. Treat it as **environment-specific**:

- Don’t commit secrets.
- Prefer documenting required keys in a “`.env.example`” file (if you want, we can add one).

