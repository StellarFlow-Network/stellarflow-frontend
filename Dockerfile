# Stage 1: Install dependencies and build the Next.js application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json yarn.lock ./

# Install build tools for native modules like `iltorb` (used by shrink-ray-current)
# if you are using a custom server with shrink-ray-current.
# Otherwise, this step is not needed.
RUN apk add --no-cache python3 make g++

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js application
# NEXT_TELEMETRY_DISABLED=1 disables Next.js telemetry during build
RUN NEXT_TELEMETRY_DISABLED=1 yarn build

# Stage 2: Run the Next.js application
FROM node:18-alpine AS runner

WORKDIR /app

# Set environment variables for production
ENV NODE_ENV production

# Copy necessary files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 3000

# Start the Next.js application
# If using a custom server.js, change this to `node server.js`
CMD ["yarn", "start"]