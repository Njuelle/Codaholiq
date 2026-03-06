# Stage 1: Install dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy package files for production install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy built API
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Copy built web app (served by API or separate nginx)
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Copy migrations
COPY --from=build /app/apps/api/src/database/migrations ./apps/api/src/database/migrations

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S codaholiq -u 1001 -G nodejs
USER codaholiq

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
