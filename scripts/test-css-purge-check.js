#!/usr/bin/env node

/**
 * Validation tests for Issue #1200:
 * Automated CSS Unused Utility Purge Check in Build Step
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("\n=======================================================");
console.log("  Running Issue #1200 CSS Purge & Size Check Tests ");
console.log("=======================================================\n");

// ─── Test 1: Tailwind Configuration & Content Purge Paths ──────
console.log("Test 1: Verifying tailwind.config.js purge paths and exclusions...");
{
  const configPath = path.join(__dirname, "../tailwind.config.js");
  assert.ok(fs.existsSync(configPath), "tailwind.config.js must exist");

  const config = require(configPath);
  assert.ok(Array.isArray(config.content), "tailwind.config.js content must be an array");

  const contentGlobs = config.content;
  const hasAppPath = contentGlobs.some((g) => g.includes("src/app"));
  const hasComponentsPath = contentGlobs.some((g) => g.includes("src/components"));
  const hasTestsExclusion = contentGlobs.some((g) => g.startsWith("!") && g.includes("__tests__"));
  const hasSpecsExclusion = contentGlobs.some(
    (g) => g.startsWith("!") && (g.includes("test") || g.includes("spec"))
  );
  const hasStoriesExclusion = contentGlobs.some((g) => g.startsWith("!") && g.includes("stories"));

  assert.ok(hasAppPath, "content must include src/app path");
  assert.ok(hasComponentsPath, "content must include src/components path");
  assert.ok(hasTestsExclusion, "content must exclude __tests__ directories");
  assert.ok(hasSpecsExclusion, "content must exclude *.test / *.spec files");
  assert.ok(hasStoriesExclusion, "content must exclude *.stories files");

  console.log("  ✓ Tailwind content purge paths and exclusions verified");
}

// ─── Test 2: CSS Source Directive in globals.css ───────────────
console.log("Test 2: Verifying source isolation in src/app/globals.css...");
{
  const globalsCssPath = path.join(__dirname, "../src/app/globals.css");
  assert.ok(fs.existsSync(globalsCssPath), "src/app/globals.css must exist");

  const globalsCss = fs.readFileSync(globalsCssPath, "utf8");
  assert.ok(
    globalsCss.includes('source(none)'),
    "src/app/globals.css must disable default uncontrolled source scanning with source(none)"
  );
  assert.ok(
    globalsCss.includes('@config "../../tailwind.config.js"'),
    "src/app/globals.css must link to @config ../../tailwind.config.js"
  );

  console.log("  ✓ Globals CSS source configuration verified");
}

// ─── Test 3: Bundle Limits Configuration ───────────────────────
console.log("Test 3: Verifying maxCssTotalGzipped budget in .bundle-limits.json...");
{
  const limitsPath = path.join(__dirname, "../.bundle-limits.json");
  assert.ok(fs.existsSync(limitsPath), ".bundle-limits.json must exist");

  const limits = JSON.parse(fs.readFileSync(limitsPath, "utf8"));
  assert.strictEqual(
    limits.maxCssTotalGzipped,
    40,
    `.bundle-limits.json maxCssTotalGzipped must be strictly 40KB (got ${limits.maxCssTotalGzipped})`
  );

  console.log("  ✓ CSS bundle size limit configured to 40KB");
}

// ─── Test 4: Package Scripts Integration ───────────────────────
console.log("Test 4: Verifying build script integration in package.json...");
{
  const packageJsonPath = path.join(__dirname, "../package.json");
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  assert.ok(
    pkg.scripts.build && pkg.scripts.build.includes("node scripts/check-css-size.js"),
    'package.json "build" script must execute "node scripts/check-css-size.js"'
  );
  assert.ok(
    pkg.scripts["build:strict"] &&
      pkg.scripts["build:strict"].includes("node scripts/check-css-size.js --strict"),
    'package.json "build:strict" script must execute "node scripts/check-css-size.js --strict"'
  );

  console.log("  ✓ Build scripts integration verified");
}

// ─── Test 5: Check CSS Size Script Functionality ───────────────
console.log("Test 5: Verifying scripts/check-css-size.js execution and reporting...");
{
  const checkScriptPath = path.join(__dirname, "../scripts/check-css-size.js");
  assert.ok(fs.existsSync(checkScriptPath), "scripts/check-css-size.js must exist");

  // Run script directly and verify output report is written
  try {
    const stdout = execSync("node scripts/check-css-size.js", {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    });
    assert.ok(stdout.includes("CSS Bundle Size Analysis Report"), "Report header must be printed");
  } catch (err) {
    // If build files are present, exit code 0 should occur in non-strict mode
    assert.fail(`check-css-size.js failed to execute: ${err.message}`);
  }

  const reportPath = path.join(__dirname, "../.css-bundle-report.json");
  assert.ok(fs.existsSync(reportPath), ".css-bundle-report.json must be generated");

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.ok(report.timestamp, "Report must contain timestamp");
  assert.strictEqual(report.limits.maxCssTotalGzipped, 40, "Report limits must reflect 40KB budget");
  assert.ok(Array.isArray(report.files), "Report files must be an array");
  assert.ok(typeof report.totalGzipped === "number", "Report totalGzipped must be a number");

  console.log("  ✓ scripts/check-css-size.js executed and generated valid report");
}

// ─── Test 6: Implementation Documentation ──────────────────────
console.log("Test 6: Verifying implementation.md documentation...");
{
  const docPath = path.join(__dirname, "../implementation.md");
  assert.ok(fs.existsSync(docPath), "implementation.md must exist");

  const doc = fs.readFileSync(docPath, "utf8");
  assert.ok(doc.includes("Issue #1200"), "implementation.md must reference Issue #1200");
  assert.ok(doc.includes("tailwind.config.js"), "implementation.md must document tailwind.config.js");
  assert.ok(doc.includes("check-css-size.js"), "implementation.md must document check-css-size.js");
  assert.ok(doc.includes("40"), "implementation.md must document the 40KB budget");

  console.log("  ✓ implementation.md documentation verified");
}

console.log("\n=======================================================");
console.log("  ✅ All Issue #1200 validation tests passed! ");
console.log("=======================================================\n");
