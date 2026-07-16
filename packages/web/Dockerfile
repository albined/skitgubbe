# Stage 1: Build SvelteKit application
FROM oven/bun:1 AS builder
WORKDIR /usr/src/app

# Copy package files for workspace dependency caching
COPY package.json bun.lock ./
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (workspaces resolved automatically)
RUN bun install --frozen-lockfile

# Copy codebase
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

# Build the web application
RUN bun run --filter web build

# Stage 2: Production runner
FROM oven/bun:1-slim AS runner
WORKDIR /usr/src/app

# Copy built server output and metadata
COPY --from=builder /usr/src/app/packages/web/build ./build
COPY --from=builder /usr/src/app/packages/web/package.json ./package.json

# Copy node_modules & shared code (needed for dependencies at runtime)
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/packages/shared ./packages/shared

# Run on port 3000 inside the container
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Execute SvelteKit built server index file using Bun
CMD ["bun", "run", "build/index.js"]
