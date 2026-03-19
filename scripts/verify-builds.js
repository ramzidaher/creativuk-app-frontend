#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build configurations...\n');

// Check if dist folder exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ No dist folder found. Run "npm run build:production" first.');
  process.exit(1);
}

// Check for required files
const requiredFiles = [
  'index.html',
  '_expo/static/js/web/index-*.js'
];

console.log('📁 Checking required files:');
requiredFiles.forEach(file => {
  if (file.includes('*')) {
    // Check for pattern match
    const dir = path.dirname(file);
    const pattern = path.basename(file);
    const fullDir = path.join(distPath, dir);
    
    if (fs.existsSync(fullDir)) {
      const files = fs.readdirSync(fullDir);
      const matches = files.filter(f => f.includes(pattern.replace('*', '')));
      if (matches.length > 0) {
        console.log(`✅ ${file} (found ${matches.length} matches)`);
      } else {
        console.log(`❌ ${file} (no matches found)`);
      }
    } else {
      console.log(`❌ ${file} (directory not found)`);
    }
  } else {
    const fullPath = path.join(distPath, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file}`);
    }
  }
});

// Check for web.config
const webConfigPath = path.join(__dirname, '..', 'public', 'web.config');
if (fs.existsSync(webConfigPath)) {
  console.log('✅ web.config (IIS configuration)');
} else {
  console.log('❌ web.config (IIS configuration) - Required for production');
}

console.log('\n🎯 Build verification complete!');
console.log('\n📋 Next steps for production deployment:');
console.log('1. Copy the dist/ folder contents to your IIS web directory');
console.log('2. Copy public/web.config to the root of your web directory');
console.log('3. Ensure IIS URL Rewrite module is installed');
console.log('4. Test the deployment with your backend at https://app.creativuk.co.uk/api/');

console.log('\n🔧 Environment behavior:');
console.log('- Local testing: Uses https://app.creativuk.co.uk/api/');
console.log('- Production: Uses relative /api/ URLs (proxied by IIS)');
console.log('- Routing: All screens have proper URLs (e.g., /calculator/123)');
