# API base URL & environment behavior

This frontend builds API URLs via `API_BASE_URL` and then calls endpoints like:

- `POST /auth/login`
- `GET /health`

In production, `API_BASE_URL` should be set to **`/api/`** so IIS can proxy those calls.

## Where it’s defined

- `src/utils/env.ts` exports `API_BASE_URL`
- `src/utils/config.js` contains the URL selection logic (`urlManager.getApiUrl()`)
- `src/config/development.js` holds editable URL presets for local development
- `scripts/switch-url.js` updates `src/config/development.js` so you can switch backends without changing app code

## Typical setups

### Production (IIS)

- **Frontend** is served by IIS from `dist/`
- Frontend calls **relative URLs**: `/api/...`
- IIS rewrites `/api/...` to your backend (remote or localhost)

### Development (Expo)

For local dev, you can switch the backend base URL with:

```bash
npm run switch-url production
npm run switch-url local
npm run switch-url relative
```

The active choice is stored in `src/config/development.js` under `ACTIVE_URL`.

## Runtime override (browser)

When running in a browser, a helper is attached to `window`:

- `CreativSolarConfig.switchBackendUrl("PRODUCTION" | "LOCAL" | "RELATIVE")`
- `CreativSolarConfig.setOverrideUrl("https://.../api/")`
- `CreativSolarConfig.clearOverrideUrl()`

