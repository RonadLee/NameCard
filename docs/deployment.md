# Deployment

Run two Node processes and one PostgreSQL database.

## Build

```bash
npm install
npm run build
```

- API output: `apps/api/dist`
- Web output: `apps/web/.next`

## Processes

API, from `apps/api`, with `apps/api/.env` loaded:

```bash
node dist/main.js
```

Web, from `apps/web`:

```bash
npx next start -p 3000
```

Set `API_ORIGIN` for the web process to the private URL of the API. Set `WEB_ORIGIN` on the API to the public browser origin. The API allows credentials only from that origin.

## Database

Apply migrations before serving traffic:

```bash
npm run db:migrate -w api
```

Do not point more than one deployment at a different database if desktop and mobile must stay in sync. Both clients use this API and this database.

## Storage

`STORAGE_DRIVER=local` writes uploads under `apps/api/uploads`. That directory must be writable and must be backed up with the database. For Feishu object storage, set `STORAGE_DRIVER=feishu` and `FEISHU_STORAGE_ENDPOINT`. The driver stores and reads each file at `{endpoint}/{id}`.

## Health

`GET /health` returns `{"ok":true}` after `SELECT 1` succeeds. Use it as the process check.

## What this package does not include

No database dump, no uploaded card images, and no `.env`. Create those in the target environment.
