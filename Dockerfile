# syntax=docker/dockerfile:1
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Prefer reproducible installs; fall back to npm install if no lockfile exists
RUN npm ci --omit=dev || npm install --production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# If your app has a build step (e.g., TypeScript), uncomment:
# RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
