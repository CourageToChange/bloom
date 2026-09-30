# Bloom — small hardened static/Express container (runs as non-root, read-only FS).
FROM node:20-bookworm-slim

WORKDIR /app

# Install only production deps (express) from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# App code (server + static client only — see .dockerignore).
COPY server.js server-auth.js store.js ./
COPY public ./public

# Writable data dir for the accounts store (the only writable path; the rest of
# the container runs read-only). Owned by node so the fresh volume inherits it.
RUN mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production
ENV PORT=4000
ENV DATA_DIR=/app/data
EXPOSE 4000

USER node
CMD ["node", "server.js"]
