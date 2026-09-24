#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const STRICT_MODE = process.argv.includes("--strict");
const BUILD_DIR = path.join(process.cwd(), ".next");
const CONFIG_FILE = path.join(process.cwd(), ".bundle-limits.json");
const OUTPUT_FILE = path.join(process.cwd(), ".css-bundle-report.json");

const DEFAULT_LIMITS = {
  maxCssTotalGzipped: 25,
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      return {
        ...DEFAULT_LIMITS,
        ...parsed,
      };
    }
  } catch {
  }
  return DEFAULT_LIMITS;
}

function getFileSizeKb(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size / 1024;
  } catch {
    return 0;
  }
}

function getGzippedSizeKb(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const gzipped = zlib.gzipSync(data);
    return gzipped.length / 1024;
  } catch {
    return 0;
  }
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (entry.isFile() && fullPath.endsWith(".css")) {
      out.push(fullPath);
    }
  }
}

function analyzeCss() {
  const limits = loadConfig();
  const report = {
    timestamp: new Date().toISOString(),
    limits: {
      maxCssTotalGzipped: limits.maxCssTotalGzipped,
    },
    files: [],
    totalGzipped: 0,
    violations: [],
    passed: true,
  };

  const staticDir = path.join(BUILD_DIR, "static");
  if (!fs.existsSync(staticDir)) {
    console.error('❌ Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  const cssFiles = [];
  walk(staticDir, cssFiles);

  let totalGzipped = 0;
  for (const filePath of cssFiles) {
    const size = getFileSizeKb(filePath);
    const gzipped = getGzippedSizeKb(filePath);
    totalGzipped += gzipped;
    report.files.push({
      name: path.relative(BUILD_DIR, filePath).replace(/\\/g, "/"),
      size: Number(size.toFixed(2)),
      gzipped: Number(gzipped.toFixed(2)),
    });
  }

  report.totalGzipped = Number(totalGzipped.toFixed(2));

  if (report.totalGzipped > limits.maxCssTotalGzipped) {
    report.violations.push(
      `Total CSS gzipped size exceeds limit (${report.totalGzipped}KB > ${limits.maxCssTotalGzipped}KB)`
    );
    report.passed = false;
  }

  return report;
}

function printReport(report) {
  console.log("\n" + "=".repeat(60));
  console.log("🎨 CSS Bundle Size Analysis Report");
  console.log("=".repeat(60) + "\n");

  console.log("📋 Configuration:");
  console.log(`  • Max total CSS: ${report.limits.maxCssTotalGzipped}KB (gzipped)\n`);

  if (report.files.length === 0) {
    console.log("⚠️  No CSS assets found in build output.");
  } else {
    console.log("📊 CSS Asset Breakdown:");
    report.files
      .sort((a, b) => b.gzipped - a.gzipped)
      .forEach((file) => {
        console.log(`  • ${file.name}`);
        console.log(`     └─ ${file.size}KB raw | ${file.gzipped}KB gzipped`);
      });
  }

  console.log(`\n📈 Total CSS (gzipped): ${report.totalGzipped}KB`);

  if (report.violations.length > 0) {
    console.log("\n" + "✗".repeat(60));
    console.log("❌ CSS SIZE LIMIT VIOLATION:\n");
    report.violations.forEach((v, i) => console.log(`   ${i + 1}. ${v}`));
    console.log("✗".repeat(60) + "\n");
  } else {
    console.log("\n" + "✓".repeat(60));
    console.log("✅ CSS bundle is within size limits!");
    console.log("✓".repeat(60) + "\n");
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`📄 Detailed report saved to: ${OUTPUT_FILE}\n`);
}

try {
  const report = analyzeCss();
  printReport(report);
  if (!report.passed) {
    if (STRICT_MODE) {
      console.error("⛔ Build blocked due to CSS size limit violation (strict mode enabled)");
      process.exit(1);
    } else {
      console.warn('⚠️  CSS size violation detected. Use "node scripts/check-css-size.js --strict" to block builds.\n');
    }
  }
} catch (err) {
  console.error("❌ Error analyzing CSS assets:", err.message);
  process.exit(1);
}

