# Feishu Spark deployment

This application is a Next.js server plus a NestJS API plus PostgreSQL. It is not a single HTML file.

## What Spark can host

Feishu Spark HTML publish accepts one static site (a tar of HTML, CSS, and client JavaScript, with a 10 MB HTML limit). That form cannot run this API, cannot open PostgreSQL, and cannot keep a private upload directory. Do not publish the repository as an HTML Spark site.

A full-stack Spark or Feishu workspace release has to run the two Node processes from [deployment.md](deployment.md) and reach a PostgreSQL instance the organization controls. Build with `npm run build`. Configure the environment from `.env.example` in the host, not in the repository.

## Feishu login and directory

Feishu login is not single sign-on in this build. `POST /integrations/feishu/mapping` stores a Feishu `open_id` and `union_id` on an existing NameCard user after that user has signed in with an email and password. `POST /integrations/feishu/directory/sync` writes departments from the Feishu directory when `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are set. `GET /integrations/status` reports whether those variables are present. It does not call Feishu.

An approval row can store `feishuInstanceId`. There is no live Feishu Approval callback in this build.

## Storage

Set `STORAGE_DRIVER=feishu` and `FEISHU_STORAGE_ENDPOINT` to use the existing HTTP storage driver. The API puts and gets `{endpoint}/{fileId}`. Leave the driver on `local` until that endpoint is available.

## Routing and cookies

Serve the web app and API on one site, with `/api` proxied to the API, so the session cookie is same-site. `WEB_ORIGIN` must be that site. Cross-origin credentials are rejected.

## Blockers that remain

- No Feishu OAuth authorization-code login
- No Bitable sync
- No Approval workflow callback
- Spark static hosting cannot run this stack

Those are future integrations. They are not required to run the web app, API, and database described in the deployment guide.
