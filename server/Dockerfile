# syntax=docker/dockerfile:1.7
FROM node:22.13.1-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY shared ./shared
COPY server ./server
RUN npm --workspace @readory/shared run build \
    && npx prisma generate --schema=server/prisma/schema.prisma \
    && npm --workspace server run build

FROM node:22.13.1-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home /app readory \
    && mkdir -p /app/server/uploads \
    && chown -R readory:nodejs /app
COPY --from=builder --chown=readory:nodejs /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=readory:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=readory:nodejs /app/shared ./shared
COPY --from=builder --chown=readory:nodejs /app/server/package.json ./server/package.json
COPY --from=builder --chown=readory:nodejs /app/server/dist ./server/dist
COPY --from=builder --chown=readory:nodejs /app/server/prisma ./server/prisma
COPY --chown=readory:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
USER readory
EXPOSE 3000
VOLUME ["/app/server/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server/dist/main"]
