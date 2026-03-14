FROM node:20-alpine

# Create app directory
WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy source
COPY . .

# Ensure data dir exists for optional SQLite persistence
RUN mkdir -p /app/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O - http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
