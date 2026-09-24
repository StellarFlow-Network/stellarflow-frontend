#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const STRICT_MODE = process.argv.includes('--strict');
const BUILD_DIR = path.join(process.cwd(), '.next');
const CONFIG_FILE = path.join(process.cwd(), '.bundle-limits.json');
const OUTPUT_FILE = path.join(process.cwd(), '.bundle-report.json');

// Default thresholds (in KB)
const DEFAULT_LIMITS = {
  maxMainBundle: 250,
  maxPageBundle: 100,
  maxTotalGzipped: 500,
  maxIndividualGzipped: 150,
};

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn(`Warning: Could not load ${CONFIG_FILE}:`, err.message);
  }
  return DEFAULT_LIMITS;
}

// Get file size in KB
function getFileSizeKb(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch {
    return 0;
  }
}

// Get gzipped file size in KB
function getGzippedSizeKb(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const gzipped = zlib.gzipSync(data);
    return (gzipped.length / 1024).toFixed(2);
  } catch {
    return 0;
  }
}

// Analyze bundles
function analyzeBundles() {
  const limits = loadConfig();
  const report = {
    timestamp: new Date().toISOString(),
    limits,
    bundles: [],
    totalGzipped: 0,
    violations: [],
    passed: true,
  };

  const staticDir = path.join(BUILD_DIR, 'static');
  const jsDir = path.join(staticDir, 'chunks');

  if (!fs.existsSync(jsDir)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  // Scan JS bundles
  const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

  if (files.length === 0) {
    console.warn('⚠️  No JS bundles found in build output.');
    return report;
  }

  let totalGzipped = 0;

  files.forEach(file => {
    const filePath = path.join(jsDir, file);
    const size = parseFloat(getFileSizeKb(filePath));
    const gzipped = parseFloat(getGzippedSizeKb(filePath));
    totalGzipped += gzipped;

    const bundle = {
      name: file,
      size: parseFloat(size),
      gzipped: parseFloat(gzipped),
      exceeds: [],
    };

    // Check against limits
    if (file.includes('main') && gzipped > limits.maxMainBundle) {
      bundle.exceeds.push(`main bundle exceeds limit (${gzipped}KB > ${limits.maxMainBundle}KB)`);
      report.violations.push(bundle.exceeds[0]);
      report.passed = false;
    }

    if (gzipped > limits.maxPageBundle && !file.includes('main')) {
      bundle.exceeds.push(`page bundle exceeds limit (${gzipped}KB > ${limits.maxPageBundle}KB)`);
      report.violations.push(bundle.exceeds[0]);
      report.passed = false;
    }

    if (gzipped > limits.maxIndividualGzipped) {
      bundle.exceeds.push(`individual bundle exceeds gzip limit (${gzipped}KB > ${limits.maxIndividualGzipped}KB)`);
      if (!report.violations.includes(bundle.exceeds[bundle.exceeds.length - 1])) {
        report.violations.push(bundle.exceeds[bundle.exceeds.length - 1]);
      }
      report.passed = false;
    }

    report.bundles.push(bundle);
  });

  report.totalGzipped = parseFloat(totalGzipped.toFixed(2));

  // Check total gzipped size
  if (report.totalGzipped > limits.maxTotalGzipped) {
    const violation = `Total gzipped size exceeds limit (${report.totalGzipped}KB > ${limits.maxTotalGzipped}KB)`;
    report.violations.push(violation);
    report.passed = false;
  }

  return report;
}

// Print report
function printReport(report) {
  console.log('\n' + '='.repeat(60));
  console.log('📦 Bundle Size Analysis Report');
  console.log('='.repeat(60) + '\n');

  console.log('📋 Configuration:');
  console.log(`  • Max main bundle: ${report.limits.maxMainBundle}KB (gzipped)`);
  console.log(`  • Max page bundle: ${report.limits.maxPageBundle}KB (gzipped)`);
  console.log(`  • Max individual: ${report.limits.maxIndividualGzipped}KB (gzipped)`);
  console.log(`  • Max total: ${report.limits.maxTotalGzipped}KB (gzipped)\n`);

  console.log('📊 Bundle Breakdown:');
  report.bundles.sort((a, b) => b.gzipped - a.gzipped).forEach(bundle => {
    const status = bundle.exceeds.length > 0 ? '⚠️ ' : '✅';
    console.log(`  ${status} ${bundle.name}`);
    console.log(`     └─ ${bundle.size}KB raw | ${bundle.gzipped}KB gzipped`);
    if (bundle.exceeds.length > 0) {
      bundle.exceeds.forEach(e => console.log(`        ⚠️  ${e}`));
    }
  });

  console.log(`\n📈 Total (gzipped): ${report.totalGzipped}KB`);

  if (report.violations.length > 0) {
    console.log('\n' + '✗'.repeat(60));
    console.log('❌ OPTIMIZATION VIOLATIONS DETECTED:\n');
    report.violations.forEach((v, i) => console.log(`   ${i + 1}. ${v}`));
    console.log('✗'.repeat(60) + '\n');
  } else {
    console.log('\n' + '✓'.repeat(60));
    console.log('✅ All bundles are within size limits!');
    console.log('✓'.repeat(60) + '\n');
  }

  // Save report
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${OUTPUT_FILE}\n`);
}

// Main
try {
  const report = analyzeBundles();
  printReport(report);

  if (!report.passed) {
    if (STRICT_MODE) {
      console.error('⛔ Build blocked due to bundle size violations (strict mode enabled)');
      process.exit(1);
    } else {
      console.warn('⚠️  Bundle size violations detected. Use "npm run build:strict" to block builds.\n');
    }
  }
} catch (err) {
  console.error('❌ Error analyzing bundles:', err.message);
  process.exit(1);
}
