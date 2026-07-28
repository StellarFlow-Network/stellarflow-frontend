#!/usr/bin/env node

/**
 * Dependency-Audit | Automated Frontend NPM Package Vulnerability Scanner
 * 
 * Scans all project dependencies for known vulnerabilities using npm audit,
 * classifies them by severity, and generates comprehensive reports.
 * 
 * Usage:
 *   node scripts/dependency-audit.js              # Standard audit
 *   node scripts/dependency-audit.js --json       # JSON-only output
 *   node scripts/dependency-audit.js --markdown   # Markdown report only
 *   node scripts/dependency-audit.js --strict     # Exit with error on any vuln
 *   node scripts/dependency-audit.js --fix        # Auto-fix (runs npm audit fix)
 *   node scripts/dependency-audit.js --ci         # CI mode (fail on critical/high)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
const STRICT_MODE = process.argv.includes('--strict');
const CI_MODE = process.argv.includes('--ci');
const JSON_ONLY = process.argv.includes('--json');
const MD_ONLY = process.argv.includes('--markdown');
const FIX_MODE = process.argv.includes('--fix');

const PACKAGE_JSON = path.join(process.cwd(), 'package.json');
const LOCK_FILE = path.join(process.cwd(), 'package-lock.json');
const OUTPUT_DIR = path.join(process.cwd(), 'reports');
const JSON_REPORT = path.join(OUTPUT_DIR, 'dependency-audit-report.json');
const MD_REPORT = path.join(OUTPUT_DIR, 'DEPENDENCY_AUDIT.md');

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];
const SEVERITY_COLORS = {
  critical: { icon: '🔴', label: 'CRITICAL', weight: 5 },
  high:     { icon: '🟠', label: 'HIGH',     weight: 4 },
  moderate: { icon: '🟡', label: 'MODERATE', weight: 3 },
  low:      { icon: '🔵', label: 'LOW',      weight: 2 },
  info:     { icon: '⚪', label: 'INFO',     weight: 1 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function runCommand(cmd, options = {}) {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    });
    return { success: true, stdout, stderr: '' };
  } catch (err) {
    return {
      success: false,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
    };
  }
}

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Core Audit Logic ────────────────────────────────────────────────────────

/**
 * Parse package.json to extract all direct dependencies with their version ranges.
 */
