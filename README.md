# Readory

Readory is a custom npm-workspace monorepo with a Next.js frontend, NestJS backend, shared TypeScript package, PostgreSQL, Redis, and S3-compatible object storage.

## Architecture overview

```text
Readory/
├── frontend/   # Next.js + React + TypeScript
├── server/     # NestJS + Prisma
├── shared/     # @readory/shared workspace package
└── docker-compose.yml
```

The root `package.json` owns npm workspaces. `frontend` and `server` both depend on `@readory/shared`, so Docker builds compile the shared package before building each application.

## Docker architecture

```text
Browser
  │
  ├── http://localhost:3001 ──► frontend (Next.js)
  │                                │
  └── http://localhost:3000 ───────┴──► backend (NestJS)
                                           │
                                           ├── postgres:5432 (internal)
                                           ├── redis:6379 (internal)
                                           ├── minio:9000 (internal S3 API)
                                           └── /app/server/uploads (persistent covers)
```

Services:

| Service | Image/build | Host exposure | Persistent data |
| --- | --- | --- | --- |
| `frontend` | `frontend/Dockerfile` | `${FRONTEND_PORT:-3001}` | none |
| `backend` | `server/Dockerfile` | `${BACKEND_PORT:-3000}` | `uploads_data` |
| `postgres` | `postgres:17.2-alpine` | internal only | `postgres_data` |
| `redis` | `redis:7.4.1-alpine` | internal only | `redis_data` |
| `minio` | pinned MinIO release | `${MINIO_API_PORT:-9000}`, `${MINIO_CONSOLE_PORT:-9001}` | `minio_data` |

## Environment variables

Copy the example file and edit secrets before starting:

```bash
cp .env.example .env
```

Important variables:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL database and credentials. |
| `DATABASE_URL` | Composed for the backend in Docker using the `postgres` service name. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Backend JWT signing secret and lifetime. Use a strong production secret. |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins. Defaults to `http://localhost:3001`. |
| `REDIS_HOST`, `REDIS_PORT` | Set to `redis:6379` by Docker Compose. |
| `NEXT_PUBLIC_API_BASE` | Browser-visible backend URL. For local Docker this remains `http://localhost:3000`. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3-compatible provider settings. |
| `S3_BUCKET_CHAPTERS` | Bucket for book/chapter assets. |
| `S3_FORCE_PATH_STYLE` | Use `true` for MinIO; cloud providers may use `false`. |
| `S3_PUBLIC_BASE_URL` | Public bucket/object base URL when needed by the app. |
| `S3_AUTO_CREATE_BUCKET` | Convenient for local MinIO; disable in locked-down production. |
| `RUN_MIGRATIONS` | When `true`, backend startup runs `npx prisma migrate deploy`. |

## Local production-like startup

```bash
cp .env.example .env
# edit .env and replace all change-me values
docker compose up -d --build
```

Open:

* Frontend: <http://localhost:3001>
* Backend health: <http://localhost:3000/health>
* MinIO console: <http://localhost:9001>

Check status:

```bash
docker compose ps
docker compose logs -f backend
```

## Development workflow with hot reload

The optional override keeps infrastructure services from `docker-compose.yml` and runs frontend/backend dev commands with source mounts:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Backend migrations are not automatically run by the dev override. Run them explicitly when needed:

```bash
docker compose exec backend npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

## Production deployment workflow

1. Provide production secrets through your deployment platform, not committed files.
2. Set `POSTGRES_*` or an external `DATABASE_URL` equivalent for the backend.
3. Set `S3_*` for AWS S3, Cloudflare R2, MinIO, or another S3-compatible provider.
4. Set `S3_AUTO_CREATE_BUCKET=false` unless the runtime identity is intentionally allowed to create buckets.
5. Set `CORS_ORIGIN` to the public frontend origin.
6. Run:

```bash
docker compose up -d --build
```

The backend entrypoint runs:

```bash
npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

This preserves the existing Prisma migration history and does not use `prisma db push`.

## Database migration workflow

* Create new migrations during development using Prisma's migration tooling.
* Commit migration files under `server/prisma/migrations`.
* Deploy with `npx prisma migrate deploy` in containers or CI/CD.
* Do not replace migrations with `prisma db push` in production.

Manual deployment command:

```bash
docker compose exec backend npx prisma migrate deploy --schema=server/prisma/schema.prisma
```

## MinIO configuration

MinIO is only the local S3-compatible development replacement. The app remains configured through generic `S3_*` variables and is not coupled to MinIO-specific application code.

Default local Docker values:

```env
S3_ENDPOINT=http://minio:9000
S3_FORCE_PATH_STYLE=true
S3_BUCKET_CHAPTERS=readory-book
S3_PUBLIC_BASE_URL=http://localhost:9000/readory-book
```

Use the MinIO console at <http://localhost:9001> with `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`.

## S3 migration notes

For AWS S3 or another provider:

* Change `S3_ENDPOINT` as required by the provider. AWS S3 may leave it unset if supported by your deployment configuration.
* Set `S3_REGION` to the provider region.
* Set `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` to production credentials.
* Set `S3_FORCE_PATH_STYLE=false` for virtual-hosted-style providers when appropriate.
* Set `S3_PUBLIC_BASE_URL` to the CDN or public bucket URL if assets are served directly.
* Keep `server/uploads` persistent; cover images stored there are intentionally not migrated to S3 by this Dockerization.

## Backup and restore

PostgreSQL backup:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > readory.sql
```

PostgreSQL restore:

```bash
cat readory.sql | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Redis backup data is stored in the `redis_data` named volume with append-only persistence enabled.

MinIO data is stored in `minio_data`. Use S3 tooling such as `mc mirror` or provider-native backups for production object storage.

Uploads are stored in the `uploads_data` named volume. Back it up before host migration or destructive volume operations.

## Troubleshooting

* **Backend cannot connect to PostgreSQL**: confirm `postgres` is healthy with `docker compose ps` and that `POSTGRES_PASSWORD` is set in `.env`.
* **Migrations fail**: inspect `docker compose logs backend`; the backend entrypoint uses `npx prisma migrate deploy --schema=server/prisma/schema.prisma`.
* **Redis connection errors**: ensure the backend env uses `REDIS_HOST=redis` and `REDIS_PORT=6379` inside Docker.
* **MinIO/S3 errors**: verify `S3_ENDPOINT`, credentials, bucket name, and `S3_FORCE_PATH_STYLE=true` for MinIO.
* **Frontend cannot call backend from browser**: `NEXT_PUBLIC_API_BASE` must be browser reachable, usually `http://localhost:3000` for local Compose.
* **CORS errors**: add the frontend origin to `CORS_ORIGIN`; multiple origins are comma-separated.
* **Uploaded covers disappear**: ensure the `uploads_data` volume exists and is mounted at `/app/server/uploads`.

## Security notes

* Application images run as non-root users.
* PostgreSQL and Redis are not exposed on host ports by default.
* Secrets are environment-driven and should be supplied by `.env`, CI/CD secrets, or a secret manager.
* Containers avoid privileged mode and unnecessary Linux capabilities.
* Images use explicit versions instead of `latest` tags.
