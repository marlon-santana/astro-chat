FROM node:20-bullseye-slim

# Use Debian-based image so native modules can be compiled reliably
WORKDIR /app

ENV NODE_ENV=production

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && \
		apt-get install -y --no-install-recommends \
			build-essential python3 pkg-config libc6-dev libsqlite3-dev ca-certificates \
			libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev libpng-dev librsvg2-dev && \
		rm -rf /var/lib/apt/lists/*

# Copy package files and install production deps (will compile native modules)
COPY package.json package-lock.json* ./
RUN npm ci --production --unsafe-perm

# Copy app source
COPY . .

# Ensure data dir exists for optional SQLite persistence
RUN mkdir -p /app/data

# Cleanup build packages to keep image small (optional)
RUN apt-get purge -y --auto-remove build-essential python3 pkg-config && \
		rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O - http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]