function parseDirectDependencies() {
  const pkg = readJson(PACKAGE_JSON);
  if (!pkg) {
    console.error('❌ Could not read package.json');
    process.exit(1);
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Object.entries(deps).map(([name, version]) => ({
    name,
    versionRange: version,
    type: pkg.dependencies?.[name] ? 'dependency' : 'devDependency',
  }));
}

/**
 * Parse package-lock.json to extract resolved versions and integrity info.
 */
function parseLockfileDependencies() {
  const lock = readJson(LOCK_FILE);
  if (!lock || !lock.packages) return [];

  const entries = [];
  for (const [pkgPath, info] of Object.entries(lock.packages)) {
    if (pkgPath === '') continue; // skip root
    const name = pkgPath.replace(/^node_modules\//, '');
    entries.push({
      name,
      version: info.version || 'unknown',
      resolved: info.resolved || null,
      integrity: info.integrity || null,
      dev: info.dev || false,
      optional: info.optional || false,
    });
  }
  return entries;
}

/**
 * Run npm audit --json and parse the result.
 */
function runNpmAudit() {
  console.log('🔍 Running npm audit...\n');

  const result = runCommand('npm audit --json 2>&1', { timeout: 120000 });

  if (!result.success && !result.stdout) {
    console.error('❌ npm audit failed to execute.');
    console.error(result.stderr);
    return null;
  }

  try {
    // npm audit --json returns JSON even on non-zero exit (vulnerabilities found)
    const auditData = JSON.parse(result.stdout);
    return auditData;
  } catch (err) {
    console.error('❌ Failed to parse npm audit output:', err.message);
    console.error('Raw output snippet:', result.stdout.substring(0, 500));
    return null;
  }
}

/**
 * Run npm audit fix if --fix flag is provided.
 */
function runNpmAuditFix() {
  console.log('\n🔧 Running npm audit fix...\n');
  const result = runCommand('npm audit fix --json 2>&1', { timeout: 180000 });

  if (result.success) {
    console.log('✅ npm audit fix completed successfully.');
  } else {
    console.log('⚠️  npm audit fix completed with some issues.');
    if (result.stderr) console.error(result.stderr);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return { message: result.stdout || 'Fix completed' };
  }
}

/**
 * Classify vulnerabilities by severity and aggregate statistics.
 */
function classifyVulnerabilities(auditData) {
  if (!auditData || !auditData.vulnerabilities) {
    return {
      summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
      bySeverity: {},
      byPackage: [],
      vulnerabilities: [],
      fixAvailable: 0,
    };
  }

  const vulns = auditData.vulnerabilities;
  const bySeverity = { critical: [], high: [], moderate: [], low: [], info: [] };
  const vulnList = [];
  let fixAvailable = 0;

  for (const [pkgName, info] of Object.entries(vulns)) {
    const severity = info.severity || 'info';
    const via = (info.via || []).map(v => (typeof v === 'string' ? v : v.title || v.source || v.name || 'unknown'));
    const effects = info.effects || [];
    const firstVia = info.via?.[0] || {};
    const advisoryTitle = typeof firstVia === 'string' ? firstVia : (firstVia.title || firstVia.source || 'Unknown vulnerability');

    const entry = {
      package: pkgName,
      severity,
      title: advisoryTitle,
      via,
      effects,
      range: info.range || 'unknown',
      fixAvailable: info.fixAvailable === 'will not fix' ? false : (info.fixAvailable || false),
      nodes: info.nodes || [],
      cvssScore: info.cvss?.score || null,
      cveIds: info.cveIds || [],
      ghsaIds: info.ghsaIds || [],
    };

    if (bySeverity[severity]) {
      bySeverity[severity].push(entry);
    }
    vulnList.push(entry);

    if (entry.fixAvailable) {
      fixAvailable++;
    }
  }

  const summary = {
    total: vulnList.length,
    critical: bySeverity.critical.length,
    high: bySeverity.high.length,
    moderate: bySeverity.moderate.length,
    low: bySeverity.low.length,
    info: bySeverity.info.length,
  };

  // Sort packages by severity weight descending
  const byPackage = Object.entries(vulns)
    .map(([name, info]) => ({
      name,
      severity: info.severity,
      weight: SEVERITY_COLORS[info.severity]?.weight || 0,
      via: (info.via || []).map(v => (typeof v === 'string' ? v : v.source || v.name)),
    }))
    .sort((a, b) => b.weight - a.weight);

  return { summary, bySeverity, byPackage, vulnerabilities: vulnList, fixAvailable };
}

/**
 * Calculate a health score based on vulnerability data.
 */
function calculateHealthScore(summary, totalDeps) {
  if (totalDeps === 0) return 100;

  const weights = { critical: 25, high: 10, moderate: 4, low: 1, info: 0 };
  const rawScore =
    summary.critical * weights.critical +
    summary.high * weights.high +
    summary.moderate * weights.moderate +
    summary.low * weights.low;

  const maxPossible = totalDeps * weights.critical;
  const normalizedScore = maxPossible > 0 ? 1 - rawScore / maxPossible : 1;
  const score = Math.max(0, Math.min(100, Math.round(normalizedScore * 100)));

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 65) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Generate remediation advice based on vulnerability analysis.
 */
function generateRemediation(summary, fixAvailable) {
  const steps = [];

  if (summary.critical > 0) {
    steps.push({
      priority: 'IMMEDIATE',
      action: `Patch ${summary.critical} critical vulnerabilities`,
      command: 'npm audit fix',
      detail: 'Critical vulnerabilities should be addressed immediately to prevent potential exploits.',
    });
  }

  if (summary.high > 0) {
    steps.push({
      priority: 'HIGH',
      action: `Patch ${summary.high} high-severity vulnerabilities`,
      command: 'npm audit fix',
      detail: 'High-severity vulnerabilities pose significant risk and should be patched soon.',
    });
  }

  if (fixAvailable > 0) {
    steps.push({
      priority: 'RECOMMENDED',
      action: `Auto-fix ${fixAvailable} vulnerabilities`,
      command: 'npm audit fix',
      detail: 'Use npm audit fix to automatically apply compatible updates.',
    });
  }

  if (summary.moderate > 0 || summary.low > 0) {
    steps.push({
      priority: 'SCHEDULED',
      action: `Review ${summary.moderate + summary.low} moderate/low severity issues`,
      command: 'npm audit',
      detail: 'Schedule a review of moderate and low severity issues during the next maintenance window.',
    });
  }

  steps.push({
    priority: 'ONGOING',
    action: 'Regular dependency updates',
    command: 'npm update',
    detail: 'Run npm update regularly to keep dependencies current and reduce vulnerability surface.',
  });

  steps.push({
    priority: 'ONGOING',
    action: 'Integrate into CI/CD pipeline',
    command: 'node scripts/dependency-audit.js --ci',
    detail: 'Add this audit to your CI pipeline to catch vulnerabilities before deployment.',
  });

  return steps;
}

// ─── Report Generation ───────────────────────────────────────────────────────

function generateJsonReport(auditData, directDeps, lockDeps, classification, health, remediation, fixResult) {
  return {
    metadata: {
      project: readJson(PACKAGE_JSON)?.name || 'unknown',
      version: readJson(PACKAGE_JSON)?.version || '0.0.0',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      npmVersion: runCommand('npm --version').stdout.trim(),
    },
    summary: {
      totalDependencies: lockDeps.length,
      directDependencies: directDeps.length,
      transitiveDependencies: lockDeps.length - directDeps.length,
      vulnerabilities: classification.summary,
      healthScore: health.score,
      healthGrade: health.grade,
      fixableCount: classification.fixAvailable,
    },
    severityBreakdown: {
      critical: classification.bySeverity.critical.map(v => ({
        package: v.package,
        title: v.title,
        severity: v.severity,
        range: v.range,
        fixAvailable: v.fixAvailable,
        cvssScore: v.cvssScore,
        cveIds: v.cveIds,
        ghsaIds: v.ghsaIds,
      })),
      high: classification.bySeverity.high.map(v => ({
        package: v.package,
        title: v.title,
        severity: v.severity,
        range: v.range,
        fixAvailable: v.fixAvailable,
        cvssScore: v.cvssScore,
        cveIds: v.cveIds,
        ghsaIds: v.ghsaIds,
      })),
      moderate: classification.bySeverity.moderate.map(v => ({
        package: v.package,
        title: v.title,
        severity: v.severity,
        range: v.range,
        fixAvailable: v.fixAvailable,
      })),
      low: classification.bySeverity.low.map(v => ({
        package: v.package,
        title: v.title,
        severity: v.severity,
        range: v.range,
        fixAvailable: v.fixAvailable,
      })),
      info: classification.bySeverity.info.map(v => ({
        package: v.package,
        title: v.title,
        severity: v.severity,
        range: v.range,
      })),
    },
    topAffectedPackages: classification.byPackage.slice(0, 20).map(p => ({
      name: p.name,
      severity: p.severity,
      advisories: p.via,
    })),
    remediation: remediation,
    fixResult: fixResult || null,
    rawAudit: auditData ? {
      auditVersion: auditData.auditReportVersion || null,
      metadata: auditData.metadata || null,
    } : null,
  };
}

function generateMarkdownReport(jsonReport) {
  const { metadata, summary, severityBreakdown, topAffectedPackages, remediation } = jsonReport;
  const lines = [];

  // Header
  lines.push('# 🔒 Dependency Audit Report');
  lines.push('');
  lines.push(`**Project:** ${metadata.project} v${metadata.version}`);
  lines.push(`**Date:** ${formatDate(new Date(metadata.timestamp))}`);
  lines.push(`**Node:** ${metadata.nodeVersion} | **npm:** ${metadata.npmVersion}`);
  lines.push('');

  // Health Score
  lines.push('## 📊 Health Score');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Health Score** | **${summary.healthScore}/100** (Grade: ${summary.healthGrade}) |`);
  lines.push(`| Total Dependencies | ${summary.totalDependencies} |`);
  lines.push(`| Direct Dependencies | ${summary.directDependencies} |`);
  lines.push(`| Transitive Dependencies | ${summary.transitiveDependencies} |`);
  lines.push(`| Fixable Vulnerabilities | ${summary.fixableCount} |`);
  lines.push('');

  // Vulnerability Summary
  lines.push('## 🛡️ Vulnerability Summary');
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);

  const severityOrder = ['critical', 'high', 'moderate', 'low', 'info'];
  for (const sev of severityOrder) {
    const count = summary.vulnerabilities[sev] || 0;
    const icon = SEVERITY_COLORS[sev]?.icon || '⚪';
    const label = SEVERITY_COLORS[sev]?.label || sev.toUpperCase();
    lines.push(`| ${icon} ${label} | ${count} |`);
  }
  lines.push(`| **Total** | **${summary.vulnerabilities.total}** |`);
  lines.push('');

  // Severity Breakdown
  if (summary.vulnerabilities.total > 0) {
    lines.push('## 🔍 Vulnerability Details');
    lines.push('');

    for (const sev of severityOrder) {
      const vulns = severityBreakdown[sev];
      if (!vulns || vulns.length === 0) continue;

      const icon = SEVERITY_COLORS[sev]?.icon || '⚪';
      const label = SEVERITY_COLORS[sev]?.label || sev.toUpperCase();
      lines.push(`### ${icon} ${label} (${vulns.length})`);
      lines.push('');

      for (const v of vulns) {
        lines.push(`- **\`${v.package}\`** — ${v.title}`);
        lines.push(`  - Affected range: \`${v.range}\``);
        if (v.cvssScore !== null && v.cvssScore !== undefined) lines.push(`  - CVSS Score: **${v.cvssScore}**`);
        if (v.cveIds && v.cveIds.length > 0) lines.push(`  - CVE: ${v.cveIds.map(id => `\`${id}\``).join(', ')}`);
        if (v.ghsaIds && v.ghsaIds.length > 0) lines.push(`  - GHSA: ${v.ghsaIds.map(id => `\`${id}\``).join(', ')}`);
        if (v.fixAvailable) {
          lines.push(`  - ✅ Fix available via \`npm audit fix\``);
        } else if (v.fixAvailable === false) {
          lines.push(`  - ❌ No fix available — manual intervention required`);
        }
        lines.push('');
      }
    }

    // Top affected packages
    lines.push('### 📦 Top Affected Packages');
    lines.push('');
    lines.push('| Package | Severity | Advisories |');
    lines.push('|---------|----------|------------|');
    for (const pkg of topAffectedPackages.slice(0, 15)) {
      const icon = SEVERITY_COLORS[pkg.severity]?.icon || '⚪';
      lines.push(`| \`${pkg.name}\` | ${icon} ${capitalize(pkg.severity)} | ${pkg.advisories.slice(0, 3).join(', ')}${pkg.advisories.length > 3 ? '...' : ''} |`);
    }
    lines.push('');
  } else {
    lines.push('## ✅ No Vulnerabilities Found');
    lines.push('');
    lines.push('All dependencies are up-to-date and free of known vulnerabilities.');
    lines.push('');
  }

  // Remediation
  lines.push('## 🛠️ Remediation Steps');
  lines.push('');
  lines.push('| Priority | Action | Command |');
  lines.push('|----------|--------|---------|');
  for (const step of remediation) {
    lines.push(`| **${step.priority}** | ${step.action} | \`${step.command}\` |`);
  }
  lines.push('');

  // Detailed remediation
  lines.push('### 📋 Detailed Remediation Plan');
  lines.push('');
  for (const step of remediation) {
    lines.push(`**${step.priority}:** ${step.action}`);
    lines.push('');
    lines.push(`> ${step.detail}`);
    lines.push('');
    lines.push('```bash');
    lines.push(step.command);
    lines.push('```');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Report generated by Dependency-Audit Scanner*');
  lines.push(`*${formatDate(new Date(metadata.timestamp))}*`);

  return lines.join('\n');
}

