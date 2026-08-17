# Readory Server

The Readory server is a NestJS API application for authentication, catalog operations, chapter access, reader sessions, wallets, payments, collections, notifications, search, media, audit logging, and admin workflows.

## Responsibilities

The backend provides REST-style HTTP APIs for the Next.js frontend and persists application state in PostgreSQL through Prisma. It also integrates with Redis, BullMQ, S3-compatible storage, SMTP mail, Google OAuth, Meilisearch, and scheduled background-style workers that run in the Nest process.

## Main modules

| Module                                                                        | Responsibility                                                                                                                    |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `AuthModule`                                                                  | Registration, OTP verification, login, Google auth/linking, refresh/logout, password reset, profile, and device sessions.         |
| `UsersModule`                                                                 | User/admin listing, profile updates, avatars, roles, bans, permissions, balance adjustments, and user stats.                      |
| `WalletsModule` / `PaymentsModule`                                            | Wallet summary, transactions, deposits, payment initialization, callbacks, and result lookup.                                     |
| `BooksModule`, `ChaptersModule`, `BookTypesModule`, `GenresModule`            | Catalog, ratings, favorites, chapter metadata, purchase/access checks, and chapter content management.                            |
| `ReaderModule`                                                                | Reader sessions, manifests, page/text delivery, reader context, and progress saving.                                              |
| `CollectionsModule`                                                           | User collections, system collections, public collection pages, item ordering, and limits.                                         |
| `ContributorModule`                                                           | Contributor CRUD and public contributor pages.                                                                                    |
| `MediaModule` / `StorageModule`                                               | Upload metadata, media CRUD, object storage, public object URLs, and S3 bucket setup.                                             |
| `DashboardModule`                                                             | User dashboard data, history/export, library, progress, and admin overview/finance/content/users metrics.                         |
| `NotificationsModule` / `OutboxModule`                                        | Notification feed, unread counts, book subscriptions, admin broadcasts, outbox processing, retries, leases, and cleanup settings. |
| `ScheduledPublishingModule`                                                   | Scheduled publication CRUD, cancellation, immediate publish, and Redis-backed scheduling worker.                                  |
| `SearchModule`                                                                | Meilisearch live search, browse search, and admin full sync.                                                                      |
| `AuditLogModule`                                                              | Admin audit log listing, entity history, and details.                                                                             |
| `PrismaModule`, `RedisModule`, `CacheModule`, `RateLimitModule`, `MailModule` | Database, Redis, cache serialization, throttling, and SMTP mail infrastructure.                                                   |

`src/main.ts` configures Helmet, credentialed CORS from `CORS_ORIGIN`, cookie parsing, and a global `ValidationPipe` with whitelist and transform behavior.

## API overview

| Prefix                                         | Endpoints / purpose                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                                        | `register`, `verify-otp`, `login`, `google`, `google/link`, `refresh`, `logout`, `sessions`, `profile`, `forgot-password`, `reset-password`. |
| `/users`                                       | User list/details/stats, avatar upload, profile update, role/ban changes, balance credit/debit, and permission updates.                      |
| `/wallet`                                      | Wallet summary and transactions.                                                                                                             |
| `/wallet/payment`                              | Payment initialize, provider callback, and payment result lookup.                                                                            |
| `/books`                                       | Browse, favorites, all/admin details, viewer state, related books, type browse, CRUD, ratings, and favorites.                                |
| `/books/:bookId/chapters`                      | Public/admin chapter lists, chapter CRUD, access checks, and purchases.                                                                      |
| `/admin/books/:bookId/chapters/:index/content` | Chapter content fetch, image upload/append/delete, text upload, PDF upload, and content deletion.                                            |
| `/reader`                                      | Reader/admin sessions, manifest, page, text, context, and progress.                                                                          |
| `/media`                                       | Media listing, upload, metadata update, and deletion.                                                                                        |
| `/genres`                                      | Public/admin genre lists, featured/list-all, CRUD, and slug details.                                                                         |
| `/book-types`                                  | Book type listing, creation, update, and deletion.                                                                                           |
| `/public`                                      | Home content, personalized content, genres, genre browse, book types, book type detail, and public profiles.                                 |
| `/collections` and `/u/:username/collections`  | Collection browse, current-user collections, admin collections, public collection details, collection CRUD, items, and reordering.           |
| `/contributor`                                 | Contributor CRUD, listing, details, and public contributor detail.                                                                           |
| `/dashboard`                                   | User overview, history, CSV export, library, progress, and admin dashboard sections.                                                         |
| `/notifications`                               | Feed, unread count, read/delete actions, book subscriptions, and admin broadcasts.                                                           |
| `/scheduled-publications`                      | List, create, update, cancel, and publish-now scheduled publications.                                                                        |
| `/search`                                      | Live search, browse search, and admin sync-all.                                                                                              |
| `/admin/audit-logs`                            | Audit log list, entity history, and detail.                                                                                                  |
| `/storage`                                     | Storage controller entry point; object operations are mainly exposed through media/chapter services.                                         |

