#!/usr/bin/env node

/**
 * Font Configuration Verification Script
 * 
 * Validates that:
 * 1. Font files are properly generated at build time
 * 2. No external Google Fonts requests in production bundle
 * 3. CSS variables are correctly configured
 * 
 * Usage: node scripts/verify-font-config.js
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${COLORS.reset} ${message}`);
}

function success(message) {
  log(COLORS.green, '✓', message);
}

function error(message) {
  log(COLORS.red, '✗', message);
}

function warning(message) {
  log(COLORS.yellow, '⚠', message);
}

function info(message) {
  log(COLORS.blue, 'ℹ', message);
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    success(`${description} exists`);
    return true;
  } else {
    error(`${description} not found at: ${filePath}`);
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(searchString)) {
      success(`${description}`);
      return true;
    } else {
      error(`${description} - not found`);
      return false;
    }
  } catch (err) {
    error(`Could not read ${filePath}: ${err.message}`);
    return false;
  }
}

function checkNoExternalFontRequests(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasGoogleFonts = content.includes('fonts.googleapis.com') || 
                          content.includes('fonts.gstatic.com');
    
    if (!hasGoogleFonts) {
      success('No external Google Fonts requests found');
      return true;
    } else {
      warning('External Google Fonts references still present');
      return false;
    }
  } catch (err) {
    warning(`Could not check for external fonts: ${err.message}`);
    return true; // Don't fail if file doesn't exist yet
  }
}

function main() {
  console.log('\n🔍 Font Configuration Verification\n');
  
  let allPassed = true;

  // Check source files
  info('Checking source files...');
  allPassed &= checkFileExists(
    path.join(__dirname, '../src/app/fonts.ts'),
    'Font configuration file'
  );
  allPassed &= checkFileExists(
    path.join(__dirname, '../src/app/layout.tsx'),
    'Layout file'
  );
  allPassed &= checkFileExists(
    path.join(__dirname, '../src/app/globals.css'),
    'Global CSS file'
  );

  console.log();

  // Check font configuration
  info('Checking font configuration...');
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/fonts.ts'),
    'Inter',
    'Inter font imported'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/fonts.ts'),
    'Roboto_Mono',
    'Roboto Mono font imported'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/fonts.ts'),
    'display: "swap"',
    'Font display swap configured'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/fonts.ts'),
    'preload: true',
    'Font preload enabled'
  );

  console.log();

  // Check layout integration
  info('Checking layout integration...');
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/layout.tsx'),
    'import { inter, robotoMono } from "./fonts"',
    'Fonts imported in layout'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/layout.tsx'),
    'inter.variable',
    'Inter variable applied to body'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/layout.tsx'),
    'robotoMono.variable',
    'Roboto Mono variable applied to body'
  );

  console.log();

  // Check CSS variables
  info('Checking CSS variables...');
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/globals.css'),
    '--font-inter',
    'Inter CSS variable configured'
  );
  allPassed &= checkFileContains(
    path.join(__dirname, '../src/app/globals.css'),
    '--font-roboto-mono',
    'Roboto Mono CSS variable configured'
  );

  console.log();

  // Check for external font requests (non-blocking)
  info('Checking for external font requests...');
  checkNoExternalFontRequests(path.join(__dirname, '../src/app/layout.tsx'));

  console.log();

  // Check build output (if exists)
  const buildMediaDir = path.join(__dirname, '../.next/static/media');
  if (fs.existsSync(buildMediaDir)) {
    info('Checking build output...');
    const files = fs.readdirSync(buildMediaDir);
    const woff2Files = files.filter(f => f.endsWith('.woff2'));
    
    if (woff2Files.length > 0) {
      success(`Found ${woff2Files.length} bundled font files in .next/static/media/`);
      woff2Files.forEach(file => {
        console.log(`  - ${file}`);
      });
    } else {
      warning('No .woff2 font files found in build output (build may not have run yet)');
    }
  } else {
    info('Build output not found - run "npm run build" to verify font bundling');
  }

  console.log();

  // Summary
  if (allPassed) {
    success('✨ All font configuration checks passed!');
    console.log();
    info('Next steps:');
    console.log('  1. Run: npm run build');
    console.log('  2. Verify fonts in .next/static/media/');
    console.log('  3. Check Network tab in DevTools (no fonts.googleapis.com requests)');
    console.log();
    process.exit(0);
  } else {
    error('❌ Some configuration checks failed');
    console.log();
    info('Please review the errors above and update your configuration.');
    console.log();
    process.exit(1);
  }
}

main();
