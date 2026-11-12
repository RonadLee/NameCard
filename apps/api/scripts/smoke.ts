import "dotenv/config";
import { parseCardText } from "../src/parse-card";

const parsed = parseCardText("Alex Chen\n陈艾力\nNorthwind Energy Ltd\nMarketing Manager\nalex.chen@northwind.example\n+1 415 555 0148\nhttps://northwind.example\n500 Market Street");
if (parsed.email !== "alex.chen@northwind.example") throw new Error(`email parsed as ${parsed.email}`);
if (!parsed.nameEn.includes("Alex")) throw new Error("english name missing");
if (parsed.nameZh !== "陈艾力") throw new Error("chinese name missing");
if (!parsed.company.includes("Northwind")) throw new Error("company missing");
if (!parsed.mobile.includes("415")) throw new Error("mobile missing");

const base = process.env.API_ORIGIN ?? "http://127.0.0.1:4000";

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alex.chen@northwind.example", password: "Northwind#2026" }),
  });
  if (!loginRes.ok) throw new Error(`login ${loginRes.status} ${await loginRes.text()}`);
  const login = (await loginRes.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${login.accessToken}`, "Content-Type": "application/json" };

  const cards = (await (await fetch(`${base}/cards`, { headers })).json()) as { id: string; name: string }[];
  if (!cards.some((card) => card.name === "Alex Chen")) throw new Error("seed card missing");

  const created = await fetch(`${base}/cards`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Smoke Card", company: "Northwind Energy", email: "smoke@northwind.example", template: "classic" }),
  });
  if (!created.ok) throw new Error(`create card ${created.status} ${await created.text()}`);
  const card = (await created.json()) as { id: string };

  const contact = await fetch(`${base}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Smoke Contact", email: "lead@example.com", company: "Example Co" }),
  });
  if (!contact.ok) throw new Error(`create contact ${contact.status} ${await contact.text()}`);

  const report = await fetch(`${base}/analytics?days=30`, { headers });
  if (!report.ok) throw new Error(`analytics ${report.status}`);
  const body = (await report.json()) as { series: unknown[] };
  if (body.series.length !== 30) throw new Error("analytics series length");

  const sam = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "sam.lee@northwind.example", password: "Northwind#2026" }),
  });
  const samBody = (await sam.json()) as { accessToken: string };
  const denied = await fetch(`${base}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${samBody.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nope", email: "nope@northwind.example", role: "USER" }),
  });
  if (denied.status !== 403 && denied.status !== 400) throw new Error(`expected member invite to be rejected, got ${denied.status}`);

  await fetch(`${base}/cards/${card.id}`, { method: "DELETE", headers });
  const pub = await fetch(`${base}/public/cards/alexchen`);
  if (!pub.ok) throw new Error(`public card ${pub.status}`);
  console.log("smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
