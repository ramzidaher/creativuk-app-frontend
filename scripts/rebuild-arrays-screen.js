#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Quick rebuild for SolarArraysInputsScreen...\n');

// Build the app for web (Expo will only rebuild changed files)
console.log('📦 Rebuilding web bundle (incremental build)...');
try {
  execSync('expo export --platform web --output-dir dist', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('\n✅ Build completed successfully!\n');
  
  // Verify the build
  const distPath = path.join(__dirname, '..', 'dist');
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log('✅ Updated files in dist/ folder');
    console.log('📁 Main bundle: dist/_expo/static/js/web/');
    console.log('📄 HTML: dist/index.html\n');
    
    console.log('💡 Your SolarArraysInputsScreen changes are now in the dist folder!');
    console.log('🌐 You can test by serving the dist folder or deploying it.\n');
  } else {
    console.error('❌ Build may have failed - index.html not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

