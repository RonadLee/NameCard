# Architecture

Desktop and mobile are two layouts of one Next.js application. They call one NestJS API and one PostgreSQL database.

```text
Browser (desktop >= 1366px, or phone shell below 1366px)
        |
        |  /api/*  (Next.js rewrite)
        v
NestJS API
        |
        +-- PostgreSQL (users, cards, contacts, groups, scans, files, signatures, backgrounds, settings)
        +-- OCR (OpenAI vision, else Paddle, else Tesseract)
        +-- File storage (local disk or Feishu HTTP storage)
```

## Shared records

Cards, contacts, groups, notes, email signatures, virtual backgrounds, organization settings, and scan reviews are rows in the same database. A write from either layout is visible to the other layout on the next read. The open cardholder, detail, scan, and settings screens refetch every 4 seconds and invalidate the other layout's cache after a mutation. There is no second database and no separate mobile API.

## Authentication

Login returns a short-lived bearer token and sets two httpOnly cookies: `nc_refresh` for token rotation, and `nc_session` so same-origin image requests to `/api/files/:id` can be authorized. File downloads require a session in the same workspace.

## Schema

`apps/api/prisma/schema.prisma` is the schema. Apply `apps/api/prisma/migrations` with `npm run db:migrate -w api`. The contact list is indexed by workspace, owner, and created time so a workspace of 100,000 contacts can page without a full table scan. Search is a case-insensitive contains match inside the workspace.

## Main tables

- `User`, `Workspace`, `Membership`: accounts, one workspace per request, role on the membership
- `Card`: the signed-in person's own cards
- `Contact`: cardholder records, including groups, notes, and image references
- `Signature`, `VirtualBackground`: studio records tied to the workspace
- `ScanItem`: OCR review queue
- `StoredFile`: metadata for an uploaded file; bytes live in the storage driver
- `AuditLog`: workspace actions such as create, update, delete, upload, and scan
