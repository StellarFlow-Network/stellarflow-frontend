#!/usr/bin/env node

/**
 * Static export link checker (Issue #1016).
 *
 * Scans every HTML file produced by `next build` with `output: export`
 * (the `out/` directory) and verifies that every internal link and asset
 * reference resolves to a file that actually exists in the export.
 *
 * Exit codes:
 *   0  no broken links (dynamic/unexported route targets are warnings only)
 *   1  one or more broken links were found, or `out/` is missing
 *
 * Usage:
 *   node scripts/check-broken-links.js [--dir out] [--strict] [--verbose]
 */

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const OUT_DIR = path.resolve(process.cwd(), argValue("--dir", "out"));
const STRICT = args.includes("--strict");
const VERBOSE = args.includes("--verbose");

const SKIP_SCHEMES = /^(https?:)?\/\/|^(mailto|tel|sms|data|javascript|blob|about):/i;
const DYNAMIC_SEGMENT = /^\[.+\]$/;

/**
 * Route prefixes that contain dynamic segments in the app source
 * (e.g. `src/app/remittance/[txId]` → `remittance`). Links into those
 * routes cannot be validated statically, because only the params returned
 * by `generateStaticParams()` are exported.
 */
function collectDynamicPrefixes() {
  const prefixes = new Set();
  for (const root of ["src/app", "src/pages"]) {
    const rootDir = path.join(process.cwd(), root);
    if (!fs.existsSync(rootDir)) continue;

    const walk = (current, segments) => {
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }
      const dynamicHere = entries.some((entry) => entry.isDirectory() && DYNAMIC_SEGMENT.test(entry.name));
      if (dynamicHere && segments.length > 0) prefixes.add(segments[0]);
      for (const entry of entries) {
        if (entry.isDirectory()) walk(path.join(current, entry.name), [...segments, entry.name]);
      }
    };

    walk(rootDir, []);
  }
  return prefixes;
}

function listHtmlFiles(dir) {
  const results = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_next" || entry.name === ".DS_Store") continue;
        walk(full);
      } else if (entry.name.endsWith(".html")) {
        results.push(full);
      }
    }
  };
  walk(dir);
  return results.sort();
}

function extractRefs(html) {
  const refs = [];
  const attrPattern = /\s(?:href|src|srcset|poster|data-src)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = attrPattern.exec(html)) !== null) {
    const raw = match[2] !== undefined ? match[2] : match[3];
    if (!raw) continue;

    // srcset holds "url descriptor, url descriptor, ..."
    if (/^\s*\S+\s+\d+[wx](\s*,\s*\S+\s+\d+[wx])*\s*$/.test(raw)) {
      raw.split(",").forEach((part) => {
        const url = part.trim().split(/\s+/)[0];
        if (url) refs.push(url);
      });
      continue;
    }

    refs.push(raw.trim());
  }
  return refs;
}

function stripQueryAndHash(ref) {
  return ref.split("#")[0].split("?")[0];
}

