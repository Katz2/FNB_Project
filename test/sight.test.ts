import test from "node:test";
import assert from "node:assert/strict";
import { sha256 } from "../src/crypto";
import { TipSchema } from "../src/validate";
import { autoAssign } from "../src/router";
import { AuditLog, authorize, stats } from "../src/audit";
import { InMemoryStore } from "../src/store";
import { submitTip, verifyTip, claimReward, getStatus, type Deps } from "../src/handlers";

const secret = "ab".repeat(32);
const valid = { category: "GBV" as const, geohash: "k2jy8", hourBucket: "2026-10-24T10:00:00.000Z", ciphertext: "QUJD", commitment: sha256(Buffer.from(secret, "hex")) };
const mk = (): Deps => ({ store: new InMemoryStore([{ id: "CAS-1", category: "GBV", geohash: "k2jy9" }]), audit: new AuditLog(),
  saps: { forward: async () => {} }, vouchers: { issue: async () => "VCH-123" } });

test("schema rejects unknown/identifying fields and bad input", () => {
  assert.ok(TipSchema.safeParse(valid).success);
  assert.ok(!TipSchema.safeParse({ ...valid, ip: "1.2.3.4" }).success);
  assert.ok(!TipSchema.safeParse({ ...valid, geohash: "k2jy8x" }).success);
  assert.ok(!TipSchema.safeParse({ ...valid, ciphertext: "<script>" }).success);
});
test("router assigns same-category nearby case only", () => {
  assert.equal(autoAssign(valid, [{ id: "C", category: "GBV", geohash: "k2jy9" }]), "C");
  assert.equal(autoAssign(valid, [{ id: "C", category: "DRUGS", geohash: "k2jy9" }]), undefined);
  assert.equal(autoAssign(valid, [{ id: "C", category: "GBV", geohash: "u4pru" }]), undefined);
});
test("audit chain detects tampering", () => {
  const l = new AuditLog(); l.append("a", "x", "1"); l.append("b", "y", "2");
  const copy = JSON.parse(JSON.stringify(l.read("AUDITOR", "aud")));
  assert.ok(l.verify(copy)); copy[0].actor = "evil"; assert.ok(!l.verify(copy));
});
test("RBAC: least privilege enforced", () => {
  assert.throws(() => authorize("ANALYST", "audit:read"));
  assert.throws(() => authorize("CASE_OFFICER", "stats:read"));
  assert.throws(() => new AuditLog().read("ANALYST", "x"));
});
test("stats suppress small cells", () => {
  const d = mk(); const tips = [{ ...valid, id: "1", status: "RECEIVED", rewardClaimed: false }] as any;
  assert.deepEqual(stats("ANALYST", tips, d.audit, "an1"), { GBV: "<5" });
});
test("end-to-end: submit, verify, claim once, wrong secret rejected", async () => {
  const d = mk(); const { receiptId } = await submitTip(valid, d);
  assert.equal((await getStatus(receiptId, d)).status, "ASSIGNED");
  await assert.rejects(() => submitTip(valid, d), { status: 409 });
  await assert.rejects(() => claimReward(receiptId, secret, d), { status: 403 });
  await assert.rejects(() => verifyTip("ANALYST", "x", receiptId, d));
  await verifyTip("CASE_OFFICER", "co1", receiptId, d);
  await assert.rejects(() => claimReward(receiptId, "cd".repeat(32), d), { status: 403 });
  assert.deepEqual(await claimReward(receiptId, secret, d), { voucher: "VCH-123" });
  await assert.rejects(() => claimReward(receiptId, secret, d), { status: 403 });
  assert.ok(d.audit.verify());
});
