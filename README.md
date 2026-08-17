# Readory

Readory is a TypeScript monorepo for a digital reading platform. It contains a Next.js frontend, a NestJS API server, and a shared package used by both applications.

## Overview

Readory supports browsing, publishing, purchasing, and reading serialized books and chapters. The application includes public discovery pages, authenticated user dashboard features, wallet-based chapter access, reading progress, favorites, ratings, and an administrative interface for managing catalog content, media, staff, users, transactions, genres, and book types.

## Key Features

### Reader and customer features

- Public home, book, genre, and dynamic book-type browsing pages.
- Book detail pages with chapters, related books, ratings, and viewer state.
- Chapter reader sessions for image-based or text-based chapter content.
- User registration, OTP verification, login, logout, and profile retrieval.
- Cookie-based authenticated API access.
- User dashboard with library, reading history, reading progress, favorites, wallet, and settings views.
- Wallet balance and transaction history with deposit support.
- Chapter purchase flow backed by access records.

### Administrative features

- Admin dashboard and protected administration layout.
- Book, chapter, chapter content, genre, book type, media, user, staff, and transaction management screens.
- Role and permission-aware admin UI.
- Media upload and server-side media processing.
- S3-compatible chapter and content storage.

### Platform features

- PostgreSQL data model managed with Prisma migrations.
- Redis-backed cache utilities for session, access, and chapter-related data.
- Shared TypeScript package for cross-application constants.
- English and Persian localization files in the frontend.
- Light/dark theming and Tailwind CSS design tokens.

## Architecture

The repository is organized as an npm workspace monorepo:

```text
.
├── frontend/       # Next.js application for public, dashboard, and admin UIs
├── server/         # NestJS API server, Prisma schema, migrations, and tests
├── shared/         # Shared TypeScript package consumed by frontend and server
├── package.json    # Root workspace scripts and workspace definitions
└── package-lock.json
```

The frontend communicates with the backend through HTTP APIs using `NEXT_PUBLIC_API_BASE`. Requests include credentials by default so the browser can send the server-issued `access_token` cookie. The backend exposes REST-style controllers for authentication, users, wallets, books, chapters, reader sessions, media, storage, genres, book types, dashboards, and public catalog data.

The server stores relational data in PostgreSQL through Prisma. Chapter content and uploaded objects are stored through an S3-compatible storage client. Redis is used by cache services for session and content-access related caching.

## Technology Stack

| Category                        | Technologies                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                        | Next.js 16, React 19, TypeScript, App Router, next-intl, SWR, React Hook Form, Zod                                                             |
| UI and styling                  | Tailwind CSS 4, Radix UI, shadcn-style component structure, lucide-react, next-themes, tw-animate-css, Recharts, Framer Motion                 |
| Backend                         | NestJS 11, TypeScript, Passport, JWT, class-validator, class-transformer                                                                       |
| Database                        | PostgreSQL, Prisma Client, Prisma migrations, `pg`, `@prisma/adapter-pg`                                                                       |
| Authentication                  | Passport local strategy, Passport JWT strategy, argon2 password hashing, cookie-parser, JWT stored in `access_token` cookie                    |
| Storage                         | AWS SDK S3 client, S3-compatible object storage, Multer, Sharp, file-type                                                                      |
| Cache / infrastructure services | Redis through ioredis                                                                                                                          |
| Tooling                         | npm workspaces, TypeScript, ESLint, Prettier, Nest CLI                                                                                         |
| Testing                         | Jest, ts-jest, Supertest, Nest testing utilities, unit specs, e2e Jest config                                                                  |
| Deployment                      | Frontend `next build`/`next start`; backend `nest build`/`node dist/main`; environment-driven database, Redis, CORS, JWT, and S3 configuration |

## Monorepo Structure

| Path                | Responsibility                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/`         | User-facing Next.js application, admin UI, dashboard UI, shared UI components, hooks, providers, localization messages, global styles, and frontend configuration. |
| `server/`           | NestJS API application, modules/controllers/services, Prisma schema and migrations, seed script, server tests, and backend configuration.                          |
| `shared/`           | Internal `@readory/shared` TypeScript package with values shared between frontend and server.                                                                      |
| `package.json`      | Root npm workspace definition and workspace-level build scripts.                                                                                                   |
| `package-lock.json` | npm lockfile for the workspace.                                                                                                                                    |

## Getting Started

### Prerequisites

- Node.js and npm compatible with Next.js 16 and NestJS 11.
- PostgreSQL database.
- Redis instance.
- S3-compatible object storage for chapter and media content.

### Installation

Install all workspace dependencies from the repository root:

```bash
npm install
```

Build the shared workspace before running applications that consume `@readory/shared`:

```bash
npm run build:shared
```

For active shared-package development, run the shared package in watch mode:

```bash
npm run dev:shared
```

### Environment configuration

Create environment files from the examples:

```bash
cp frontend/.env.local.example frontend/.env.local
cp server/.env.example server/.env
```

Configure the frontend API base URL:

| Variable               | Purpose                             |
| ---------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_BASE` | Base URL for the NestJS API server. |

