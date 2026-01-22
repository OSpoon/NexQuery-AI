# Build Stage
FROM node:22-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
RUN corepack enable

WORKDIR /app

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy frontend
COPY frontend ./frontend

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build the frontend
WORKDIR /app/frontend
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm run build

# Production Stage
FROM nginx:alpine AS production

# Copy built assets from build stage
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration if exists, otherwise use default
COPY --from=build /app/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
