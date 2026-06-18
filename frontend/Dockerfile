# syntax=docker/dockerfile:1.7
FROM node:22.13.1-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json
COPY server/package.json server/package.json
RUN npm ci

FROM deps AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE=http://localhost:3000
ARG NEXT_PUBLIC_MEDIA_IMAGE_PROTOCOL=http
ARG NEXT_PUBLIC_MEDIA_IMAGE_HOST=localhost
ARG NEXT_PUBLIC_MEDIA_IMAGE_PORT=3000
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE} \
    NEXT_PUBLIC_MEDIA_IMAGE_PROTOCOL=${NEXT_PUBLIC_MEDIA_IMAGE_PROTOCOL} \
    NEXT_PUBLIC_MEDIA_IMAGE_HOST=${NEXT_PUBLIC_MEDIA_IMAGE_HOST} \
    NEXT_PUBLIC_MEDIA_IMAGE_PORT=${NEXT_PUBLIC_MEDIA_IMAGE_PORT} \
    NEXT_TELEMETRY_DISABLED=1
COPY shared ./shared
COPY frontend ./frontend
RUN npm --workspace @readory/shared run build \
    && npm --workspace frontend run build

FROM node:22.13.1-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home /app nextjs \
    && mkdir -p /app/frontend/.next/cache \
    && chown -R nextjs:nodejs /app
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
USER nextjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)).then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "frontend/server.js"]
