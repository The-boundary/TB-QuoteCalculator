# Multi-stage Dockerfile for TB-QuoteCalculator
# Stage 1: Build client
FROM node:20-alpine AS client-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Copy vendored dependencies (design system tgz)
COPY vendor ./vendor

RUN echo "legacy-peer-deps=true" > .npmrc

# Install dependencies
RUN npm install --workspace=client --workspace=shared

RUN rm -f .npmrc

# Copy source files
COPY client ./client
COPY shared ./shared
COPY tsconfig.base.json ./

# Build-time Supabase config for Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_SLUG
ARG GIT_COMMIT_HASH

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_SLUG=$VITE_APP_SLUG
ENV GIT_COMMIT_HASH=$GIT_COMMIT_HASH

# Build client (skip tsc type check, just use vite)
RUN cd client && npx vite build

# Stage 2: Build server and shared together
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy all package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY shared/package*.json ./shared/

# Copy vendored dependencies (needed for workspace resolution)
COPY vendor ./vendor

RUN echo "legacy-peer-deps=true" > .npmrc

# Install ALL dependencies (needed for workspace build)
RUN npm install

RUN rm -f .npmrc

# Copy all source files
COPY server ./server
COPY client ./client
COPY shared ./shared
COPY tsconfig.base.json ./

# Build server using esbuild (bundles shared types automatically)
RUN npm run build --workspace=server

# Stage 3: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files for production dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Enable legacy-peer-deps for lockfile compatibility
RUN echo "legacy-peer-deps=true" > .npmrc

# Install production dependencies only
RUN npm install --workspace=server --workspace=shared --omit=dev

# Remove .npmrc
RUN rm -f .npmrc

# Copy built server
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/shared ./shared

# Copy built client to serve statically
COPY --from=client-builder /app/client/dist ./client/dist

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3048

EXPOSE 3048

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3048}/api/health || exit 1

# Start with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/dist/index.js"]
