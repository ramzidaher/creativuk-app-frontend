# Architecture overview

## What this app is

- **Frontend**: Expo + React Native + React Native Web (SPA on web)
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **API calls**: `fetch` via `src/utils/api.ts`
- **Deployment model (web)**: static files served by **IIS**, with `/api/*` proxied to the backend (see `docs/DEPLOYMENT-IIS-AZURE.md`)

## Code layout (high level)

- `App.tsx`
  - Navigation container, deep linking config (web URLs), root navigators
  - Providers: `ThemeProvider`, `PaperProvider`, `AuthProvider`
- `src/screens/*`
  - “Pages” / screens (workflows, calculators, signing, admin, etc.)
- `src/components/*`
  - Reusable UI components
- `src/context/*`
  - Cross-cutting state: auth + theming
- `src/utils/*`
  - API client, environment URL selection, caches, helpers
- `public/web.config`
  - IIS config (SPA fallback + `/api` rewrite + MIME types)

## Navigation & routing

### Navigators

Defined in `App.tsx`:

- **Stack navigator**: controls auth vs app screens and most workflow screens
- **Bottom tabs**: `Dashboard`, `Opportunities`, `Progress`, `Profile`

### Deep linking (web URLs)

Also in `App.tsx` there is a `linking` configuration that maps routes like:

- `/login`
- `/calculator/:opportunityId?`
- `/pricing/:opportunityId`
- `/admin`

Why this matters:

- In production, **IIS must rewrite unknown routes to `/index.html`**, otherwise refreshing `/pricing/123` will 404.

See `docs/WEB-CONFIG.md` for how SPA fallback is configured.

## Auth & session

Auth state is managed by `src/context/AuthContext.tsx`:

- **Login/register** call `authApi.*` from `src/utils/api.ts`
- Tokens and user are stored via `getStorage()`:
  - Web: `localStorage`
  - Mobile: `@react-native-async-storage/async-storage`
- A small event system (`tokenExpirationEvents`) triggers a logout across the app when the API returns `401`.

## Theming

Theme state is managed by `src/context/ThemeContext.tsx`:

- Supports `light`, `dark`, and `system` mode
- The app is wrapped in:
  - `ThemeProvider` (custom colors + mode)
  - React Native Paper `Provider` (MD3 light/dark themes)

## API layer

API code lives in `src/utils/api.ts`:

- `API_BASE_URL` is imported from `src/utils/env.ts`
- URLs are built via `buildApiUrl(endpoint)` to avoid double slashes
- Core methods:
  - `api.get/post/put/delete`
  - `authApi.*` for auth endpoints
  - feature APIs like `opportunitiesApi`, `workflowApi`, `surveyApi`, etc.

Important behaviors:

- Most API calls require an auth token (stored in storage)
- `401` triggers token clearing + `tokenExpirationEvents.trigger()`
- Some calls return richer error messages for CORS / “Failed to fetch”

## API base URL selection (dev vs production)

The app chooses the API base URL dynamically:

- `src/utils/env.ts` exports `API_BASE_URL` from the URL manager
- `src/utils/config.js` (`urlManager.getApiUrl()`) selects between:
  - dev-configured absolute URLs (for local dev)
  - `/api/` (for production behind IIS)
- `src/config/development.js` is the easy-to-edit list of URL presets
- `scripts/switch-url.js` updates `src/config/development.js` for quick switching

Details: `docs/API-URLS.md`

## Production / IIS mental model

- The web build should call **relative** URLs: `/api/...`
- IIS handles:
  - **API proxy**: `/api/*` → backend
  - **SPA fallback**: `/*` → `index.html` (when not a real file/dir)

If those two are correct, most “production-only” issues disappear.

