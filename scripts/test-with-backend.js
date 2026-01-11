#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing React Navigation routing with production backend...\n');

// Create a temporary config override for testing
const testConfigPath = path.join(__dirname, '..', 'src', 'utils', 'test-config.js');
const testConfig = `
// Temporary config for testing with production backend
export const TEST_CONFIG = {
  API_BASE_URL: 'https://creativuk-app.paldev.tech/api/',
  OVERRIDE_DEFAULT: true
};
`;

fs.writeFileSync(testConfigPath, testConfig);
console.log('📝 Created temporary test config');

// Build the app for web
console.log('📦 Building app for web...');
try {
  execSync('npm run build:web', { stdio: 'inherit' });
  console.log('✅ Build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Clean up test config
fs.unlinkSync(testConfigPath);
console.log('🧹 Cleaned up test config');

// Check if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ Dist folder not found. Build may have failed.');
  process.exit(1);
}

console.log('🌐 Starting local server with production backend...');
console.log('📋 Test these URLs in your browser:');
console.log('   http://localhost:3000/');
console.log('   http://localhost:3000/calculator/123');
console.log('   http://localhost:3000/pricing/123');
console.log('   http://localhost:3000/admin');
console.log('   http://localhost:3000/solar-workflow/123');
console.log('\n✅ Backend API: https://creativuk-app.paldev.tech/api/');
console.log('💡 If routing works locally, it will work in production with IIS config.\n');

// Start a simple HTTP server
try {
  execSync('npx serve dist -p 3000', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
