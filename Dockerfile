# Single-process PvP server: HTTP static files + authoritative Season 0 room state + native ws.
# Production installs pinned ws; no browser framework/runtime is needed.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    PVP_REQUIRE_WS=1
COPY --chown=node:node package.json package-lock.json server.js ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node scripts/precompress-static.mjs scripts/hydrate-duplicate-assets.mjs scripts/asset-dedup-manifest.json ./scripts/
RUN node ./scripts/hydrate-duplicate-assets.mjs && node ./scripts/precompress-static.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
