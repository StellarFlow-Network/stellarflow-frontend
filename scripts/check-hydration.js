#!/usr/bin/env node

/**
 * Static export hydration / runtime console check (Issue #1016).
 *
 * Serves the `out/` directory produced by `NEXT_OUTPUT_MODE=export next build`
 * with a plain static file server, loads every exported route in headless
 * Chromium and fails when React reports an SSR hydration mismatch or when the
 * page throws an uncaught runtime error.
 *
 * Exit codes:
 *   0  no hydration mismatches and no page errors
 *   1  hydration mismatch, page error, or Playwright/browser unavailable
 *
 * Usage:
 *   node scripts/check-hydration.js [--dir out] [--port 4173] [--max-routes 30]
 */

const fs = require("fs");
const http = require("http");
const path = require("path");

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const OUT_DIR = path.resolve(process.cwd(), argValue("--dir", "out"));
const PORT = Number(argValue("--port", 4173));
const MAX_ROUTES = Number(argValue("--max-routes", 30));

const HYDRATION_PATTERNS = [
  /hydrat/i,
  /did not match/i,
  /text content did not match/i,
  /server rendered html didn'?t match/i,
  /minified react error #4(18|23|25)/i,
  /error #4(18|23|25)/,
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function resolveStaticFile(requestPath) {
  const clean = decodeURIComponent(requestPath.split("?")[0].split("#")[0]);
  const candidate = path.join(OUT_DIR, clean);

  if (!candidate.startsWith(OUT_DIR)) return null;

  const tries = [];
  if (clean.endsWith("/")) {
    tries.push(path.join(candidate, "index.html"));
  } else {
    tries.push(candidate);
    if (!path.extname(candidate)) {
      tries.push(`${candidate}.html`, path.join(candidate, "index.html"));
    }
  }

  for (const file of tries) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const file = resolveStaticFile(req.url || "/");
    if (!file) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html><body><h1>404</h1></body></html>");
      return;
    }
    const type = MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

function listRoutes(dir) {
  const routes = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_next") continue;
        walk(full);
      } else if (entry.name === "index.html") {
        const relative = path.relative(dir, path.dirname(full));
        routes.push(relative === "" ? "/" : `/${relative.split(path.sep).join("/")}/`);
      }
    }
  };
  walk(dir);
  return routes.sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b))).slice(0, MAX_ROUTES);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`❌ Static export directory not found: ${OUT_DIR}`);
    console.error(`   Run "npm run build:export" first.`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch {
    console.error('❌ Playwright is not installed. Run "npm ci" (or npm install) first.');
    process.exit(1);
  }

  const routes = listRoutes(OUT_DIR);
  if (routes.length === 0) {
    console.error(`❌ No exported routes found in ${OUT_DIR}.`);
    process.exit(1);
  }

  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();

  console.log("\n" + "=".repeat(60));
  console.log("💧 Static export hydration check");
  console.log("=".repeat(60));
  console.log(`  Export dir : ${path.relative(process.cwd(), OUT_DIR) || "."}`);
  console.log(`  Routes     : ${routes.length}`);
  console.log(`  Server     : ${baseUrl}\n`);

  const failures = [];
  const warnings = [];

  try {
    for (const route of routes) {
      const context = await browser.newContext();
      const page = await context.newPage();

      const messages = [];
      const pageErrors = [];

      page.on("console", (msg) => {
        const text = msg.text();
        const type = msg.type();
        if (type === "error" || type === "warning") messages.push({ type, text });
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      let status = 0;
      try {
        const response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: "load",
          timeout: 30000,
        });
        status = response ? response.status() : 0;
        await page.waitForTimeout(400);
      } catch (error) {
        failures.push({ route, reason: `navigation failed: ${error.message}` });
        await context.close();
        continue;
      }

      const hydrationHits = [
        ...messages.filter((m) => HYDRATION_PATTERNS.some((p) => p.test(m.text))),
        ...pageErrors.filter((text) => HYDRATION_PATTERNS.some((p) => p.test(text))),
      ];
      const otherErrors = messages.filter((m) => m.type === "error" && !HYDRATION_PATTERNS.some((p) => p.test(m.text)));

      if (status !== 200) {
        failures.push({ route, reason: `HTTP ${status}` });
      } else if (hydrationHits.length > 0) {
        failures.push({ route, reason: `hydration mismatch: ${hydrationHits[0].text}` });
      } else if (pageErrors.length > 0) {
        failures.push({ route, reason: `uncaught error: ${pageErrors[0]}` });
      } else if (otherErrors.length > 0) {
        warnings.push({ route, reason: otherErrors[0].text });
      }

      const ok = status === 200 && hydrationHits.length === 0 && pageErrors.length === 0;
      console.log(`${ok ? "✅" : "❌"} ${route.padEnd(30)} ${status}${ok ? "" : `  ${failures[failures.length - 1]?.reason || ""}`}`);

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (warnings.length > 0) {
    console.log("\n⚠️  Non-hydration console errors (not fatal):");
    warnings.forEach((w) => console.log(`   • ${w.route} — ${w.reason}`));
  }

  if (failures.length > 0) {
    console.log("\n❌ Hydration check failed:");
    failures.forEach((f) => console.log(`   • ${f.route} — ${f.reason}`));
    console.log("");
    process.exit(1);
  }

  console.log(`\n✅ ${routes.length} routes loaded with zero hydration mismatches.\n`);
}

main().catch((error) => {
  console.error("❌ Hydration check crashed:", error);
  process.exit(1);
});
