import "dotenv/config";
import { parseCardText } from "../src/parse-card";

const parsed = parseCardText("Ada Example\n示例\nExample Studio Ltd\nAccount Lead\nada@example.com\n+1 415 555 0100\nhttps://example.com\n1 Example Street");
if (parsed.email !== "ada@example.com") throw new Error(`email parsed as ${parsed.email}`);
if (!parsed.nameEn.includes("Ada")) throw new Error("english name missing");
if (parsed.nameZh !== "示例") throw new Error("chinese name missing");
if (!parsed.company.includes("Example")) throw new Error("company missing");
if (!parsed.mobile.includes("415")) throw new Error("mobile missing");

const base = process.env.API_ORIGIN ?? "http://127.0.0.1:4000";
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;
const smokeMemberEmail = process.env.SMOKE_MEMBER_EMAIL;
const smokeMemberPassword = process.env.SMOKE_MEMBER_PASSWORD;
if (!smokeEmail || !smokePassword || !smokeMemberEmail || !smokeMemberPassword) {
  throw new Error("Set SMOKE_EMAIL, SMOKE_PASSWORD, SMOKE_MEMBER_EMAIL, and SMOKE_MEMBER_PASSWORD");
}

async function main() {
  const health = await fetch(`${base}/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);

  const loginRes = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: smokeEmail, password: smokePassword }),
  });
  if (!loginRes.ok) throw new Error(`login ${loginRes.status} ${await loginRes.text()}`);
  const login = (await loginRes.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${login.accessToken}`, "Content-Type": "application/json" };

  const created = await fetch(`${base}/cards`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Smoke Card", company: "Example Studio Ltd", email: "smoke@example.com", template: "classic", visibility: "PUBLIC" }),
  });
  if (!created.ok) throw new Error(`create card ${created.status} ${await created.text()}`);
  const card = (await created.json()) as { id: string; qrSlug: string; name: string };

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
    body: JSON.stringify({ email: smokeMemberEmail, password: smokeMemberPassword }),
  });
  const samBody = (await sam.json()) as { accessToken: string };
  const denied = await fetch(`${base}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${samBody.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nope", email: "nope@example.com", role: "USER" }),
  });
  if (denied.status !== 403 && denied.status !== 400) throw new Error(`expected member invite to be rejected, got ${denied.status}`);

  const pub = await fetch(`${base}/public/cards/${card.qrSlug}`);
  if (!pub.ok) throw new Error(`public card ${pub.status}`);

  const profile = await fetch(`${base}/auth/profile`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title: "Administrator", phone: "" }),
  });
  if (!profile.ok) throw new Error(`profile ${profile.status} ${await profile.text()}`);

  const badPassword = await fetch(`${base}/auth/password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ currentPassword: "wrong-password", nextPassword: "replacement-pass" }),
  });
  if (badPassword.status !== 401) throw new Error(`expected bad password 401, got ${badPassword.status}`);

  const savedCard = await fetch(`${base}/contacts/from-card`, {
    method: "POST",
    headers,
    body: JSON.stringify({ slug: card.qrSlug }),
  });
  if (!savedCard.ok) throw new Error(`from-card ${savedCard.status} ${await savedCard.text()}`);
  const savedBody = (await savedCard.json()) as { id: string; name: string; alreadySaved: boolean };
  if (savedBody.name !== "Smoke Card") throw new Error("saved card name");
  const again = await fetch(`${base}/contacts/from-card`, { method: "POST", headers, body: JSON.stringify({ slug: card.qrSlug }) });
  const againBody = (await again.json()) as { alreadySaved: boolean };
  if (!again.ok || !againBody.alreadySaved) throw new Error("expected duplicate card save to be recognized");
  if (!savedBody.alreadySaved) await fetch(`${base}/contacts/${savedBody.id}`, { method: "DELETE", headers });
  await fetch(`${base}/cards/${card.id}`, { method: "DELETE", headers });

  const contactBody = (await contact.json()) as { id: string };
  const edited = await fetch(`${base}/contacts/${contactBody.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name: "Smoke Contact", company: "Example Updated", favorite: true }),
  });
  if (!edited.ok) throw new Error(`update contact ${edited.status} ${await edited.text()}`);
  await fetch(`${base}/contacts/${contactBody.id}`, { method: "DELETE", headers });

  const department = await fetch(`${base}/departments`, { method: "POST", headers, body: JSON.stringify({ name: "Smoke Department" }) });
  if (!department.ok) throw new Error(`department ${department.status} ${await department.text()}`);
  const departmentBody = (await department.json()) as { id: string };
  const occupied = await fetch(`${base}/teams`, { method: "POST", headers, body: JSON.stringify({ name: "Smoke Team", departmentId: departmentBody.id }) });
  if (!occupied.ok) throw new Error(`team ${occupied.status} ${await occupied.text()}`);
  const occupiedBody = (await occupied.json()) as { id: string };
  const blockedDelete = await fetch(`${base}/departments/${departmentBody.id}`, { method: "DELETE", headers });
  if (blockedDelete.status !== 400) throw new Error(`expected occupied department 400, got ${blockedDelete.status}`);
  await fetch(`${base}/teams/${occupiedBody.id}`, { method: "DELETE", headers });
  const removedDepartment = await fetch(`${base}/departments/${departmentBody.id}`, { method: "DELETE", headers });
  if (!removedDepartment.ok) throw new Error(`delete department ${removedDepartment.status}`);

  const blocked = await fetch(`${base}/departments/does-not-exist`, { method: "DELETE", headers });
  if (blocked.status !== 404) throw new Error(`expected missing department 404, got ${blocked.status}`);

  const invited = await fetch(`${base}/members`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Smoke Guest", email: `smoke-${Date.now()}@example.com`, role: "USER" }),
  });
  if (!invited.ok) throw new Error(`invite ${invited.status} ${await invited.text()}`);
  const guest = (await invited.json()) as { userId: string };
  const demoted = await fetch(`${base}/members/${guest.userId}`, { method: "PATCH", headers, body: JSON.stringify({ role: "MANAGER" }) });
  if (!demoted.ok) throw new Error(`role ${demoted.status} ${await demoted.text()}`);
  const removedGuest = await fetch(`${base}/members/${guest.userId}`, { method: "DELETE", headers });
  if (!removedGuest.ok) throw new Error(`remove member ${removedGuest.status}`);

  const me = (await (await fetch(`${base}/auth/me`, { headers })).json()) as { user: { id: string; memberships: { workspace: { id: string; name: string } }[] }; workspace: { id: string } };
  const self = await fetch(`${base}/members/${me.user.id}`, { method: "DELETE", headers });
  if (self.status !== 400) throw new Error(`expected self-remove 400, got ${self.status}`);
  const other = me.user.memberships.find((item) => item.workspace.id !== me.workspace.id);
  if (other) {
    const switched = await fetch(`${base}/auth/switch`, { method: "POST", headers, body: JSON.stringify({ workspaceId: other.workspace.id }) });
    if (!switched.ok) throw new Error(`switch ${switched.status} ${await switched.text()}`);
    const switchedBody = (await switched.json()) as { accessToken: string; workspace: { name: string } };
    if (switchedBody.workspace.name !== other.workspace.name) throw new Error(`switched to ${switchedBody.workspace.name}`);
    const otherCards = (await (await fetch(`${base}/cards`, { headers: { Authorization: `Bearer ${switchedBody.accessToken}` } })).json()) as { name: string }[];
    if (otherCards.some((item) => item.name === "Smoke Card")) throw new Error("workspace switch leaked cards");
  }

  const made = await fetch(`${base}/contacts/groups`, { method: "POST", headers, body: JSON.stringify({ name: "Smoke Group" }) });
  if (!made.ok) throw new Error(`create group ${made.status} ${await made.text()}`);
  const paged = await fetch(`${base}/contacts?page=1&pageSize=59&sort=created`, { headers });
  const pageBody = (await paged.json()) as { items?: unknown[]; total?: number };
  if (!paged.ok || !Array.isArray(pageBody.items) || typeof pageBody.total !== "number") throw new Error("paged cardholder");
  const plain = await fetch(`${base}/contacts`, { headers });
  if (!Array.isArray(await plain.json())) throw new Error("contact list should stay an array");
  const multi = await fetch(`${base}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Smoke Multi", email: "multi@example.com", groups: ["Smoke Group", "Smoke Other"] }),
  });
  if (!multi.ok) throw new Error(`multi ${multi.status} ${await multi.text()}`);
  const multiBody = (await multi.json()) as { id: string; groups: string[]; groupName: string | null };
  if (!multiBody.groups.includes("Smoke Other") || multiBody.groupName !== "Smoke Group") throw new Error("groups were not saved");
  const grouped = await fetch(`${base}/contacts?page=1&pageSize=59&group=${encodeURIComponent("Smoke Other")}`, { headers });
  const groupedBody = (await grouped.json()) as { items: { id: string }[] };
  if (!grouped.ok || !groupedBody.items.some((item) => item.id === multiBody.id)) throw new Error("second group filter missed the card");
  const added = await fetch(`${base}/contacts/categorize`, { method: "POST", headers, body: JSON.stringify({ ids: [multiBody.id], groupName: "Smoke Third" }) });
  if (!added.ok) throw new Error(`categorize ${added.status} ${await added.text()}`);
  const loaded = await fetch(`${base}/contacts/${multiBody.id}`, { headers });
  const loadedBody = (await loaded.json()) as { groups: string[] };
  if (!loadedBody.groups.includes("Smoke Group") || !loadedBody.groups.includes("Smoke Third")) throw new Error("categorize replaced groups");
  await fetch(`${base}/contacts/${multiBody.id}`, { method: "DELETE", headers });
  for (const name of ["Smoke Group", "Smoke Other", "Smoke Third"]) {
    const removedGroup = await fetch(`${base}/contacts/groups?name=${encodeURIComponent(name)}`, { method: "DELETE", headers });
    if (!removedGroup.ok) throw new Error(`delete group ${name} ${removedGroup.status}`);
  }
  const bad = new FormData();
  bad.append("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
  const rejected = await fetch(`${base}/scans/preview`, { method: "POST", headers: { Authorization: headers.Authorization }, body: bad });
  if (rejected.status !== 400) throw new Error(`expected preview 400, got ${rejected.status}`);

  console.log("smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