Configure the server environment:

| Variable                | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string used by Prisma.                    |
| `JWT_SECRET`            | Secret used to sign and verify JWTs.                            |
| `JWT_EXPIRES_IN`        | JWT lifetime in seconds.                                        |
| `PORT`                  | Port for the NestJS server.                                     |
| `CORS_ORIGIN`           | Comma-separated list of allowed frontend origins.               |
| `SEED_ADMIN_PASSWORD`   | Password used by the Prisma seed script.                        |
| `REDIS_HOST`            | Redis host.                                                     |
| `REDIS_PORT`            | Redis port.                                                     |
| `SUPER_ADMIN_ID`        | User id treated as the super admin by server logic.             |
| `S3_ENDPOINT`           | S3-compatible endpoint.                                         |
| `S3_REGION`             | S3 region.                                                      |
| `S3_ACCESS_KEY_ID`      | S3 access key id.                                               |
| `S3_SECRET_ACCESS_KEY`  | S3 secret access key.                                           |
| `S3_BUCKET_NAME`        | Bucket used for chapter/content objects.                        |
| `S3_FORCE_PATH_STYLE`   | Enables path-style S3 addressing when required by the provider. |
| `S3_PUBLIC_BASE_URL`    | Public base URL for stored objects when needed.                 |
| `S3_AUTO_CREATE_BUCKET` | Allows the server to create the configured bucket on startup.   |

### Database setup

The Prisma schema and migrations live in `server/prisma/`. Run Prisma commands from the `server` workspace, for example:

```bash
cd server
npx prisma migrate dev
npx prisma db seed
```

## Development

### Root workspace commands

| Command                | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm run build`        | Runs `build` in all npm workspaces.      |
| `npm run build:shared` | Builds the `@readory/shared` package.    |
| `npm run dev:shared`   | Builds the shared package in watch mode. |

### Frontend commands

Run from `frontend/` or with `npm --workspace frontend run <script>` from the root.

| Command         | Description                            |
| --------------- | -------------------------------------- |
| `npm run dev`   | Starts the Next.js development server. |
| `npm run build` | Creates a production Next.js build.    |
| `npm run start` | Starts the production Next.js server.  |
| `npm run lint`  | Runs ESLint.                           |

### Server commands

Run from `server/` or with `npm --workspace server run <script>` from the root.

| Command               | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `npm run start`       | Starts the NestJS application.                          |
| `npm run start:dev`   | Starts NestJS in watch mode.                            |
| `npm run start:debug` | Starts NestJS in debug watch mode.                      |
| `npm run build`       | Compiles the server into `server/dist/`.                |
| `npm run start:prod`  | Runs the compiled server with `node dist/main`.         |
| `npm run lint`        | Runs ESLint with automatic fixes.                       |
| `npm run format`      | Formats `src/**/*.ts` and `test/**/*.ts` with Prettier. |
| `npm run test`        | Runs unit tests.                                        |
| `npm run test:watch`  | Runs unit tests in watch mode.                          |
| `npm run test:cov`    | Runs tests with coverage.                               |
| `npm run test:debug`  | Runs Jest under the Node inspector.                     |
| `npm run test:e2e`    | Runs e2e tests using `test/jest-e2e.json`.              |

## Build

Build the full monorepo:

```bash
npm run build
```

Build individual workspaces:

```bash
npm run build:shared
npm --workspace frontend run build
npm --workspace server run build
```

Build outputs:

- Frontend production build: `frontend/.next/`.
- Server production build: `server/dist/`.
- Shared package build: `shared/dist/`.

## Deployment

Deployment is configured through application scripts and environment variables rather than repository-specific deployment manifests.

A typical production deployment should:

1. Install workspace dependencies with npm.
2. Configure frontend, server, PostgreSQL, Redis, and S3-compatible storage environment variables.
3. Build the shared package.
4. Apply Prisma migrations against the production database.
5. Build the frontend and backend.
6. Start the backend with `npm --workspace server run start:prod`.
7. Start the frontend with `npm --workspace frontend run start`.
8. Ensure the server `CORS_ORIGIN` includes the frontend origin and the frontend `NEXT_PUBLIC_API_BASE` points at the backend API.

## Screenshots

### Home
![Home](assets/home.jpeg)

### Browse books
![Browse](assets/browse-books.png)

### Reader

| Text                            | Image                             |
|---------------------------------|-----------------------------------|
| ![Text](assets/reader-text.png) | ![Image](assets/reader-image.png) |

### Dashboard

| Admin                                | User                               |
|--------------------------------------|------------------------------------|
| ![Admin](assets/admin-dashboard.png) | ![User](assets/user-dashboard.png) |


## Documentation Links

- [Frontend README](./frontend/README.md)
- [Server README](./server/README.md)