function printConsoleReport(jsonReport) {
  const { summary, topAffectedPackages, remediation } = jsonReport;
  const sev = summary.vulnerabilities;

  console.log('\n' + '='.repeat(64));
  console.log('🔒 DEPENDENCY AUDIT REPORT');
  console.log('='.repeat(64) + '\n');

  console.log(`📋 Project: ${jsonReport.metadata.project} v${jsonReport.metadata.version}`);
  console.log(`🕐 ${formatDate(new Date(jsonReport.metadata.timestamp))}`);
  console.log(`⚙️  Node ${jsonReport.metadata.nodeVersion} | npm ${jsonReport.metadata.npmVersion}\n`);

  console.log('📊 HEALTH SCORE');
  console.log('─'.repeat(40));
  const gradeColor = summary.healthGrade === 'A' ? '✅' : summary.healthGrade === 'B' ? '⚠️' : '❌';
  console.log(`  ${gradeColor} Score: ${summary.healthScore}/100 (Grade: ${summary.healthGrade})`);
  console.log(`  📦 Total Dependencies: ${summary.totalDependencies}`);
  console.log(`  📁 Direct: ${summary.directDependencies} | 🔗 Transitive: ${summary.transitiveDependencies}`);
  console.log(`  🔧 Fixable: ${summary.fixableCount}\n`);

  console.log('🛡️  VULNERABILITY SUMMARY');
  console.log('─'.repeat(40));
  const severityOrder = ['critical', 'high', 'moderate', 'low', 'info'];
  for (const s of severityOrder) {
    const count = sev[s] || 0;
    const icon = SEVERITY_COLORS[s]?.icon || '⚪';
    const label = SEVERITY_COLORS[s]?.label || s.toUpperCase();
    const bar = count > 0 ? '█'.repeat(Math.min(count, 20)) : '';
    console.log(`  ${icon} ${label.padEnd(10)} ${String(count).padStart(3)}  ${bar}`);
  }
  console.log(`  ${'─'.repeat(20)}`);
  console.log(`  🧮 Total: ${sev.total}\n`);

  if (topAffectedPackages.length > 0) {
    console.log('📦 TOP AFFECTED PACKAGES');
    console.log('─'.repeat(40));
    topAffectedPackages.slice(0, 10).forEach((pkg, i) => {
      const icon = SEVERITY_COLORS[pkg.severity]?.icon || '⚪';
      console.log(`  ${i + 1}. ${icon} ${pkg.name} (${capitalize(pkg.severity)})`);
    });
    console.log('');
  }

  if (sev.total > 0) {
    console.log('🛠️  RECOMMENDED ACTIONS');
    console.log('─'.repeat(40));
    remediation.forEach(step => {
      console.log(`  [${step.priority}] ${step.action}`);
      console.log(`       → ${step.command}`);
    });
    console.log('');
  } else {
    console.log('✅ No vulnerabilities found. Dependencies are secure!\n');
  }

  console.log('='.repeat(64));
  console.log(`📄 JSON report: ${JSON_REPORT}`);
  console.log(`📄 MD report:   ${MD_REPORT}`);
  console.log('='.repeat(64) + '\n');
}

