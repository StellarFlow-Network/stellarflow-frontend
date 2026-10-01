// src/config/env.ts

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `[StellarFlow] Missing required environment variable: "${name}"\n` +
        `Please add it to your .env.local file.`
    );
  }
  return value;
}

export const env = {
  // NOTE: the value must be read through a *static* member expression so
  // Next.js can inline `NEXT_PUBLIC_*` variables into client bundles. A
  // dynamic `process.env[name]` lookup is not replaced at build time and
  // throws in the browser, where `process.env` is empty.
  NEXT_PUBLIC_API_URL: requireEnv(
    "NEXT_PUBLIC_API_URL",
    process.env.NEXT_PUBLIC_API_URL
  ),
} as const;

export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev';