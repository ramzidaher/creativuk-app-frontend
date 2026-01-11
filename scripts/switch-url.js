#!/usr/bin/env node

/**
 * URL Switching Script
 * 
 * This script helps you easily switch between different backend URLs
 * for local development without modifying code files.
 * 
 * Usage:
 *   node scripts/switch-url.js production
 *   node scripts/switch-url.js local
 *   node scripts/switch-url.js relative
 *   node scripts/switch-url.js custom https://your-backend.com/api/
 */

const fs = require('fs');
const path = require('path');

// Path to the development config file
const configPath = path.join(__dirname, '..', 'src', 'config', 'development.js');

// Available URL options
const URL_OPTIONS = {
  production: 'https://creativuk-app.paldev.tech/api/',
  local: 'http://localhost:3000/api/',
  relative: '/api/',
  custom: null // Will be set by user
};

function updateConfigFile(urlKey, url) {
  try {
    // Read the current config file
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Update the ACTIVE_URL
    const activeUrlRegex = /ACTIVE_URL:\s*'[^']*'/;
    const newActiveUrl = `ACTIVE_URL: '${urlKey.toUpperCase()}'`;
    configContent = configContent.replace(activeUrlRegex, newActiveUrl);
    
    // If it's a custom URL, update the CUSTOM entry
    if (urlKey === 'custom' && url) {
      const customUrlRegex = /CUSTOM:\s*'[^']*'/;
      const newCustomUrl = `CUSTOM: '${url}'`;
      configContent = configContent.replace(customUrlRegex, newCustomUrl);
    }
    
    // Write the updated config back
    fs.writeFileSync(configPath, configContent, 'utf8');
    
    console.log(`✅ Successfully switched to ${urlKey} backend URL: ${url}`);
    console.log(`📁 Updated: ${configPath}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error updating config file:', error.message);
    return false;
  }
}

function showUsage() {
  console.log('🔧 URL Switching Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/switch-url.js <option> [custom-url]');
  console.log('');
  console.log('Options:');
  console.log('  production  - Use production backend (https://creativuk-app.paldev.tech/api/)');
  console.log('  local       - Use local backend (http://localhost:3000/api/)');
  console.log('  relative    - Use relative path (/api/)');
  console.log('  custom      - Use custom URL (provide URL as second argument)');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/switch-url.js production');
  console.log('  node scripts/switch-url.js local');
  console.log('  node scripts/switch-url.js custom https://my-backend.com/api/');
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showUsage();
    return;
  }
  
  const urlKey = args[0].toLowerCase();
  let url = URL_OPTIONS[urlKey];
  
  // Handle custom URL
  if (urlKey === 'custom') {
    if (args.length < 2) {
      console.error('❌ Custom URL requires a second argument with the URL');
      console.log('Example: node scripts/switch-url.js custom https://my-backend.com/api/');
      process.exit(1);
    }
    url = args[1];
  }
  
  // Validate URL key
  if (!url && urlKey !== 'custom') {
    console.error(`❌ Invalid option: ${urlKey}`);
    console.log('Available options:', Object.keys(URL_OPTIONS).join(', '));
    process.exit(1);
  }
  
  // Update the config file
  if (updateConfigFile(urlKey, url)) {
    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Restart your development server if it\'s running');
    console.log('2. Or run: npm run dev:production (or dev:local, dev:relative)');
    console.log('');
    console.log('💡 You can also switch URLs at runtime using the browser console:');
    console.log('   CreativSolarConfig.switchBackendUrl("PRODUCTION")');
    console.log('   CreativSolarConfig.switchBackendUrl("LOCAL")');
    console.log('   CreativSolarConfig.switchBackendUrl("RELATIVE")');
  } else {
    process.exit(1);
  }
}

main();