function decode(ref) {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

/**
 * Classify + resolve a reference against the export directory.
 * Returns { kind: 'skip' | 'ok' | 'dynamic' | 'broken', target }
 */
function resolveRef(ref, htmlFile, dynamicPrefixes) {
  if (!ref || ref === "#" || SKIP_SCHEMES.test(ref)) return { kind: "skip" };

  const clean = decode(stripQueryAndHash(ref));
  if (!clean || clean === "#") return { kind: "skip" };

  // In-page anchors only.
  if (clean.startsWith("/") === false && clean.includes("#") && !path.extname(clean)) {
    return { kind: "skip" };
  }

  const baseDir = path.dirname(htmlFile);
  const target = clean.startsWith("/")
    ? path.join(OUT_DIR, clean)
    : path.resolve(baseDir, clean);

  if (!target.startsWith(OUT_DIR)) return { kind: "skip" };

  // 1. Exact file hit (assets such as /favicon.ico, /_next/static/...).
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return { kind: "ok", target };
  }

  // 2. Directory URL → index.html (trailingSlash exports).
  if (clean.endsWith("/")) {
    const indexFile = path.join(target, "index.html");
    if (fs.existsSync(indexFile)) return { kind: "ok", target: indexFile };
  }

  // 3. Extensionless route → route.html or route/index.html.
  if (!path.extname(clean)) {
    const asFile = `${target}.html`;
    if (fs.existsSync(asFile)) return { kind: "ok", target: asFile };
    const asIndex = path.join(target, "index.html");
    if (fs.existsSync(asIndex)) return { kind: "ok", target: asIndex };
  }

  // 4. Link inside a route that declares dynamic segments in the source
  //    (e.g. /remittance/<txId>) → cannot be validated without a server.
  const relative = path.relative(OUT_DIR, target).split(path.sep).join("/");
  const firstSegment = relative.split("/")[0];
  if (dynamicPrefixes.has(firstSegment)) {
    return { kind: "dynamic", target };
  }

  // 5. The parent route folder exists in the export → unexported dynamic id.
  const parentDir = path.dirname(target);
  if (parentDir !== OUT_DIR && fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
    return { kind: "dynamic", target };
  }

  return { kind: "broken", target };
}

function main() {
  if (!fs.existsSync(OUT_DIR) || !fs.statSync(OUT_DIR).isDirectory()) {
    console.error(`❌ Static export directory not found: ${OUT_DIR}`);
    console.error(`   Run "npm run build:export" first.`);
    process.exit(1);
  }

  const dynamicPrefixes = collectDynamicPrefixes();
  const htmlFiles = listHtmlFiles(OUT_DIR);
  if (htmlFiles.length === 0) {
    console.error(`❌ No HTML files found in ${OUT_DIR} — export produced no pages.`);
    process.exit(1);
  }

  const broken = [];
  const dynamic = [];
  const checked = new Set();
  let scannedRefs = 0;

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, "utf8");
    const refs = extractRefs(html);

    for (const ref of refs) {
      scannedRefs += 1;
      const result = resolveRef(ref, file, dynamicPrefixes);
      if (result.kind === "skip") continue;

      const key = `${result.kind}:${result.target}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const relativeFile = path.relative(process.cwd(), file);
      if (result.kind === "ok") {
        if (VERBOSE) console.log(`   ✅ ${ref} (${relativeFile})`);
        continue;
      }
      if (result.kind === "dynamic") {
        dynamic.push({ ref, file: relativeFile });
        continue;
      }
      broken.push({ ref, file: relativeFile });
    }
  }

  const okCount = [...checked].filter((k) => k.startsWith("ok:")).length;

  console.log("\n" + "=".repeat(60));
  console.log("🔗 Static export link check");
  console.log("=".repeat(60));
  console.log(`  Export dir : ${path.relative(process.cwd(), OUT_DIR) || "."}`);
  console.log(`  HTML files : ${htmlFiles.length}`);
  console.log(`  References : ${scannedRefs} scanned, ${okCount} unique resolved`);
  console.log(`  Dynamic    : ${dynamic.length} (dynamic route targets, not statically validated)`);
  console.log(`  Broken     : ${broken.length}\n`);

  if (dynamic.length > 0) {
    console.log("⚠️  Dynamic route targets (cannot be validated statically):");
    dynamic.forEach(({ ref, file }) => console.log(`   • ${ref}  ← ${file}`));
    console.log("");
  }

  if (broken.length > 0) {
    console.log("❌ Broken internal links:");
    broken.forEach(({ ref, file }) => console.log(`   • ${ref}  ← ${file}`));
    console.log("");
  }

  const failed = broken.length > 0 || (STRICT && dynamic.length > 0);
  if (failed) {
    console.log("✗ Link check failed.\n");
    process.exit(1);
  }

  console.log("✅ Zero broken links in static export.\n");
}

main();
