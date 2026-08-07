# Production image for Dokploy. It intentionally contains no .env file;
# configure runtime secrets in Dokploy's Environment tab instead.
FROM node:20-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies before application files so Docker can reuse this layer.
COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node client ./client
COPY --chown=node:node server ./server

USER node
EXPOSE 3000

# Node 20 provides fetch, avoiding an extra curl/wget dependency.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