// ─── Main Execution ──────────────────────────────────────────────────────────

async function main() {
  console.log('🔒 Dependency Audit Scanner');
  console.log('═'.repeat(40) + '\n');

  // 1. Parse dependencies
  console.log('📦 Parsing dependencies...');
  const directDeps = parseDirectDependencies();
  const lockDeps = parseLockfileDependencies();
  console.log(`   → ${directDeps.length} direct dependencies`);
  console.log(`   → ${lockDeps.length} total resolved dependencies\n`);

  // 2. Run npm audit
  const auditData = runNpmAudit();
  if (!auditData) {
    console.error('❌ Audit failed. Ensure npm is installed and dependencies are installed.');
    process.exit(1);
  }

  // 3. Classify vulnerabilities
  const classification = classifyVulnerabilities(auditData);
  console.log(`   → ${classification.summary.total} vulnerabilities found`);
  if (classification.summary.critical > 0) console.log(`     🔴 ${classification.summary.critical} critical`);
  if (classification.summary.high > 0) console.log(`     🟠 ${classification.summary.high} high`);
  if (classification.summary.moderate > 0) console.log(`     🟡 ${classification.summary.moderate} moderate`);
  if (classification.summary.low > 0) console.log(`     🔵 ${classification.summary.low} low`);
  console.log('');

  // 4. Calculate health score
  const health = calculateHealthScore(classification.summary, lockDeps.length);
  console.log(`📊 Health Score: ${health.score}/100 (Grade: ${health.grade})\n`);

  // 5. Generate remediation
  const remediation = generateRemediation(classification.summary, classification.fixAvailable);

  // 6. Run fix if requested
  let fixResult = null;
  if (FIX_MODE) {
    fixResult = runNpmAuditFix();
    // Re-run audit after fix
    const postFixAudit = runNpmAudit();
    if (postFixAudit) {
      const postClassification = classifyVulnerabilities(postFixAudit);
      const postHealth = calculateHealthScore(postClassification.summary, lockDeps.length);
      console.log(`\n📊 Post-fix Health Score: ${postHealth.score}/100 (Grade: ${postHealth.grade})`);
      console.log(`   Remaining vulnerabilities: ${postClassification.summary.total}\n`);
      classification.summary = postClassification.summary;
      classification.bySeverity = postClassification.bySeverity;
      classification.byPackage = postClassification.byPackage;
      classification.vulnerabilities = postClassification.vulnerabilities;
      classification.fixAvailable = postClassification.fixAvailable;
      health.score = postHealth.score;
      health.grade = postHealth.grade;
    }
  }

  // 7. Generate reports
  ensureOutputDir();

  const jsonReport = generateJsonReport(
    auditData, directDeps, lockDeps, classification, health, remediation, fixResult
  );

  // Write JSON report
  fs.writeFileSync(JSON_REPORT, JSON.stringify(jsonReport, null, 2));
  console.log(`✅ JSON report saved: ${JSON_REPORT}`);

  // Write Markdown report
  const mdContent = generateMarkdownReport(jsonReport);
  fs.writeFileSync(MD_REPORT, mdContent);
  console.log(`✅ Markdown report saved: ${MD_REPORT}\n`);

  // 8. Console output
  if (!JSON_ONLY) {
    printConsoleReport(jsonReport);
  }

  // 9. Exit codes for CI/Strict modes
  if (CI_MODE && (classification.summary.critical > 0 || classification.summary.high > 0)) {
    console.error('⛔ CI mode: Critical or high vulnerabilities detected. Failing build.');
    process.exit(1);
  }

  if (STRICT_MODE && classification.summary.total > 0) {
    console.error('⛔ Strict mode: Vulnerabilities detected. Failing build.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});