# Readory Frontend

The Readory frontend is a Next.js App Router application for public discovery, authentication, reader experiences, user dashboards, and administrative management.

## Responsibilities

The frontend consumes the NestJS API through a shared API client, sends credentialed requests for cookie-backed sessions, renders localized public and authenticated pages, and provides admin tools for operating the platform.

## Tech stack

| Area                      | Technologies                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- |
| Framework                 | Next.js 16, React 19, App Router                                                  |
| Language                  | TypeScript                                                                        |
| Localization              | next-intl with English and Persian messages                                       |
| Styling                   | Tailwind CSS 4, CSS custom properties, tw-animate-css, tailwind-merge             |
| UI                        | Radix UI, local shadcn-style components, lucide-react, vaul, react-zoom-pan-pinch |
| Forms/validation          | React Hook Form, Zod, `@hookform/resolvers`, input-otp                            |
| Data fetching             | `lib/api-client.ts`, native `fetch`, SWR hooks where used                         |
| Interaction/visualization | dnd-kit, Recharts, Framer Motion                                                  |
| Auth integrations         | Cookie-backed API auth and Google OAuth provider/components                       |
| Tooling                   | ESLint, TypeScript, PostCSS                                                       |

## Main features

- Public home content, personalized content, books, genres, dynamic book-type pages, contributors, public profiles, public collections, and live search.
- Book details with chapters, ratings, favorites, related books, purchase/access state, and notification subscriptions.
- Reader pages for image/text chapter delivery, zoom/pan, reader context, and progress updates.
- Login, Google sign-in/linking, password reset, and session-aware profile checks.
- Dashboard pages for overview, library, history/export, progress, favorites, collections, settings, connected devices, and notifications.
- Admin pages for books, chapter content, scheduled publications, collections, contributors, genres, book types, media, users, staff, transactions, notification broadcasts, audit logs, settings, and metrics.
- English/Persian localization and light/dark theming.

## Routing

Important App Router pages include:

| Route                                                  | Source                                        | Purpose                                         |
| ------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------- |
| `/`                                                    | `app/(public)/page.tsx`                       | Public landing page.                            |
| `/login`                                               | `app/(auth)/login/page.tsx`                   | Login and authentication entry.                 |
| `/link-google`                                         | `app/(auth)/link-google/page.tsx`             | Google account-linking flow.                    |
| `/reset-password`                                      | `app/(auth)/reset-password/page.tsx`          | Password reset page.                            |
| `/books`                                               | `app/(public)/books/page.tsx`                 | Book browser.                                   |
| `/genres` and `/genres/[slug]`                         | `app/(public)/genres/**`                      | Genre listing and genre detail.                 |
| `/collections` and `/collections/[slug]`               | `app/(public)/collections/**`                 | Public collections.                             |
| `/contributor/[slug]`                                  | `app/(public)/contributor/[slug]/page.tsx`    | Public contributor detail.                      |
| `/u/[username]` and `/u/[username]/collections/[slug]` | `app/(public)/u/**`                           | Public user profile and collection detail.      |
| `/notifications`                                       | `app/(public)/notifications/page.tsx`         | Authenticated notification feed page.           |
| `/payment/result`                                      | `app/(public)/payment/result/page.tsx`        | Wallet payment result page.                     |
| `/[type]`                                              | `app/(public)/[type]/page.tsx`                | Dynamic book-type browser.                      |
| `/[type]/[id]`                                         | `app/(public)/[type]/[id]/page.tsx`           | Book detail.                                    |
| `/[type]/[id]/c/[index]`                               | `app/(public)/[type]/[id]/c/[index]/page.tsx` | Public reader route.                            |
| `/dashboard`                                           | `app/dashboard/page.tsx`                      | User dashboard overview.                        |
| `/dashboard/library`                                   | `app/dashboard/library/page.tsx`              | User library.                                   |
| `/dashboard/history`                                   | `app/dashboard/history/page.tsx`              | Reading history and export.                     |
| `/dashboard/reading_progress`                          | `app/dashboard/reading_progress/page.tsx`     | Reading progress.                               |
| `/dashboard/favorites`                                 | `app/dashboard/favorites/page.tsx`            | Favorite books.                                 |
| `/dashboard/collections`                               | `app/dashboard/collections/page.tsx`          | User collections.                               |
| `/dashboard/settings`                                  | `app/dashboard/settings/page.tsx`             | Profile/settings and connected-device controls. |
| `/admin`                                               | `app/admin/page.tsx`                          | Admin dashboard overview.                       |
| `/admin/books` and `/admin/books/[id]`                 | `app/admin/books/**`                          | Book management.                                |
| `/admin/books/[id]/c/[index]`                          | `app/admin/books/[id]/c/[index]/page.tsx`     | Chapter content editor/reader.                  |
| `/admin/books-type`                                    | `app/admin/books-type/page.tsx`               | Book type management.                           |
| `/admin/genres`                                        | `app/admin/genres/page.tsx`                   | Genre management.                               |
| `/admin/media`                                         | `app/admin/media/page.tsx`                    | Media management.                               |
| `/admin/users`                                         | `app/admin/users/page.tsx`                    | User management.                                |
| `/admin/staff`                                         | `app/admin/staff/page.tsx`                    | Staff management.                               |
| `/admin/transactions`                                  | `app/admin/transactions/page.tsx`             | Transaction management.                         |
| `/admin/collections` and `/admin/collections/[id]`     | `app/admin/collections/**`                    | System/user collection management.              |
| `/admin/contributors`                                  | `app/admin/contributors/page.tsx`             | Contributor management.                         |
| `/admin/notifications`                                 | `app/admin/notifications/page.tsx`            | Notification broadcast management.              |
| `/admin/scheduled-publications`                        | `app/admin/scheduled-publications/page.tsx`   | Scheduled publication management.               |
| `/admin/audit-log`                                     | `app/admin/audit-log/page.tsx`                | Audit log browser.                              |
| `/admin/settings`                                      | `app/admin/settings/page.tsx`                 | Admin settings.                                 |

