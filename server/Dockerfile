FROM node:22-bookworm-slim AS base

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
RUN npm ci --workspace server --include-workspace-root

COPY shared ./shared
COPY server ./server
RUN npm --workspace server run build

CMD ["npm", "--workspace", "server", "run", "start:prod"]
