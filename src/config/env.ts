// src/config/env.ts

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[StellarFlow] Missing required environment variable: "${name}"\n` +
        `Please add it to your .env.local file.`
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_API_URL: requireEnv("NEXT_PUBLIC_API_URL"),
} as const;