#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing production build locally...\n');

// Check if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ No dist folder found. Run "npm run build:production" first.');
  process.exit(1);
}

console.log('🌐 Starting local server for production build testing...');
console.log('📋 Test these URLs in your browser:');
console.log('   http://localhost:3001/');
console.log('   http://localhost:3001/calculator/123');
console.log('   http://localhost:3001/pricing/123');
console.log('   http://localhost:3001/admin');
console.log('   http://localhost:3001/solar-workflow/123');
console.log('   http://localhost:3001/contract-generation/123');
console.log('   http://localhost:3001/flux-calculator/123');

console.log('\n🔧 What to test:');
console.log('1. ✅ App loads at root URL');
console.log('2. ✅ Direct URL access works (e.g., /calculator/123)');
console.log('3. ✅ Browser back/forward buttons work');
console.log('4. ✅ URL changes when navigating between screens');
console.log('5. ✅ API calls work (will use production backend)');
console.log('6. ✅ Bookmarking specific URLs works');

console.log('\n💡 This tests the EXACT same build that will be deployed to IIS!');
console.log('   - Uses production build from dist/ folder');
console.log('   - Uses production API configuration');
console.log('   - Tests all routing functionality');

console.log('\n🚀 Starting server on port 3001 (different from your IIS port)...\n');

// Start server
try {
  execSync('npx serve dist -p 3001', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
