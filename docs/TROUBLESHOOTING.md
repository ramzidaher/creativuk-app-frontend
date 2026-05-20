# Troubleshooting

## IIS / production issues

### API calls return 404/502 from the browser

What to check:

- `public/web.config` is deployed to the **IIS site root** (same folder as `index.html`)
- **URL Rewrite** module is installed
- If the rewrite proxies to another server:
  - **ARR** installed and **proxy enabled**
  - Backend target is reachable from the VM

Quick tests:

- `GET /api/health` should reach the backend health endpoint (through IIS)

Common root causes:

- `web.config` isn’t being picked up (wrong folder)
- Rewrite module missing
- Proxy target wrong (localhost vs remote URL)
- Backend process down (if same-server)

### Refreshing a deep link (e.g. `/login`) shows a 404

Symptom:

- Navigating inside the app works, but refreshing a route or opening a bookmarked URL returns 404.

Cause:

- IIS is trying to find a real file at that path. For SPAs, unknown routes must be rewritten to `/index.html`.

Fix:

- Ensure `public/web.config` is deployed and the **SPA fallback** rule is active.

### Static assets 404 (JS bundles, manifest, wasm)

Check:

- You deployed the **contents** of `dist/` (not the folder itself)
- The “Static files” rule isn’t accidentally rewriting real assets to `/index.html`
- MIME mappings exist for:
  - `.webmanifest`, `.wasm`, `.map`, `.br` (handled in `public/web.config`)

## Local development issues

### API calls go to the wrong backend

This repo has multiple ways to choose the API base URL.

Check:

- `src/config/development.js` → `ACTIVE_URL`
- LocalStorage override key: `creativ_solar_api_url` (set by the URL manager)
- Runtime overrides via `CreativSolarConfig` in the browser console

Fix (recommended):

```bash
npm run switch-url production
```

If you previously saved a URL in localStorage, clear it:

- DevTools → Application → Local Storage → remove `creativ_solar_api_url`

### “CORS Error” / “Failed to fetch”

Common causes:

- Backend CORS not allowing your dev origin
- You’re calling a remote backend from localhost without proper CORS headers

Typical fix:

- Configure CORS on the backend to allow the Expo dev URL(s)

### Production build works in IIS but not in local `test-production`

Expected behavior depends on the proxy:

- If production relies on IIS rewriting `/api/*`, then local `npx serve dist` won’t provide that proxy.
- In that case, you can still test **routing** (deep links/refresh), but API calls may fail unless you run a local proxy.

If you want API calls to work in local production-build testing, use:

```bash
npm run test-with-backend
```

(This serves `dist/` locally and targets the production backend.)

## “Opportunity not found” but the deal exists in GHL

The frontend `.env` file normally only sets **`API_BASE_URL`**. GoHighLevel tokens and location IDs live in **`creativuk-app-backend/.env`**, not in the Expo app env.

To see whether GHL returns the opportunity for the same credentials the backend uses, run this from the **backend** repo (uses backend `.env`):

```bash
cd ../creativuk-app-backend   # or your path to creativuk-app-backend
npm run test:ghl-opportunity -- YOUR_GHL_OPPORTUNITY_ID
```

If v1 and v2 both fail, the ID is wrong for that token/location, the opportunity is in another sub-account, or pipeline configuration does not match where the deal was created.

