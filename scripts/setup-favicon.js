#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');
const faviconSource = path.join(__dirname, '..', 'assets', 'creativ.png');
const faviconSourceAlt = path.join(__dirname, '..', 'assets', 'images', 'favicon.png');
const faviconSourceAlt2 = path.join(__dirname, '..', 'assets', 'favicon.png');
const faviconDest = path.join(distPath, 'favicon.png');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ Dist folder not found. Please build the app first.');
  process.exit(1);
}

// Copy favicon to dist folder (prioritize creativ.png)
if (fs.existsSync(faviconSource)) {
  fs.copyFileSync(faviconSource, faviconDest);
  console.log('✅ Favicon copied from assets/creativ.png');
} else if (fs.existsSync(faviconSourceAlt)) {
  fs.copyFileSync(faviconSourceAlt, faviconDest);
  console.log('✅ Favicon copied from assets/images/favicon.png');
} else if (fs.existsSync(faviconSourceAlt2)) {
  fs.copyFileSync(faviconSourceAlt2, faviconDest);
  console.log('✅ Favicon copied from assets/favicon.png');
} else {
  console.warn('⚠️  Favicon not found, skipping...');
}

// Add favicon link tags to HTML if not already present
if (fs.existsSync(indexPath)) {
  let htmlContent = fs.readFileSync(indexPath, 'utf8');
  if (!htmlContent.includes('<link rel="icon"')) {
    // Add favicon links after the title tag
    htmlContent = htmlContent.replace(
      /(<title>.*?<\/title>)/,
      '$1\n    <link rel="icon" type="image/png" href="/favicon.png" />\n    <link rel="shortcut icon" type="image/png" href="/favicon.png" />\n    <link rel="apple-touch-icon" href="/favicon.png" />'
    );
    fs.writeFileSync(indexPath, htmlContent);
    console.log('✅ Favicon links added to HTML');
  } else {
    console.log('✅ Favicon links already present in HTML');
  }
} else {
  console.warn('⚠️  index.html not found, skipping HTML update...');
}

console.log('🎉 Favicon setup complete!');

