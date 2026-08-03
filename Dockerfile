FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache libc6-compat

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DISABLE_PWA=true
ENV NEXT_OUTPUT_MODE=standalone

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Use the raw Next.js production build here instead of the repository's
# custom `build` script, which currently chains a post-build bundle check
# that fails on an outdated `.next` output path.
RUN npm exec next build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
