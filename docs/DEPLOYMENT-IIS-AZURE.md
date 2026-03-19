# IIS / Azure Windows deployment

This project is an **Expo (React Native Web) SPA** that is deployed as **static files on IIS**.

In production the app uses **relative API URLs** (`/api/*`). IIS rewrites `/api/*` to your backend (either a local service on the same VM, or a remote API).

## Build artifacts

- **Build output**: `dist/`
  - Contains `index.html` and Expo web bundles under `/_expo/static/...`
- **IIS config**: `public/web.config`
  - Must be copied to the IIS site root (same folder as `index.html`)

Build command used for IIS:

```bash
npm run build:production
```

This script forces the production build to use `API_BASE_URL = "/api/"` so the app works behind the IIS proxy.

## IIS prerequisites

- **IIS URL Rewrite module** installed
- If you proxy to another HTTP server (local or remote), you typically also need:
  - **Application Request Routing (ARR)** installed
  - **ARR proxy enabled**: IIS Manager → server → *Application Request Routing Cache* → *Server Proxy Settings…* → **Enable proxy**

## Deploy steps (IIS site)

1. Build:

```bash
npm ci
npm run build:production
```

2. Copy files to the IIS site root (Physical Path):
   - Copy **everything inside** `dist/` to the site root
   - Copy `public/web.config` to the site root (next to `index.html`)

3. Recycle the app pool (or restart the site) if needed.

4. Verify:
   - **SPA routing** works on refresh, e.g. `/login`
   - **API proxy** works, e.g. `/api/health`

## Backend proxy targets

The rewrite rule in `public/web.config` currently proxies `/api/*` to a backend URL:

- **Remote backend** (current repo default):
  - `/api/{anything}` → `https://app.creativuk.co.uk/api/{anything}`

- **Same-server backend** (common on Azure VMs):
  - Run your backend on the VM (e.g. Node/Express) bound to `127.0.0.1:3000`
  - Rewrite `/api/{anything}` to localhost

### If your backend is mounted at `/api/*`

Use:

```xml
<action type="Rewrite" url="http://127.0.0.1:3000/api/{R:1}" />
```

### If your backend is mounted at `/*` (no `/api` prefix)

Use:

```xml
<action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
```

The correct choice depends on your backend routes. This frontend calls endpoints like:

- `GET /api/health`
- `POST /api/auth/login`

## Troubleshooting

### `/api/*` returns 404 in production

- Confirm `web.config` is in the IIS site root.
- Confirm **URL Rewrite** is installed.
- If rewriting to another server:
  - Confirm **ARR** is installed and **proxy is enabled**.
  - Confirm the backend is reachable from the VM:
    - Local backend: `http://127.0.0.1:3000/...`
    - Remote backend: `https://...`

### Refreshing `/some-route` returns 404

- The SPA fallback rule must rewrite unknown routes to `/index.html`.
- Confirm IIS is serving the built `index.html` from `dist/`.

### 500.50 / “URL Rewrite Module Error”

- URL Rewrite isn’t installed or rules are invalid.
- If you use `<serverVariables>`, confirm the rewrite module is allowed to set them (IIS feature delegation / permissions).

