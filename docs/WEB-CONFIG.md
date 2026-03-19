# IIS `web.config` (SPA + API proxy)

The production IIS config for this app lives at `public/web.config` and is copied to the IIS site root during deployment.

## What it does

- **Static content MIME types**
  - Adds mappings for Expo/React Native Web build outputs like:
    - `.webmanifest`, `.wasm`, `.map`, `.br`
- **API reverse proxy**
  - Rewrites `^api/(.*)` to the backend
  - Adds `X-Forwarded-Proto` and `X-Forwarded-For` headers (via server variables)
- **Static file passthrough**
  - If the request matches an actual file/folder on disk, IIS serves it normally
- **SPA fallback**
  - Everything else rewrites to `/index.html` so client-side routing works on refresh
- **Security headers**
  - Adds HSTS (only when HTTPS is on)
  - Adds `X-Content-Type-Options: nosniff`
  - Adds `Referrer-Policy: strict-origin-when-cross-origin`

## Current proxy target

In `public/web.config`, the `Proxy API` rule currently rewrites to:

- `https://app.creativuk.co.uk/api/{R:1}`

If your backend runs **on the same Azure Windows VM**, update the `action` URL to localhost (see examples in `docs/DEPLOYMENT-IIS-AZURE.md`).

## Full file reference

See `public/web.config` in this repo for the authoritative configuration.

## Related files

- `public/web-alternative.config`
  - Contains a more explicit set of route rewrite rules (useful when debugging IIS rewrite behavior), but the recommended config is `public/web.config` since it relies on file/dir existence checks plus a single SPA fallback rule.

