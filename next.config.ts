import type { NextConfig } from "next";
import { execSync } from "child_process";
import withBundleAnalyzer from "@next/bundle-analyzer";
import withPWA from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const isStandaloneBuild = process.env.NEXT_OUTPUT_MODE === "standalone";

/** Vercel populates this automatically; fall back to the local git HEAD for other hosts/dev. */
function resolveCommitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const withPwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  runtimeCaching: [
    {
      urlPattern: /\/(relayers|logs|contracts)(\/.*)?$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "page-shells",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60,
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
  },
  output: isStandaloneBuild ? "standalone" : undefined,
  reactCompiler: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  compiler: {
    removeConsole: {
      exclude: ["error", "warn"],
    },
  },
  productionBrowserSourceMaps: false,
  turbopack: {},
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "stellar.org" },
      { protocol: "https", hostname: "cryptologos.cc" },
      { protocol: "https", hostname: "cdn.stellar.org" },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "framer-motion",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
    ],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      const cacheGroups =
        config.optimization?.splitChunks &&
        typeof config.optimization.splitChunks === "object"
          ? (config.optimization.splitChunks.cacheGroups as Record<
              string,
              unknown
            >)
          : null;

      if (cacheGroups) {
        cacheGroups["leaflet"] = {
          name: "vendor-leaflet",
          test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
          chunks: "all" as const,
          enforce: true,
          priority: 30,
        };

        cacheGroups["chartjs"] = {
          name: "vendor-chartjs",
          test: /[\\/]node_modules[\\/]chart\.js[\\/]/,
          chunks: "all" as const,
          enforce: true,
          priority: 30,
        };

        cacheGroups["framerMotion"] = {
          name: "vendor-framer-motion",
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          chunks: "all" as const,
          enforce: true,
          priority: 30,
        };

        cacheGroups["tanstack"] = {
          name: "vendor-tanstack",
          test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
          chunks: "all" as const,
          enforce: true,
          priority: 25,
        };
      }
    }

    return config;
  },
};

export default withSentryConfig(
  withBundleAnalyzerConfig(withPwaConfig(nextConfig)),
  {
    // Suppresses noisy Sentry CLI output during build; source map upload
    // still runs when SENTRY_AUTH_TOKEN is configured in CI.
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Upload a larger set of source maps for prettier stack traces (increases
    // build time slightly).
    widenClientFileUpload: true,

    // Route Sentry ingest requests through a same-origin path to dodge ad
    // blockers. Adds a small amount of server load.
    tunnelRoute: "/monitoring",

    // Strip Sentry logger statements from the client bundle in production.
    disableLogger: true,

    // Auto-instrument Vercel Cron Monitors.
    automaticVercelMonitors: true,
  },
);
