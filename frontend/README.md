# Readory Frontend

The Readory frontend is a Next.js application that provides public catalog browsing, account authentication screens, user dashboard pages, reader experiences, and administrative management interfaces.

## Overview

The application is built with the Next.js App Router and React. It consumes the NestJS API server through a centralized API client and renders three main product surfaces:

- Public discovery and reading routes.
- Authenticated user dashboard routes.
- Admin routes for content and platform management.

## Architecture

The frontend uses App Router route groups and feature-oriented component directories:

- `app/(public)/` contains public browsing, genre, book type, book detail, and reader routes.
- `app/(auth)/` contains authentication pages.
- `app/dashboard/` contains authenticated customer dashboard pages.
- `app/admin/` contains administrative pages and layout code.
- `components/` contains reusable product components and UI primitives.
- `providers/` supplies client-side auth, theme, and toast providers.
- `lib/` contains API, utility, type, logout, time, and icon registry helpers.
- `hooks/` contains reusable client hooks.
- `messages/` contains localization message catalogs.
- `styles/` contains global Tailwind CSS and theme tokens.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Framework | Next.js 16, React 19, App Router |
| Language | TypeScript |
| Localization | next-intl with `messages/en.json` and `messages/fa.json` |
| Styling | Tailwind CSS 4, CSS custom properties, tw-animate-css, tailwind-merge |
| UI primitives | Radix UI, shadcn-style components, lucide-react icons |
| Forms and validation | React Hook Form, Zod, `@hookform/resolvers`, input-otp |
| Data fetching | Native `fetch` through `lib/api-client.ts`, SWR where hooks/components use it |
| Charts and interaction | Recharts, dnd-kit, Framer Motion from the workspace root |
| Theming | next-themes and a custom theme provider |
| Tooling | ESLint, TypeScript, PostCSS |

## Features

- Public home page and catalog sections for latest, trending, genres, featured content, and dynamic book types.
- Book listing, genre listing, genre detail, book type listing, and book detail routes.
- Reader pages for public and admin chapter views.
- Login UI and server-backed authentication checks.
- User dashboard for library, reading history, reading progress, favorites, and settings.
- Admin dashboard for books, book types, genres, media, users, staff, transactions, and settings.
- Permission-aware admin navigation and UI controls.
- Media picker, file upload picker, icon picker, upload progress, pagination, skeleton, and toast components.
- English and Persian message catalogs.
- Dark mode support through theme classes and CSS variables.

## Routing

The app uses file-based App Router routes. Important routes include:

| Route | Source | Purpose |
| --- | --- | --- |
| `/` | `app/(public)/page.tsx` | Public landing page. |
| `/login` | `app/(auth)/login/page.tsx` | Authentication page. |
| `/books` | `app/(public)/books/page.tsx` | Public books browser. |
| `/genres` | `app/(public)/genres/page.tsx` | Public genre listing. |
| `/genres/[slug]` | `app/(public)/genres/[slug]/page.tsx` | Books within a genre. |
| `/[type]` | `app/(public)/[type]/page.tsx` | Dynamic book type browser. |
| `/[type]/[id]` | `app/(public)/[type]/[id]/page.tsx` | Book details. |
| `/[type]/[id]/c/[index]` | `app/(public)/[type]/[id]/c/[index]/page.tsx` | Reader route for a chapter. |
| `/dashboard` | `app/dashboard/page.tsx` | User dashboard home. |
| `/dashboard/library` | `app/dashboard/library/page.tsx` | User library. |
| `/dashboard/history` | `app/dashboard/history/page.tsx` | Reading or transaction history view. |
| `/dashboard/reading_progress` | `app/dashboard/reading_progress/page.tsx` | Reading progress. |
| `/dashboard/favorites` | `app/dashboard/favorites/page.tsx` | Favorite books. |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | User settings. |
| `/admin` | `app/admin/page.tsx` | Admin dashboard. |
| `/admin/books` | `app/admin/books/page.tsx` | Book management. |
| `/admin/books/[id]` | `app/admin/books/[id]/page.tsx` | Book editing. |
| `/admin/books/[id]/c/[index]` | `app/admin/books/[id]/c/[index]/page.tsx` | Admin chapter content editor/reader. |
| `/admin/books-type` | `app/admin/books-type/page.tsx` | Book type management. |
| `/admin/genres` | `app/admin/genres/page.tsx` | Genre management. |
| `/admin/media` | `app/admin/media/page.tsx` | Media management. |
| `/admin/users` | `app/admin/users/page.tsx` | User management. |
| `/admin/staff` | `app/admin/staff/page.tsx` | Staff management. |
| `/admin/transactions` | `app/admin/transactions/page.tsx` | Transaction management. |
| `/admin/settings` | `app/admin/settings/page.tsx` | Admin settings. |

## Internationalization

