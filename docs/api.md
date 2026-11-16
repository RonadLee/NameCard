# API

The browser calls `/api/...`. Next.js forwards that to the API root. The paths below are the API paths.

Authenticated routes accept `Authorization: Bearer <accessToken>` or the httpOnly `nc_session` cookie. Validation rejects unknown fields.

## Session

- `POST /auth/login` — email, password, optional TOTP. Sets refresh and session cookies. Login is limited to 12 requests a minute.
- `POST /auth/refresh` — rotates the refresh cookie. A missing token returns 401.
- `POST /auth/logout` — clears both cookies.
- `POST /auth/switch` — body `{ workspaceId }`. Later requests use that workspace.
- `GET /auth/me`
- `PATCH /auth/profile`
- `POST /auth/password` — current and next password. Next password must be at least 8 characters.
- `POST /auth/mfa/setup` and `POST /auth/mfa/enable`

The API allows 300 requests a minute per client beyond the login limit.

## Cards, contacts, studio

- `GET|POST /cards`, `GET|PATCH|DELETE /cards/:id`
- `GET /public/cards/:slug` — only a card marked public. No session.
- `GET /contacts` — without `page`, returns an array. With `page`, returns `{ items, total, page, pageSize }`. Filters: `q`, `group`, `scope`, `sort`.
- `POST /contacts`, `GET|PATCH|DELETE /contacts/:id`
- `POST /contacts/from-card`
- `POST|PATCH /contacts/groups`, `DELETE /contacts/groups?name=`
- `POST /contacts/categorize` — adds a group; it does not remove other groups
- `GET|POST /signatures`, `PATCH|DELETE /signatures/:id`
- `GET|POST /backgrounds`, `PATCH|DELETE /backgrounds/:id`

## OCR and files

- `POST /scans` — multipart field `files`, optional `language`
- `POST /scans/preview` — recognizes without creating a review row
- `GET /scans`, `PATCH /scans/:id`
- `POST /files` — one file, at most 12 MB, JPEG, PNG, WEBP, GIF, or PDF
- `GET /files/:id` — same workspace only. A missing or foreign id returns 404. No session returns 401.

## Organization

- `GET /org`
- `POST|PATCH|DELETE /departments` and `/teams`
- `POST /members`, `PATCH|DELETE /members/:userId`
- `POST /integrations/feishu/mapping` — stores `open_id` and `union_id` on the current user
- `POST /integrations/feishu/directory/sync`
- `GET /integrations/status`
- `GET /analytics`
- `GET /health`

Roles on the membership are `SUPER_ADMIN`, `ADMIN`, `MANAGER`, and `USER`. Member administration and directory sync require a manager or above.
