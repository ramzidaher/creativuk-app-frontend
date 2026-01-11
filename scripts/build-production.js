#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building for production deployment...\n');

// Create production config override
const prodConfigPath = path.join(__dirname, '..', 'src', 'utils', 'production-config.js');
const prodConfig = `
// Production configuration override
// This ensures the app uses relative URLs for production deployment

export const PRODUCTION_CONFIG = {
  API_BASE_URL: '/api/',
  FORCE_RELATIVE_URLS: true,
  ENVIRONMENT: 'production'
};

// Override the default URL for production builds
if (typeof window !== 'undefined') {
  // Force relative URLs in production
  window.__PRODUCTION_BUILD__ = true;
  window.__FORCE_API_URL__ = '/api/';
}
`;

fs.writeFileSync(prodConfigPath, prodConfig);
console.log('📝 Created production config override');

// Build the app for web
console.log('📦 Building app for production...');
try {
  execSync('expo export --platform web --output-dir dist', { stdio: 'inherit' });
  console.log('✅ Production build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Clean up production config
fs.unlinkSync(prodConfigPath);
console.log('🧹 Cleaned up production config');

// Check if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Dist folder not found. Build may have failed.');
  process.exit(1);
}

// Verify the build
console.log('🔍 Verifying production build...');
const indexPath = path.join(distPath, 'index.html');
if (fs.existsSync(indexPath)) {
  console.log('✅ index.html found');
} else {
  console.error('❌ index.html not found');
  process.exit(1);
}

// Setup favicon
console.log('📋 Setting up favicon...');
try {
  execSync('node scripts/setup-favicon.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (error) {
  console.warn('⚠️  Favicon setup failed, but continuing...');
}

console.log('\n🎉 Production build ready!');
console.log('📁 Output directory: dist/');
console.log('🌐 Deploy the dist/ folder to your IIS server');
console.log('📋 Don\'t forget to copy public/web.config to the root of your web directory');
console.log('\n🔧 Production configuration:');
console.log('   - API calls will use relative URLs: /api/');
console.log('   - IIS will proxy /api/* to https://creativuk-app.paldev.tech/api/');
console.log('   - Client-side routing will work for all app screens');
console.log('   - Static files will be served directly by IIS');
console.log('   - SPA fallback will serve index.html for all other routes');
