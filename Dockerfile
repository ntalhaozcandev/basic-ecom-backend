FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Add non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs . .

# Create directory for logs and temp files
RUN mkdir -p /app/logs && chown nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["npm", "start"]
