# NameCard

Business card workspace for teams: digital cards, scanning, contacts, email signatures, and virtual backgrounds.

## Run locally

PostgreSQL needs a database named `namecard`. Copy `.env.example` to `apps/api/.env`, then:

```bash
npm install
npm run db:deploy
npm run dev
```

The app is at http://127.0.0.1:3000 and the API at http://127.0.0.1:4000.

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before `npm run db:deploy` if the database is empty. Seed creates one administrator and one workspace. It does not create cards, contacts, scans, or files, and it does not delete an existing workspace.

Optional OCR and Feishu adapters stay off until `OPENAI_API_KEY`, `PADDLE_OCR_URL`, or `FEISHU_APP_ID` are set. Scanning still uses Tesseract. Production startup refuses a missing or placeholder JWT secret.
