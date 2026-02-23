


# Readory – Digital Reading Platform

Readory is a simple online bookstore designed for digital manga, comics, novels and light‑novels. It allows readers to sign up, top up a wallet, and pay per chapter to read content. Administrators can upload books and chapters, set pricing and publish them. The backend is built with **NestJS** running on the latest **Node.js LTS** (v24 ‘Krypton’ branch)[nodejs.org](https://nodejs.org/en/about/previous-releases#:~:text=Looking%20for%20the%20latest%20release,of%20a%20version%20branch), uses **Prisma ORM** on **PostgreSQL** for data storage, and implements secure authentication and role‑based access control. This project was built from scratch as part of a step‑by‑step tutorial for beginners.

## Features

- **User registration and login** with secure password hashing (argon2) and JWT authentication.

- **Wallet system** – users can deposit funds and purchase chapters. Transactions are recorded as credits/debits.

- **Book and chapter management** – administrators can create, update and publish books; add chapters with prices; and manage content. Users can browse published books and see chapter lists.

- **Purchasing and access records** – buying a chapter debits the user’s wallet and grants access via an `AccessRecord` so the user can read the chapter later.

- **Role‑based access control** – only users with the `ADMIN` role can manage books and chapters. Roles are stored in the database; JWT payloads include the role name for authorization.

- **PostgreSQL database migrations** using Prisma Migrate. A `prisma` folder contains the schema and migrations; a `prisma.config.ts` file centralizes the database connection (required in Prisma v7)[prisma.io](https://www.prisma.io/docs/orm/reference/prisma-config-reference#:~:text=Starting%20with%20Prisma%20ORM%20v7%2C,environment%20variables%20for%20setup%20details).


## Prerequisites

- **Node.js** v24 LTS.

- **npm** (v11.6.2 or newer) to install packages.

- **NestJS CLI** (v11.0.14) – used to scaffold modules and run the development server.

- **PostgreSQL** 18 – create a database named `readory_db` before running migrations.

- **Prisma CLI** (installed via `npm install --save-dev prisma @prisma/adapter-pg`).

- **Docker** and **Docker Compose** (optional but recommended) if you prefer containerized deployment.


## Getting Started

1. **Clone the repository** and install dependencies:

   ```bash
   git clone https://github.com/MjavadH/Readory.git
   cd readory/server
   npm install
   ```

2. **Configure environment variables**. Copy `.env.example` to `.env` and fill in your database credentials and JWT secret. **Never commit your `.env` file** to version control; it contains secrets. For example:

   ```env
   DATABASE_URL="postgresql://<username>:<password>@localhost:5432/readory_db?schema=public"
   JWT_SECRET="your‑strong‑random‑secret"
   JWT_EXPIRES_IN=3600
   PORT=3000
   ```

4. **Create the database** if it doesn’t already exist:

   ```bash
   psql -U postgres -c "CREATE DATABASE readory_db;"
   ```

6. **Run migrations and generate the Prisma client**:

   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ````

7. **Start the development server**:

   ```bash
   npm run start:dev
   ```

   The server will compile TypeScript in watch mode and start listening on `localhost:3000` (or the `PORT` you set).

9. **Seed an admin role**. By default the `USER` role is created when a user registers. To create an `ADMIN` role and assign it to a user, run the following SQL in your database:

   ```sql
   INSERT INTO "Role" ("name") VALUES ('ADMIN') ON CONFLICT DO NOTHING;
   -- replace with your admin user’s email
   UPDATE "User" SET "roleId" = (SELECT id FROM "Role" WHERE "name"='ADMIN') WHERE "email" = 'admin@example.com';
   ```

## API Overview

### Authentication

- `POST /auth/register` – register a new user with `{ email, password }`. Creates a wallet with zero balance.

- `POST /auth/login` – login with `{ email, password }`. Returns a JWT (`access_token`).


### Wallet

- `GET /wallet` – get your wallet balance and transaction history (JWT required).

- `POST /wallet/deposit` – deposit funds with `{ amount, reference? }` (JWT required).

### Books

- `GET /books` – list all published books.

- `GET /books/:id` – get details of a book, including its chapters.

- `POST /books` – **admin only**. Create a book with `{ title, author?, description?, coverImage?, isPublished? }`.

- `PATCH /books/:id` – **admin only**. Update a book’s details or publish it.

### Chapters

- `GET /books/:bookId/chapters` – list chapters for a book.

- `POST /books/:bookId/chapters` – **admin only**. Add a chapter with `{ title, index, price?, isFree?, contentPath? }`.

- `POST /books/:bookId/chapters/:chapterId/purchase` – purchase a chapter (JWT required). Debits the user’s wallet if the chapter isn’t free.

## License

This project is released under the MIT License. See the `LICENSE` file for details.

## Chapter Reader + MinIO Content Pipeline

### Required environment variables (server)

```env
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET_CHAPTERS=readory-book
S3_FORCE_PATH_STYLE=true
S3_AUTO_CREATE_BUCKET=false
```

- Bucket must be **private**.
- Reader APIs stream content through backend only (`/reader/page`, `/reader/text`) and do not expose S3 URLs.

### Admin chapter content management APIs

- `GET /admin/books/:bookId/chapters/:index/content`
- `POST /admin/books/:bookId/chapters/:index/content/images` (multipart `files[]`)
- `POST /admin/books/:bookId/chapters/:index/content/text` (multipart `file`, `.md`/`.txt`)
- `DELETE /admin/books/:bookId/chapters/:index/content`

Storage prefix is always:

`readory-book/b{bookId}/c{chapterIndex}`

Each chapter stores a `manifest.json` used by the reader session and ordered page loading.

### Security notes

- Reader session token is short-lived and includes `contentVersion`; content changes invalidate prior sessions.
- Reader endpoints enforce access (`isFree` or purchased access record), rate limits, and anomaly blocking for aggressive page scraping.
- Image pages are watermarked per user and streamed as `image/webp` with `no-store` headers.
- Chapter uploads validate image magic-bytes, normalize to WebP, and update chapter content metadata atomically.
