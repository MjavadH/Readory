# Readory Server

The Readory server is a NestJS API application that powers authentication, catalog management, chapter access, reading sessions, wallets, media, storage, dashboards, and administrative workflows for the Readory platform.

## Overview

The backend exposes REST-style controllers over a PostgreSQL data model. It uses Prisma for persistence, Passport/JWT for authentication, Redis-backed cache services, and S3-compatible object storage for chapter and media content.

## Architecture

The server follows a NestJS module structure. Each feature directory typically contains a module, controller, service, DTOs when needed, and unit tests.

Core modules include:

- `AuthModule` for registration, OTP verification, login, logout, JWT validation, roles, and permissions.
- `UsersModule` for user, profile, role, ban, balance, and permission operations.
- `WalletsModule` for wallet balance and transactions.
- `BooksModule`, `ChaptersModule`, `GenresModule`, and `BookTypesModule` for catalog management.
- `ReaderModule` for reader sessions, manifests, pages, text, context, and progress.
- `MediaModule` and `StorageModule` for upload, media metadata, object storage, and content retrieval.
- `DashboardModule` and `PublicModule` for frontend dashboard and public catalog data.
- `PrismaModule`, `RedisModule`, and `CacheModule` for data access and infrastructure services.

`main.ts` configures Helmet, CORS, cookie parsing, and global validation pipes with whitelisting and transformation enabled.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Framework | NestJS 11, TypeScript, RxJS, reflect-metadata |
| Database | PostgreSQL, Prisma Client, Prisma migrations, `pg`, `@prisma/adapter-pg` |
| Authentication | Passport local strategy, Passport JWT strategy, `@nestjs/jwt`, argon2, cookie-parser |
| Authorization | Role decorators/guards and permission decorators/guards |
| Validation | class-validator, class-transformer, Nest ValidationPipe |
| Cache | Redis through ioredis and custom cache manager/serializer services |
| Storage | AWS SDK S3 client, S3 presigner, S3-compatible object storage |
| Upload/media processing | Multer, file-type, Sharp, UUID |
| Security middleware | Helmet, CORS credentials configuration, validation whitelisting |
| Testing | Jest, ts-jest, Supertest, Nest testing utilities |
| Tooling | Nest CLI, ESLint, Prettier, TypeScript |

## API Overview

Controllers are organized around domain resources:

| Controller prefix | Responsibility |
| --- | --- |
| `/auth` | Register, verify OTP, login, logout, and profile retrieval. |
| `/users` | User listing, user details, profile updates, roles, bans, balances, permissions, and stats. |
| `/wallet` | Wallet summary, transactions, and deposits. |
| `/books` | Book browsing, admin book retrieval, CRUD, ratings, favorites, related books, and viewer state. |
| `/books/:bookId/chapters` | Chapter list, admin chapter list, chapter CRUD, access checks, and purchases. |
| `/admin/books/:bookId/chapters/:index/content` | Chapter content retrieval, image uploads, text uploads, append operations, and content deletion. |
| `/reader` | Reader sessions, admin reader sessions, manifests, pages, text, context, and progress saving. |
| `/media` | Media listing, upload, metadata update, retrieval, thumbnails, and deletion. |
| `/genres` | Genre list, featured genres, admin list, CRUD, and genre details. |
| `/book-types` | Book type CRUD. |
| `/public` | Public catalog content, genres, genre browsing, book types, and book type browsing. |
| `/dashboard` | User dashboard, history, history export, library, progress, and admin dashboard data. |
| `/storage` | Storage-related controller entry point. |

## Authentication & Authorization

Authentication is implemented with Passport strategies:

- Local authentication validates a login identifier and password.
- Password hashes are created and verified with argon2.
- JWTs are signed with `JWT_SECRET` and configured by `JWT_EXPIRES_IN`.
- JWT extraction reads the `access_token` cookie from incoming requests.
- The JWT strategy validates the user against Prisma and rejects banned users.
- Session user data is cached in Redis through the cache manager.
- Profile responses intentionally return a safe profile shape rather than password hashes or internal auth data.

Authorization is implemented with role and permission decorators/guards:

- Roles distinguish standard users from admins.
- Admin profiles may include permission names such as `MANAGE_BOOKS`, `MANAGE_USERS`, `MANAGE_FINANCE`, and `MANAGE_STAFF`.
- Guards enforce route-level role and permission checks where controllers apply them.

## Database

The server uses Prisma with PostgreSQL. The schema is located at `prisma/schema.prisma`; migrations are stored under `prisma/migrations/`.

Primary data models include:

- `User`, `Role`, `Wallet`, and `WalletTransaction` for accounts and balances.
- `Book`, `BookType`, `Genre`, and `BookGenre` for the catalog.
- `Chapter`, `AccessRecord`, and `ReadingProgress` for purchases and reading state.
- `BookRating`, `Collection`, and `CollectionItem` for engagement and curated book lists.
- `Media` for uploaded media metadata.

Useful Prisma commands from the `server/` directory:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

For tests, `server/.env.test.example` documents a dedicated test database connection and placeholder Redis/S3 settings.

## File Storage

The server uses an S3-compatible storage service for chapter and content objects:

- `StorageService` wraps the AWS SDK S3 client.
- The bucket is configured with `S3_BUCKET_NAME`.
- The service can verify bucket access on startup and optionally create the bucket when `S3_AUTO_CREATE_BUCKET=true`.
- Supported operations include object upload, JSON upload, buffer upload, stream/buffer retrieval, object metadata checks, prefix listing, prefix deletion, and key deletion.
- Media and chapter content services build on this storage layer.

## Security

Implemented security mechanisms include:

- Helmet middleware for HTTP security headers.
- CORS configuration from `CORS_ORIGIN` with credentials enabled.
- Cookie parsing for JWT authentication.
- Global `ValidationPipe` with `whitelist: true` and `transform: true`.
- argon2 password hashing.
- JWT expiration and secret configuration.
- Banned-user checks during credential validation, profile retrieval, and JWT validation.
- Role and permission guards for protected operations.
- Server-side file type and image tooling dependencies for upload/media workflows.

## Background Processing

No separate queue worker, scheduler, or background processing service is defined in the repository. The server does perform some asynchronous side effects during request handling, such as updating `lastLoginAt` after login and cache writes during JWT validation.

## Environment Variables

Create `server/.env` from `server/.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. |
| `JWT_SECRET` | Yes | Secret key used to sign and verify JWTs. |
| `JWT_EXPIRES_IN` | Yes | JWT lifetime in seconds. |
| `PORT` | Yes | Port for the NestJS server. |
| `CORS_ORIGIN` | Yes | Comma-separated list of allowed origins. |
| `SEED_ADMIN_PASSWORD` | Seed only | Initial admin password used by `prisma/seed.ts`. |
| `REDIS_HOST` | Yes | Redis host. |
| `REDIS_PORT` | Yes | Redis port. |
| `SUPER_ADMIN_ID` | Yes | User id used for super-admin behavior. |
| `S3_ENDPOINT` | Yes | S3-compatible endpoint. |
| `S3_REGION` | Yes | S3 region. |
| `S3_ACCESS_KEY_ID` | Yes | S3 access key id. |
| `S3_SECRET_ACCESS_KEY` | Yes | S3 secret access key. |
| `S3_BUCKET_NAME` | Yes | Bucket used for chapter and content storage. |
| `S3_FORCE_PATH_STYLE` | Provider-dependent | Enables path-style S3 URLs for compatible providers. |
| `S3_PUBLIC_BASE_URL` | Optional/provider-dependent | Public base URL for stored content. |
| `S3_AUTO_CREATE_BUCKET` | Optional | Allows bucket creation during startup when set to `true`. |
| `NODE_ENV` | Optional | Runtime environment; documented in the test env example. |

Never commit real secrets or production credentials.

## Development

Install dependencies from the repository root:

```bash
npm install
```

Build the shared package before running the server:

```bash
npm run build:shared
```

Run the server in watch mode:

```bash
npm --workspace server run start:dev
```

Run database migrations from `server/`:

```bash
cd server
npx prisma migrate dev
```

Seed the database when needed:

```bash
cd server
npx prisma db seed
```

## Build & Production

Build the server:

```bash
npm --workspace server run build
```

Start the compiled server:

```bash
npm --workspace server run start:prod
```

The compiled output is written to `server/dist/`.

Before production startup, ensure that:

- `DATABASE_URL` points to the target PostgreSQL database.
- Prisma migrations have been applied.
- Redis is reachable.
- S3-compatible storage credentials and bucket configuration are valid.
- `JWT_SECRET` is set to a strong secret.
- `CORS_ORIGIN` includes the deployed frontend origin.

## Development Commands

| Command | Description |
| --- | --- |
| `npm run build` | Compiles the NestJS server. |
| `npm run format` | Formats `src/**/*.ts` and `test/**/*.ts` with Prettier. |
| `npm run start` | Starts the NestJS server. |
| `npm run start:dev` | Starts the server in watch mode. |
| `npm run start:debug` | Starts the server in debug watch mode. |
| `npm run start:prod` | Runs `node dist/main`. |
| `npm run lint` | Runs ESLint with automatic fixes. |
| `npm run test` | Runs unit tests. |
| `npm run test:watch` | Runs unit tests in watch mode. |
| `npm run test:cov` | Runs tests with coverage. |
| `npm run test:debug` | Runs Jest with the Node inspector. |
| `npm run test:e2e` | Runs e2e tests using `test/jest-e2e.json`. |

## Folder Structure

```text
server/
├── prisma/               # Prisma schema, migrations, and seed script
├── src/
│   ├── auth/             # Authentication, JWT/local strategies, roles, permissions
│   ├── book-types/       # Book type management
│   ├── books/            # Book catalog APIs and services
│   ├── cache/            # Redis-backed cache utilities
│   ├── chapters/         # Chapter management and chapter content APIs
│   ├── common/           # Shared backend utility functions
│   ├── dashboard/        # User/admin dashboard data
│   ├── genre/            # Genre management
│   ├── media/            # Media upload and retrieval
│   ├── prisma/           # Prisma module and service
│   ├── public/           # Public catalog APIs
│   ├── reader/           # Reader sessions, manifests, pages, text, progress
│   ├── redis/            # Redis provider module
│   ├── storage/          # S3-compatible object storage service
│   ├── users/            # User management and profile operations
│   ├── wallets/          # Wallet balances and transactions
│   ├── app.module.ts     # Root NestJS module
│   └── main.ts           # Application bootstrap
├── test/                 # E2E tests, setup, mocks, and test utilities
├── docs/                 # Backend design notes
├── package.json          # Server scripts and dependencies
└── tsconfig*.json        # TypeScript configuration
```

## Operational Notes

- The server defaults to `PORT=3000` when no port is provided.
- If `CORS_ORIGIN` is not set, the bootstrap code falls back to `http://localhost:3001`.
- Redis defaults in code are `localhost` and `6379` when host or port are not provided.
- `StorageService` validates S3 bucket access on module initialization.
- Set `S3_AUTO_CREATE_BUCKET=false` in environments where infrastructure should be provisioned externally.
- Use a dedicated database for e2e/integration tests; `server/.env.test.example` is intentionally separate from the main env example.
- The Jest unit-test configuration maps `@readory/shared` to the shared icon keys file for server tests.