Localization is implemented with `next-intl`:

- `next.config.ts` wraps the Next.js config with `createNextIntlPlugin()`.
- `i18n/request.ts` loads messages based on the request locale, a `locale` cookie, or the default `en` locale.
- Message catalogs are stored in `messages/en.json` and `messages/fa.json`.
- `components/language-switcher.tsx` provides the language switching UI.

## State Management

The application primarily uses React component state, context providers, and data-fetching hooks rather than a global state library.

- `providers/auth-provider.tsx` stores the current authenticated admin profile for client-side admin checks.
- `providers/theme-provider.tsx` integrates theme handling.
- `providers/toast-provider.tsx` provides toast notifications.
- `hooks/use-book-browser.ts` encapsulates book browsing behavior.
- `hooks/use-permission.ts` centralizes permission checks.

## API Integration

`lib/api-client.ts` is the central HTTP helper. It:

- Reads `NEXT_PUBLIC_API_BASE` as the backend base URL.
- Builds URLs with optional query parameters.
- Sends JSON request bodies unless a `FormData`, `Blob`, string, or `ArrayBuffer` body is provided.
- Sets `Accept: application/json`.
- Uses `credentials: "include"` by default for cookie-backed sessions.
- Normalizes failed responses into `ApiError` instances.

`next.config.ts` allows optimized Next.js image loading from the configured S3 media base URL for book-cover thumbnails.

## Authentication Flow

The frontend delegates authentication to the server:

1. Login and registration-related UI calls the backend authentication endpoints.
2. The backend issues an `access_token` cookie.
3. Client requests include credentials by default.
4. `AuthProvider` calls `/auth/profile` on mount.
5. Admin context is populated only when the profile has `roleName: "ADMIN"`.
6. Permission-aware UI reads permissions through the auth provider and permission hook.

## Styling System

The frontend uses Tailwind CSS 4 with CSS custom properties defined in `styles/globals.css`. The styling system includes:

- Light and dark theme tokens.
- Reader-specific toolbar tokens.
- Tailwind theme variables mapped to CSS variables.
- Radix UI primitives and reusable local UI components under `components/ui/`.
- `next-themes` integration for theme switching.
- `tailwind-merge` and `class-variance-authority` utilities for component class composition.

## Performance Optimizations

Repository-visible optimizations include:

- Next.js App Router server/client component separation.
- `fetch` options in `api-client.ts` support `cache` and `next` revalidation settings.
- Skeleton components for loading states.
- Direct S3/CDN delivery for immutable optimized book-cover thumbnails.
- Centralized pagination components for large lists.
- Reader-specific UI components separated from general page components.

## Environment Variables

Create `frontend/.env.local` from `frontend/.env.local.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | Yes | Base URL of the NestJS API server. |
| `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` | Yes | Public CDN/S3 base URL used to render optimized book-cover thumbnails. |

## Development Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Next.js development server. |
| `npm run build` | Creates a production build. |
| `npm run start` | Starts the production Next.js server after building. |
| `npm run lint` | Runs ESLint. |

From the monorepo root, use workspace commands:

```bash
npm --workspace frontend run dev
npm --workspace frontend run build
npm --workspace frontend run start
npm --workspace frontend run lint
```

## Build Process

1. Install dependencies from the monorepo root with `npm install`.
2. Build the shared package with `npm run build:shared`.
3. Configure `frontend/.env.local` or production environment variables.
4. Run `npm --workspace frontend run build`.
5. Start the built app with `npm --workspace frontend run start`.

The production build output is generated by Next.js in `frontend/.next/`.

## Folder Structure

```text
frontend/
├── app/               # App Router routes and layouts
│   ├── (auth)/        # Authentication routes
│   ├── (public)/      # Public catalog and reader routes
│   ├── admin/         # Admin routes
│   └── dashboard/     # User dashboard routes
├── components/        # Product components and UI primitives
├── hooks/             # Reusable React hooks
├── i18n/              # next-intl request configuration
├── lib/               # API client, utilities, types, icons, logout, time helpers
├── messages/          # Localization messages
├── providers/         # Auth, theme, and toast providers
├── public/            # Static assets
├── styles/            # Global CSS and theme tokens
├── next.config.ts     # Next.js and next-intl configuration
└── package.json       # Frontend scripts and dependencies
```

## Troubleshooting

- If API requests fail in development, confirm `NEXT_PUBLIC_API_BASE` points to the running NestJS server.
- If authenticated requests fail, confirm the backend CORS origin includes the frontend URL and credentials are allowed.
- If media does not render locally, confirm `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` matches the backend `S3_PUBLIC_BASE_URL` and publicly serves `media/book-covers/**` objects.
- If shared imports fail, run `npm run build:shared` from the repository root.
- If localization messages are missing, confirm the selected locale has a corresponding file in `messages/`.
