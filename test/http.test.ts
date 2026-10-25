import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, type KeyLike } from "jose";
import { authenticate, AuthError } from "../src/auth";
import { handle, type HttpDeps } from "../src/http";
import { AuditLog } from "../src/audit";
import { InMemoryStore } from "../src/store";
import { sha256 } from "../src/crypto";

const issuer = "https://idp.test", audience = "sa-sight";
const sign = async (key: KeyLike, claims: Record<string, unknown>, o: { iss?: string; exp?: string } = {}) =>
  new SignJWT({ "cognito:groups": ["sas-analyst"], ...claims }).setProtectedHeader({ alg: "RS256" })
    .setIssuer(o.iss ?? issuer).setAudience(audience).setSubject("u1").setExpirationTime(o.exp ?? "5m").sign(key);

test("auth: valid token maps to role; bad issuer/expired/tampered/no-group/multi-group rejected", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const cfg = { issuer, audience, getKey: async () => publicKey };
  const ok = await sign(privateKey, {});
  assert.deepEqual(await authenticate(`Bearer ${ok}`, cfg), { actor: "u1", role: "ANALYST" });
  for (const bad of [
    await sign(privateKey, {}, { iss: "https://evil" }), await sign(privateKey, {}, { exp: "-1m" }),
    await sign(other.privateKey, {}), await sign(privateKey, { "cognito:groups": [] }),
    await sign(privateKey, { "cognito:groups": ["sas-analyst", "sas-auditor"] }), ok.slice(0, -3) + "abc",
  ]) await assert.rejects(() => authenticate(`Bearer ${bad}`, cfg), AuthError);
  await assert.rejects(() => authenticate(undefined, cfg), AuthError);
  await assert.rejects(() => authenticate("Basic abc", cfg), AuthError);
});

test("http: routes, fail-closed staff endpoints, generic errors", async () => {
  const d: HttpDeps = { store: new InMemoryStore(), audit: new AuditLog(), saps: { forward: async () => {} },
    vouchers: { issue: async () => "V" }, sapsPublicKey: { kty: "RSA" },
    authenticate: async (h) => { if (h !== "Bearer ok") throw new AuthError("x"); return { actor: "a1", role: "ANALYST" }; } };
  const tip = { category: "GBV", geohash: "k2jy8", hourBucket: "2026-10-24T10:00:00.000Z", ciphertext: "QUJD", commitment: sha256("c") };
  assert.equal((await handle({ method: "POST", path: "/api/tips", body: tip }, d)).status, 201);
  assert.equal((await handle({ method: "POST", path: "/api/tips", body: { ...tip, ip: "1" } }, d)).status, 400);
  assert.equal((await handle({ method: "GET", path: "/api/stats" }, d)).status, 401);
  assert.equal((await handle({ method: "GET", path: "/api/stats", authorization: "Bearer ok" }, d)).status, 200);
  assert.equal((await handle({ method: "GET", path: "/api/audit", authorization: "Bearer ok" }, d)).status, 403); // analyst != auditor
  assert.equal((await handle({ method: "POST", path: "/api/rewards/claim", body: { receiptId: 1 } }, d)).status, 400);
  assert.equal((await handle({ method: "GET", path: "/nope" }, d)).status, 404);
  d.store.getTip = async () => { throw new Error("db password=hunter2"); };
  const r = await handle({ method: "GET", path: `/api/tips/${"a".repeat(32)}/status` }, d);
  assert.deepEqual(r, { status: 500, body: { error: "Internal error" } }); // no internals leaked
});
