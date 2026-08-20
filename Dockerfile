# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY frontend/package.json ./frontend/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci

FROM deps AS server-build
COPY shared ./shared
COPY server ./server
RUN npm run build --workspace @readory/shared \
  && npm --workspace server exec -- prisma generate --schema prisma/schema.prisma \
  && npm run build --workspace server

FROM deps AS frontend-build
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_S3_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_S3_PUBLIC_BASE_URL=${NEXT_PUBLIC_S3_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
COPY shared ./shared
COPY frontend ./frontend
RUN npm run build --workspace @readory/shared \
  && npm run build --workspace frontend

FROM deps AS migrate
ENV NODE_ENV=production
COPY shared ./shared
COPY server ./server
RUN npm run build --workspace @readory/shared \
  && npm --workspace server exec -- prisma generate --schema prisma/schema.prisma
WORKDIR /app

FROM base AS server
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm ci --omit=dev --workspace server --workspace @readory/shared --include-workspace-root=false \
  && npm cache clean --force
COPY --from=server-build /app/shared/dist ./shared/dist
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/prisma ./server/prisma
COPY --from=server-build /app/server/generated ./server/generated
COPY --from=server-build /app/node_modules/.prisma ./node_modules/.prisma
USER node
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM base AS frontend
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=frontend-build /app/frontend/.next/standalone ./
COPY --from=frontend-build /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-build /app/frontend/public ./frontend/public
USER node
WORKDIR /app/frontend
EXPOSE 3001
CMD ["node", "server.js"]
