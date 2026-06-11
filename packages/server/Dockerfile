FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Copy package files for workspace dependency caching
COPY package.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (workspaces resolved automatically)
RUN bun install

# Copy codebase
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Expose server port
EXPOSE 3000

# Set default production settings
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/skitgubbe.db

# Ensure directory for persistent volume mount exists
RUN mkdir -p /app/data

CMD ["bun", "run", "--filter", "server", "src/index.ts"]