## API integration

`lib/api-client.ts` is the central HTTP helper. It:

- Reads `NEXT_PUBLIC_API_BASE` as the backend base URL.
- Builds URLs with optional query parameters.
- Sends JSON request bodies unless the body is already `FormData`, `Blob`, `string`, or `ArrayBuffer`.
- Sets `Accept: application/json`.
- Uses `credentials: "include"` by default so browser requests include the backend cookies.
- Normalizes failed API responses into `ApiError` instances.

Media URL helpers read `NEXT_PUBLIC_S3_PUBLIC_BASE_URL`, and `next.config.ts` configures image optimization for the configured S3/CDN host.

## Authentication

The frontend delegates authentication to the backend:

1. Auth pages call backend auth endpoints.
2. The backend sets HTTP-only access/refresh cookies.
3. Browser API calls include credentials by default.
4. `AuthProvider` and related hooks fetch `/auth/profile` to determine current user/admin state.
5. Admin UI uses role and permission data from the profile to show or hide protected navigation/actions.
6. Google sign-in components use `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

## Internationalization and theming

- `next.config.ts` enables `next-intl`.
- `i18n/request.ts` resolves locale/message catalogs.
- Message files are in `messages/en.json` and `messages/fa.json`.
- `components/language-switcher.tsx` switches language.
- `providers/theme-provider.tsx` integrates `next-themes`.
- `styles/globals.css` defines Tailwind CSS 4 theme variables, light/dark tokens, and reader-specific tokens.

## Environment variables

Create `frontend/.env.local` from `frontend/.env.local.example`.

| Variable                         | Required      | Purpose                                                                 |
| -------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE`           | Yes           | Base URL of the NestJS API server, for example `http://localhost:3000`. |
| `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` | Yes for media | Public S3/CDN base URL for media and chapter assets.                    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`   | Google auth   | Google OAuth client id used by Google auth components/provider.         |

## Setup

From the repository root:

```bash
npm install
npm run build:shared
cp frontend/.env.local.example frontend/.env.local
```

Edit `frontend/.env.local` so `NEXT_PUBLIC_API_BASE` points to the running backend.

## Development commands

| Command         | Description                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Starts the Next.js development server.       |
| `npm run build` | Creates a production build.                  |
| `npm run start` | Starts the production server after building. |
| `npm run lint`  | Runs ESLint.                                 |

From the monorepo root, use:

```bash
npm --workspace frontend run dev
npm --workspace frontend run build
npm --workspace frontend run start
npm --workspace frontend run lint
```

## Production build

1. Install dependencies from the repository root.
2. Build the shared package with `npm run build:shared`.
3. Configure production environment variables.
4. Run `npm --workspace frontend run build`.
5. Start the built app with `npm --workspace frontend run start`.

The production build output is generated in `frontend/.next/`.

## Folder structure

```text
frontend/
├── app/                  # App Router routes and layouts
│   ├── (auth)/           # Login, Google linking, password reset
│   ├── (public)/         # Public catalog, reader, profiles, collections, notifications
│   ├── admin/            # Admin dashboard and management pages
│   └── dashboard/        # User dashboard pages
├── components/           # Product components and UI primitives
├── hooks/                # Reusable React hooks
├── i18n/                 # next-intl request configuration
├── lib/                  # API client, media helpers, types, utilities, logout/time/icons/payments
├── messages/             # English and Persian localization catalogs
├── providers/            # Auth, Google auth, theme, and toast providers
├── public/               # Static assets
├── styles/               # Global CSS and design tokens
├── next.config.ts        # Next.js, next-intl, and image remote-pattern config
└── package.json          # Frontend scripts/dependencies
```

## Troubleshooting

- If API calls fail, confirm the backend is running and `NEXT_PUBLIC_API_BASE` is correct.
- If authenticated requests fail, confirm backend `CORS_ORIGIN` includes the frontend origin and cookies are not blocked by browser/security settings.
- If Google auth controls do not appear or fail, set matching `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the frontend and `GOOGLE_CLIENT_ID` in the backend.
- If media does not render, verify `NEXT_PUBLIC_S3_PUBLIC_BASE_URL` matches the backend `S3_PUBLIC_BASE_URL` and the objects are publicly reachable.
- If shared imports fail, run `npm run build:shared` from the repository root.
- If localization text is missing, check that the selected locale exists in `messages/`.
