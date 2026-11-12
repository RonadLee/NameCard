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

Seeded sign-in: `alex.chen@northwind.example` / `Northwind#2026`

Optional OCR and Feishu adapters stay off until `OPENAI_API_KEY`, `PADDLE_OCR_URL`, or `FEISHU_APP_ID` are set. Scanning still uses Tesseract.