## Authentication and authorization

- Passwords are hashed with argon2.
- JWT access tokens and refresh tokens are stored as HTTP-only cookies.
- Separate admin token lifetimes and device limits are supported.
- Google authentication verifies Google ID tokens using `GOOGLE_CLIENT_ID` and supports account linking.
- Sessions can be refreshed, listed, individually revoked, or revoked for all other devices.
- Banned users are rejected by authentication/profile validation paths.
- Role and permission guards protect admin and privileged routes.
- `SUPER_ADMIN_ID` is treated as a super-admin user id by permission logic.

## Data and storage

- Prisma schema and migrations live in `prisma/`.
- The seed script is `prisma/seed.ts` and requires `SEED_ADMIN_PASSWORD`.
- Uploaded media and chapter content use S3-compatible storage through the AWS SDK client.
- PDF uploads are processed through a Redis/BullMQ-backed PDF queue.
- Text processing and scheduled publication workflows also use Redis/BullMQ.
- Search indexing uses Meilisearch.
- Notifications use an outbox-style processor with configurable batch, lease, retry, and retention settings.

## Environment variables

Create `server/.env` from `server/.env.example`.

| Variable                                                                                 | Required           | Purpose                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                               | Recommended        | Runtime environment; production enables secure cookies.                                |
| `PORT`                                                                                   | Yes                | HTTP port for NestJS.                                                                  |
| `APP_URL`                                                                                | Recommended        | Public backend URL used for payment/callback links.                                    |
| `FRONTEND_URL`                                                                           | Recommended        | Frontend URL used for redirects, allowed Google origins, and mail links.               |
| `CORS_ORIGIN`                                                                            | Yes                | Comma-separated browser origins allowed for credentialed API calls.                    |
| `DATABASE_URL`                                                                           | Yes                | PostgreSQL connection string used by Prisma.                                           |
| `JWT_SECRET`                                                                             | Yes                | Secret for JWT signing and verification.                                               |
| `JWT_EXPIRES_IN`                                                                         | Yes                | User access-token lifetime in seconds.                                                 |
| `REFRESH_TOKEN_EXPIRES_IN`                                                               | Yes                | User refresh-token lifetime in seconds.                                                |
| `SESSION_INACTIVITY_TIMEOUT_SECONDS`                                                     | Yes                | Session inactivity timeout before removal.                                             |
| `USER_MAX_DEVICES`                                                                       | Yes                | Maximum concurrently stored user device sessions.                                      |
| `ADMIN_JWT_EXPIRES_IN`                                                                   | Yes                | Admin access-token lifetime in seconds.                                                |
| `ADMIN_REFRESH_TOKEN_EXPIRES_IN`                                                         | Yes                | Admin refresh-token lifetime in seconds.                                               |
| `ADMIN_MAX_DEVICES`                                                                      | Yes                | Maximum concurrently stored admin device sessions.                                     |
| `SUPER_ADMIN_ID`                                                                         | Yes                | User id that bypasses normal permission checks.                                        |
| `SEED_ADMIN_PASSWORD`                                                                    | Seed only          | Initial admin password for `npx prisma db seed`.                                       |
| `GOOGLE_CLIENT_ID`                                                                       | Google auth        | Google OAuth client id.                                                                |
| `REDIS_HOST`, `REDIS_PORT`                                                               | Yes                | Redis connection for cache, queues, and workers.                                       |
| `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`                                                      | Recommended        | Global request throttling window and limit.                                            |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` | Yes                | S3-compatible storage connection and bucket.                                           |
| `S3_FORCE_PATH_STYLE`                                                                    | Provider-dependent | Enables path-style S3 addressing.                                                      |
| `S3_PUBLIC_BASE_URL`                                                                     | Recommended        | Public/CDN base URL for stored objects.                                                |
| `S3_AUTO_CREATE_BUCKET`                                                                  | Optional           | Creates the bucket on startup when `true`.                                             |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`                      | Mail flows         | SMTP configuration for emails.                                                         |
| `USER_COLLECTION_LIMIT`, `USER_COLLECTION_BOOK_LIMIT`                                    | Recommended        | Per-user collection and collection-item limits.                                        |
| `SCHEDULED_PUBLICATION_CONCURRENCY`                                                      | Recommended        | Worker concurrency for scheduled publications.                                         |
| `NOTIFICATION_*`                                                                         | Recommended        | Notification batching, worker, lease, retry, retention, cleanup, and broadcast limits. |
| `PDF_PROCESSING_CONCURRENCY`                                                             | Recommended        | Worker concurrency for PDF processing.                                                 |
| `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY`                                                | Search             | Meilisearch connection and API key.                                                    |

