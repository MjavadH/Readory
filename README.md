


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

   `git clone <your‑repo‑url> cd readory/server npm install`

2. **Configure environment variables**. Copy `.env.example` to `.env` and fill in your database credentials and JWT secret. **Never commit your `.env` file** to version control; it contains secrets. For example:

   `DATABASE_URL="postgresql://<username>:<password>@localhost:5432/readory_db?schema=public" JWT_SECRET="your‑strong‑random‑secret" JWT_EXPIRES_IN=3600 PORT=3000`

3. **Create the database** if it doesn’t already exist:

   `psql -U postgres -c "CREATE DATABASE readory_db;"`

4. **Run migrations and generate the Prisma client**:

   `npx prisma generate npx prisma migrate dev --name init`

5. **Start the development server**:

   `npm run start:dev`

   The server will compile TypeScript in watch mode and start listening on `localhost:3000` (or the `PORT` you set).

6. **Seed an admin role**. By default the `USER` role is created when a user registers. To create an `ADMIN` role and assign it to a user, run the following SQL in your database:

   `INSERT INTO "Role" ("name") VALUES ('ADMIN') ON CONFLICT DO NOTHING; -- replace with your admin user’s email UPDATE "User" SET "roleId" = (SELECT id FROM "Role" WHERE "name"='ADMIN') WHERE "email" = 'admin@example.com';`


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


## Security & Best Practices

- **Do not commit sensitive files** like `.env` or any files containing secrets, API keys or passwords. Use `.env.example` to document required variables.

- Exclude generated folders (`node_modules`, `dist`) by using a `.gitignore` file. The NestJS CLI generates a `.gitignore` for you.

- Keep your dependencies up to date and monitor for security advisories.


## Commit Workflow

Below is a suggested commit history to reflect the major milestones of this project. Each step corresponds to a logical unit of work; commit messages should be descriptive and in the imperative mood:

1. **Initialize NestJS project** – scaffold the `server` with `nest new`.

2. **Enable strict TypeScript and ES modules** – configure `tsconfig.json` and set `"type": "module"` in `package.json`.

3. **Add Prisma and initial schema** – install Prisma, define roles, users, wallets, books, chapters, and migrations.

4. **Integrate Prisma with NestJS** – create `PrismaService` and `PrismaModule`, update `AppModule`.

5. **Implement user module** – create `UsersModule`, `UsersService`, add wallet creation on user registration.

6. **Add authentication** – install auth dependencies, implement `AuthService`, strategies, guards, DTOs, and controllers.

7. **Configure environment variables and JWT** – set up `.env`, load variables via `ConfigModule`.

8. **Add wallet module** – implement credit/debit and wallet endpoints.

9. **Add role‑based access control** – implement roles decorator and guard; include role in JWT payload.

10. **Add books module** – implement listing, creation and updating of books; admin‑only routes.

11. **Add chapters module** – implement listing, creation and purchasing of chapters; integrate with wallet service.

12. **Update README and docs** – document setup, endpoints, and usage instructions.


Feel free to squash minor tweaks or fixes into the relevant commits. Avoid committing secrets or environment files.

## License

This project is released under the MIT License. See the `LICENSE` file for details.