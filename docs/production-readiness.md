# Production readiness

Reviewed as an internal business application for a shared cardholder, not as a certified government system.

| Area | Score |
| --- | --- |
| Production readiness | 74 |
| Business use | 78 |
| Mobile | 76 |
| Desktop | 82 |
| OCR | 58 |
| Performance | 74 |
| Security | 72 |
| Enterprise readiness | 68 |
| Feishu readiness | 58 |

## Fixed before this package

- Card images required a workspace session. Anonymous and cross-workspace downloads are rejected.
- Browser CORS is limited to `WEB_ORIGIN`.
- Production boot refuses a short or placeholder JWT secret.
- Refresh failure returns 401 instead of a server error, and refresh keeps the active workspace.
- Login no longer shows a saved password or a one-click demo account.
- Contact and scan lists are indexed for paged access at 100,000 rows.
- Desktop and mobile share one database, one API, and a 4 second refresh of open screens.
- Seed data no longer contains sample cards, contacts, or scans.
- The packaged tree contains no card rows, scan rows, or uploaded card images.

## Remaining risk

- OCR accuracy is the existing Tesseract path unless `OPENAI_API_KEY` or `PADDLE_OCR_URL` is set.
- Search is a contains match, not a trigram index.
- Sync of a screen that is left open is within about 4 seconds. There is no websocket.
- Public cards remain readable without a session when a card is marked public. Images on that page need a session.
- Content Security Policy is off because the app uses inline styles.
- Feishu is a directory mapping and a storage driver, not Spark hosting or SSO.
- There is no external metrics pipeline. Health and the audit log are the operational signals.
