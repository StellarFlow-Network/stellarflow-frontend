#!/usr/bin/env node

/**
 * Pre-commit hook to warn about bundle size changes
 * Prevents accidentally committing large bundle increases
 * 
 * Usage:
 * 1. Copy to .git/hooks/pre-commit
 * 2. chmod +x .git/hooks/pre-commit
 * 3. Commit runs this automatically
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASELINE_FILE = '.bundle-report.baseline.json';
const CURRENT_REPORT = '.bundle-report.json';
const MAX_INCREASE_PERCENT = 5; // Warn if bundle increases by >5%

try {
  // Skip if no baseline exists
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('📝 No baseline bundle report. Run "npm run build && cp .bundle-report.json .bundle-report.baseline.json" to create one.');
    process.exit(0);
  }

  // Check if any bundle files were modified
  let modifiedBundles = [];
  try {
    const output = execSync('git diff --cached --name-only src/', { encoding: 'utf8' });
    if (output.length > 0) {
      modifiedBundles = output.trim().split('\n');
    }
  } catch {
    // No staged changes
  }

  if (modifiedBundles.length === 0) {
    process.exit(0);
  }

  console.log('🔍 Analyzing bundle impact of staged changes...\n');

  // Build and analyze
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Build failed during pre-commit check');
    process.exit(1);
  }

  // Compare with baseline
  if (fs.existsSync(CURRENT_REPORT)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    const current = JSON.parse(fs.readFileSync(CURRENT_REPORT, 'utf8'));

    const baselineTotal = baseline.totalGzipped;
    const currentTotal = current.totalGzipped;
    const increasePercent = ((currentTotal - baselineTotal) / baselineTotal) * 100;

    if (increasePercent > 0) {
      console.log(`📈 Bundle size increased by ${increasePercent.toFixed(1)}% (${baselineTotal}KB → ${currentTotal}KB)\n`);

      if (increasePercent > MAX_INCREASE_PERCENT) {
        console.warn(`⚠️  WARNING: Bundle increased by more than ${MAX_INCREASE_PERCENT}%`);
        console.warn('Consider optimizing before committing.');
        console.log('\nRun "ANALYZE=true npm run build" to see what changed.\n');
      }
    } else if (increasePercent < 0) {
      console.log(`✅ Bundle size improved by ${Math.abs(increasePercent).toFixed(1)}%\n`);
    }
  }

  process.exit(0);
} catch (err) {
  console.error('❌ Pre-commit check error:', err.message);
  process.exit(0); // Don't block commit on errors
}
