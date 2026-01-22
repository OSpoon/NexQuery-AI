# Base stage for shared dependencies and pnpm setup
FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
RUN corepack enable

# Install curl for API data source execution
RUN apk add --no-cache curl tzdata

WORKDIR /app

# --- Build Stage ---
FROM base AS build

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy backend
COPY backend ./backend

# Install dependencies (only what's needed for backend and shared)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the backend
WORKDIR /app/backend
RUN node ace build

# --- Production Stage ---
FROM base AS production

ENV NODE_ENV=production

WORKDIR /app

# Copy workspace configuration and shared package
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared

# Copy the build artifact and its package.json
COPY --from=build /app/backend/build ./backend/build
COPY --from=build /app/backend/package.json ./backend/package.json

# Install production dependencies for the workspace
# We use --no-frozen-lockfile to allow pnpm to adjust the lockfile for the production-only install if needed
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

# Expose the application port
EXPOSE 3333

# Start the server from the build directory
WORKDIR /app/backend/build
CMD ["node", "bin/server.js"]
