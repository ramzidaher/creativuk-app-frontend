# Creativ Solar App - Production Testing & Deployment Guide

## Docs

- `docs/README.md`: documentation hub
- `docs/SETUP.md`: local development setup
- `docs/ARCHITECTURE.md`: app structure (routing/auth/api)
- `docs/DEPLOYMENT-IIS-AZURE.md`: Azure Windows Server + IIS deployment (SPA + `/api` proxy)
- `docs/WEB-CONFIG.md`: explanation of `public/web.config`
- `docs/API-URLS.md`: how `API_BASE_URL` is selected (dev vs production)
- `docs/TROUBLESHOOTING.md`: common issues & fixes
- `docs/SALES-REPS.md`: sales rep knowledge base (Mintlify + MCP)
- [Sales rep guides (live)](https://creativenergy.mintlify.app/sales)

## 🚀 Quick Start

### Development
```bash
npm start
# Opens Expo development server with production backend
```

### URL Switching for Development
```bash
# Switch to production backend (default)
npm run switch-url production

# Switch to local backend (if running locally)
npm run switch-url local

# Switch to relative path (for production testing)
npm run switch-url relative

# Switch to custom backend
npm run switch-url custom https://your-backend.com/api/
```

### Production Testing
```bash
npm run test-production
# Builds and serves production version locally for testing
```

### Production Build
```bash
npm run build:production
# Creates production build in dist/ folder
```

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run switch-url <option>` | Switch backend URL for development |
| `npm run dev:production` | Start dev server with production backend |
| `npm run dev:local` | Start dev server with local backend |
| `npm run dev:relative` | Start dev server with relative paths |
| `npm run build:production` | Build for production deployment |
| `npm run test-production` | Test production build locally |
| `npm run test-routing` | Test routing with development build |
| `npm run verify-build` | Verify production build integrity |

## 🔧 URL Switching for Development

### Easy Backend URL Switching

The app now includes a simple system to switch between different backend URLs for local development without modifying code files.

### Available Backend URLs

| Option | URL | Description |
|--------|-----|-------------|
| `production` | `https://app.creativuk.co.uk/api/` | Production backend (default) |
| `local` | `http://localhost:3000/api/` | Local backend (if running) |
| `relative` | `/api/` | Relative path (for production testing) |
| `custom` | User-defined | Custom backend URL |

### Switching Methods

#### 1. Command Line (Recommended)
```bash
# Switch to production backend
npm run switch-url production

# Switch to local backend
npm run switch-url local

# Switch to relative path
npm run switch-url relative

# Switch to custom backend
npm run switch-url custom https://my-backend.com/api/
```

#### 2. Browser Console (Runtime)
Open browser console and use:
```javascript
// Switch to production backend
CreativSolarConfig.switchBackendUrl("PRODUCTION");

// Switch to local backend
CreativSolarConfig.switchBackendUrl("LOCAL");

// Switch to relative path
CreativSolarConfig.switchBackendUrl("RELATIVE");

// List all available URLs
CreativSolarConfig.listAvailableUrls();

// Add custom URL
CreativSolarConfig.addCustomUrl("STAGING", "https://staging-backend.com/api/");
```

#### 3. Direct File Edit
Edit `src/config/development.js` and change:
```javascript
ACTIVE_URL: 'PRODUCTION', // Change to: LOCAL, RELATIVE, or CUSTOM
```

### Development Workflow

1. **Start with production backend:**
   ```bash
   npm run switch-url production
   npm start
   ```

2. **Switch to local backend when needed:**
   ```bash
   npm run switch-url local
   # Restart dev server or use browser console
   ```

3. **Test production build behavior:**
   ```bash
   npm run switch-url relative
   npm run test-production
   ```

## 🧪 Production Testing

### Why Test Production Builds Locally?

When your app is deployed to IIS, it uses relative API URLs (`/api/`) that get proxied to your backend. Testing the production build locally ensures:

- ✅ API calls use correct relative URLs
- ✅ Routing works properly
- ✅ No hardcoded production URLs in the build
- ✅ IIS configuration will work correctly

### Testing Process

1. **Build Production Version:**
   ```bash
   npm run build:production
   ```

2. **Test Locally:**
   ```bash
   npm run test-production
   ```
   - Opens `http://localhost:3003`
   - API calls will fail with 404 (this is correct!)
   - This confirms the build is configured for IIS deployment

3. **Verify Configuration:**
   - Check browser console for: `"Local testing of production build detected, using relative URL: /api/"`
   - API calls should show `POST http://localhost:3003/api/auth/login 404 (Not Found)`

### Expected Behavior

| Environment | API URL | Expected Result |
|-------------|---------|-----------------|
| **Development** | `https://app.creativuk.co.uk/api/` | ✅ Works (direct backend calls) |
| **Local Production Test** | `/api/` | ❌ Fails (no local API server) |
| **Production IIS** | `/api/` | ✅ Works (IIS proxies to backend) |

## 🌐 Web Routing

### URL Structure

Your app now supports proper web URLs:

| Screen | URL Pattern | Example |
|--------|-------------|---------|
| Login | `/login` | `https://yoursite.com/login` |
| Calculator | `/calculator/:opportunityId?` | `https://yoursite.com/calculator/123` |
| Pricing | `/pricing/:opportunityId` | `https://yoursite.com/pricing/123` |
| Dashboard | `/dashboard` | `https://yoursite.com/dashboard` |
| Admin | `/admin` | `https://yoursite.com/admin` |

### Benefits

- ✅ **Bookmarkable URLs** - Users can bookmark specific screens
- ✅ **Browser Navigation** - Back/forward buttons work properly
- ✅ **Deep Linking** - Direct links to specific screens
- ✅ **SEO Friendly** - Search engines can index your app

## 🏗️ IIS Deployment

### Prerequisites

- IIS with URL Rewrite Module installed
- Your backend API running on `https://app.creativuk.co.uk/api/`

### Deployment Steps

1. **Build Production:**
   ```bash
   npm run build:production
   ```

2. **Deploy Files:**
   - Copy contents of `dist/` folder to your IIS web directory
   - Copy `public/web.config` to the root of your web directory

3. **Verify IIS Configuration:**
   - Ensure `web.config` is in place
   - Check that URL Rewrite Module is installed
   - Test API proxy: `https://yoursite.com/api/health`

### IIS Configuration (`web.config`)

The `web.config` file handles:

- **API Proxying:** `/api/*` → `https://app.creativuk.co.uk/api/*`
- **SPA Routing:** All non-API routes → `index.html`
- **Static Files:** Direct serving of assets
- **Security Headers:** HSTS and other security configurations

## 🔧 Environment Configuration

### API URL Logic

The app automatically detects its environment:

```javascript
// Development (localhost + development build)
API_BASE_URL = "https://app.creativuk.co.uk/api/"

// Local Production Testing (localhost + production build)
API_BASE_URL = "/api/"

// Production Deployment (not localhost)
API_BASE_URL = "/api/"
```

### Manual Override (Browser Console)

You can override the API URL in the browser console:

```javascript
// Set custom API URL
CreativSolarConfig.setOverrideUrl("https://your-custom-api.com/api/")

// Test specific URL
CreativSolarConfig.testApiUrl("/api/")

// Auto-detect working URL
CreativSolarConfig.autoDetectWithFallback()

// Get all available URLs
CreativSolarConfig.getAllUrls()
```

## 🐛 Troubleshooting

### Common Issues

#### 1. API Calls Failing in Production
**Symptom:** 404 errors on API calls
**Solution:** 
- Check `web.config` is deployed
- Verify URL Rewrite Module is installed
- Test API proxy: `https://yoursite.com/api/health`

#### 2. Routing Not Working
**Symptom:** Direct URLs return 404
**Solution:**
- Ensure `web.config` SPA fallback rule is active
- Check that `index.html` is served for all non-API routes

#### 3. Production Build Using Wrong API URL
**Symptom:** Local production test uses full URL instead of `/api/`
**Solution:**
- Rebuild: `npm run build:production`
- Check console for environment detection logs

#### 4. Development API Calls Failing
**Symptom:** Development server can't reach backend
**Solution:**
- Check backend is running on `https://app.creativuk.co.uk/api/`
- Verify network connectivity
- Use manual override if needed

### Debug Commands

```bash
# Check build integrity
npm run verify-build

# Test with verbose logging
npm run test-production

# Clean and rebuild
rm -rf dist/ node_modules/.cache/
npm run build:production
```

## 📁 Project Structure

```
├── dist/                    # Production build output
├── public/
│   ├── web.config          # IIS configuration
│   ├── .htaccess           # Apache configuration
│   ├── _redirects          # Netlify configuration
│   └── vercel.json         # Vercel configuration
├── src/
│   ├── utils/
│   │   └── config.js       # Environment & API configuration
│   └── screens/            # App screens with routing
├── scripts/
│   ├── build-production.js # Production build script
│   ├── test-production.js  # Local production testing
│   └── verify-build.js     # Build verification
└── App.tsx                 # Main app with routing configuration
```

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Run `npm run build:production`
- [ ] Test locally with `npm run test-production`
- [ ] Verify API calls fail locally (404 errors)
- [ ] Copy `dist/` contents to IIS
- [ ] Copy `public/web.config` to IIS root
- [ ] Test production URL: `https://yoursite.com/api/health`
- [ ] Test routing: `https://yoursite.com/login`
- [ ] Test calculator: `https://yoursite.com/calculator/123`

## 📞 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify your environment detection logs
3. Test API connectivity manually
4. Check IIS logs for server-side errors
5. Use the manual override commands for debugging

---

**Happy Deploying! 🎉**# creativuk-app-frontend
