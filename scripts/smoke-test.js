#!/usr/bin/env node

/**
 * Post-deployment smoke test (Issue #1016).
 *
 * Asserts that the core routes of the deployed static site are reachable
 * through CloudFront after `aws s3 sync` + cache invalidation.
 *
 * Exit codes:
 *   0  every route returned a usable HTML document
 *   1  at least one route failed after the configured retries
 *
 * Usage:
 *   node scripts/smoke-test.js --base-url https://d111.cloudfront.net
 *   SMOKE_BASE_URL=https://... npm run smoke:test
 */

const { URL } = require("url");

const args = process.argv.slice(2);

function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const BASE_URL =
  argValue("--base-url", process.env.SMOKE_BASE_URL || process.env.DEPLOY_URL || "").replace(/\/+$/, "");

const TIMEOUT_MS = Number(argValue("--timeout", process.env.SMOKE_TIMEOUT || 15000));
const RETRIES = Number(argValue("--retries", process.env.SMOKE_RETRIES || 3));
const RETRY_DELAY_MS = Number(argValue("--retry-delay", 3000));

const DEFAULT_ROUTES = [
  "/",
  "/dashboard",
  "/swap",
  "/charts",
  "/governance",
  "/settings",
];

const ROUTES = argValue(
  "--routes",
  process.env.SMOKE_ROUTES || ""
)
  ? argValue("--routes", process.env.SMOKE_ROUTES || "").split(",").map((r) => r.trim()).filter(Boolean)
  : DEFAULT_ROUTES;

const NOT_FOUND_MARKERS = ["This page could not be found", ">404<", "PAGE NOT FOUND"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkRoute(base, route) {
  const url = `${base}${route}`;
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "stellarflow-smoke-test/1.0", accept: "text/html" },
    });

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    const durationMs = Date.now() - started;

    const problems = [];
    if (status !== 200) problems.push(`HTTP ${status}`);
    if (!contentType.includes("text/html")) problems.push(`content-type: ${contentType || "(none)"}`);
    if (!/<html[\s>]/i.test(body) || !/<\/html>/i.test(body)) problems.push("not a complete HTML document");
    if (NOT_FOUND_MARKERS.some((marker) => body.includes(marker))) problems.push("404 page served");

    return { route, url, status, durationMs, problems };
  } catch (error) {
    return {
      route,
      url,
      status: 0,
      durationMs: Date.now() - started,
      problems: [error.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : error.message],
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkRouteWithRetries(base, route) {
  let lastResult;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    lastResult = await checkRoute(base, route);
    if (lastResult.problems.length === 0) {
      return { ...lastResult, attempts: attempt };
    }
    if (attempt < RETRIES) await sleep(RETRY_DELAY_MS);
  }
  return { ...lastResult, attempts: RETRIES };
}

async function main() {
  if (!BASE_URL) {
    console.error("❌ Missing base URL. Pass --base-url or set SMOKE_BASE_URL.");
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(BASE_URL);
  } catch {
    console.error(`❌ Invalid base URL: ${BASE_URL}`);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🧪 Post-deployment smoke test");
  console.log("=".repeat(60));
  console.log(`  Base URL : ${parsed.origin}${parsed.pathname}`);
  console.log(`  Routes   : ${ROUTES.length}`);
  console.log(`  Retries  : ${RETRIES} (delay ${RETRY_DELAY_MS}ms)\n`);

  const results = [];
  for (const route of ROUTES) {
    const result = await checkRouteWithRetries(BASE_URL, route);
    results.push(result);
    const ok = result.problems.length === 0;
    const badge = ok ? "✅" : "❌";
    console.log(`${badge} ${route.padEnd(20)} ${String(result.status).padEnd(4)} ${result.durationMs}ms${ok ? "" : `  → ${result.problems.join(", ")}`}`);
  }

  const failures = results.filter((r) => r.problems.length > 0);
  const p95 = results.map((r) => r.durationMs).sort((a, b) => a - b)[results.length - 1];

  console.log("\n" + "-".repeat(60));
  console.log(`Routes checked : ${results.length}`);
  console.log(`Passed         : ${results.length - failures.length}`);
  console.log(`Failed         : ${failures.length}`);
  console.log(`Slowest route  : ${p95}ms`);

  if (failures.length > 0) {
    console.log("\n❌ Smoke test failed for:");
    failures.forEach((f) => console.log(`   • ${f.url} — ${f.problems.join(", ")}`));
    console.log("");
    process.exit(1);
  }

  console.log("\n✅ All core routes are available after deployment.\n");
}

main();
