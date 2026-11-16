# Installation

NameCard is a Node.js workspace. The web app and API share one PostgreSQL database.

## Requirements

- Node.js 22
- PostgreSQL 16
- npm 10

## Steps

1. Copy `.env.example` to `apps/api/.env`.
2. Set `DATABASE_URL`.
3. Replace both JWT secrets with unique values of at least 32 characters. Production startup refuses a missing secret and refuses a value that contains `change-me`.
4. Set `WEB_ORIGIN` to the browser origin that will call the API.
5. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (8 or more characters) only for the first empty workspace.
6. Install and prepare the database:

```bash
npm install
npm run db:deploy
```

`db:deploy` applies migrations and runs the seed. The seed creates one administrator and one empty workspace. It does not create cards, contacts, scans, or uploaded files. If the workspace slug already exists, the seed leaves every record untouched.

7. Start the API and web app:

```bash
npm run dev
```

The web app is http://127.0.0.1:3000. The API is http://127.0.0.1:4000. The browser calls `/api/*`, and Next.js proxies that prefix to `API_ORIGIN`.

Sign in with the administrator created by the seed. Change that password before anyone else uses the workspace.
