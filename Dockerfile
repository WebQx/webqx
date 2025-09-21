##########
# Builder stage: install devDeps and build static artifacts
##########
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build assets for production (CSS + portal + assembled dist)
RUN npm run build:css:prod && npm run build

##########
# Runtime stage: production-only deps + built assets
##########
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code first, then overlay built artifacts from builder
COPY . .
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S webqx -u 1001 \
    && chown -R webqx:nodejs /app
USER webqx

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=5 \
    CMD node -e "const http = require('http'); \
    const port = parseInt(process.env.PORT || '3000', 10); \
    const options = { hostname: '127.0.0.1', port, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { if (res.statusCode === 200) process.exit(0); else process.exit(1); }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Start the application (serve built dist and APIs)
CMD ["node", "server.js"]