`server/.env.test.example` contains placeholder test values for integration/e2e runs. Do not use production credentials in test env files.

## Setup

From the repository root:

```bash
npm install
npm run build:shared
cp server/.env.example server/.env
```

Then edit `server/.env` and initialize Prisma from `server/`:

```bash
cd server
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

## Development commands

| Command               | Description                                |
| --------------------- | ------------------------------------------ |
| `npm run start`       | Starts NestJS.                             |
| `npm run start:dev`   | Starts NestJS in watch mode.               |
| `npm run start:debug` | Starts NestJS in debug watch mode.         |
| `npm run build`       | Compiles to `dist/`.                       |
| `npm run start:prod`  | Runs `node dist/main`.                     |
| `npm run lint`        | Runs ESLint with automatic fixes.          |
| `npm run format`      | Formats `src/**/*.ts` and `test/**/*.ts`.  |
| `npm run test`        | Runs unit tests.                           |
| `npm run test:watch`  | Runs unit tests in watch mode.             |
| `npm run test:cov`    | Runs tests with coverage.                  |
| `npm run test:debug`  | Runs Jest under the Node inspector.        |
| `npm run test:e2e`    | Runs e2e tests using `test/jest-e2e.json`. |

From the monorepo root, prefix commands with `npm --workspace server run`, for example:

```bash
npm --workspace server run start:dev
npm --workspace server run test
```

## Production checklist

1. Set strong production secrets and real service credentials.
2. Ensure `CORS_ORIGIN` includes the deployed frontend origin.
3. Ensure `FRONTEND_URL` and `APP_URL` are the deployed public URLs.
4. Apply Prisma migrations to the target PostgreSQL database.
5. Ensure Redis, Meilisearch, SMTP, and S3-compatible storage are reachable.
6. Build with `npm --workspace server run build`.
7. Start with `npm --workspace server run start:prod`.

## Folder structure

```text
server/
├── prisma/                  # Prisma schema, migrations, and seed script
├── src/
│   ├── audit-log/           # Admin audit log APIs and interceptors
│   ├── auth/                # Auth, guards, strategies, sessions, security helpers
│   ├── book-types/          # Book type management
│   ├── books/               # Catalog APIs and recommendation helpers
│   ├── cache/               # Redis-backed cache utilities
│   ├── chapters/            # Chapter metadata and content processing
│   ├── collections/         # User/system collections
│   ├── contributor/         # Contributor APIs
│   ├── dashboard/           # User/admin dashboard data
│   ├── genre/               # Genre management
│   ├── mail/                # SMTP and templates
│   ├── media/               # Media upload and metadata APIs
│   ├── notifications/       # Notification feed, subscriptions, broadcasts, workers
│   ├── outbox/              # Domain event outbox support
│   ├── payments/            # Wallet payment drivers and callbacks
│   ├── prisma/              # Prisma module/service
│   ├── public/              # Public catalog APIs
│   ├── rate-limit/          # Throttling helpers
│   ├── reader/              # Reader session/page/text/progress APIs
│   ├── redis/               # Redis provider
│   ├── scheduled-publishing/# Scheduled publication worker/API
│   ├── search/              # Meilisearch integration
│   ├── storage/             # S3-compatible storage service
│   ├── users/               # User/profile/admin user operations
│   ├── wallets/             # Wallet summaries and transactions
│   ├── app.module.ts        # Root module
│   └── main.ts              # Bootstrap
├── test/                    # E2E tests and support files
├── docs/                    # Backend design notes
├── package.json             # Server scripts/dependencies
└── tsconfig*.json           # TypeScript configuration
```
