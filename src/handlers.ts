import { TipSchema } from "./validate";
import { newId, secretMatches } from "./crypto";
import { autoAssign } from "./router";
import { authorize, AuditLog, type Role } from "./audit";
import type { TipStore, SapsGateway, VoucherProvider } from "./store";

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export interface Deps { store: TipStore; audit: AuditLog; saps: SapsGateway; vouchers: VoucherProvider }

/** POST /tips - anonymous intake. No auth, no identity fields, nothing user-linked is stored or logged. */
export async function submitTip(raw: unknown, d: Deps): Promise<{ receiptId: string }> {
  const parsed = TipSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "Invalid submission");
  if (await d.store.hasCommitment(parsed.data.commitment)) throw new ApiError(409, "Duplicate submission");
  const id = newId();
  const caseId = autoAssign(parsed.data, await d.store.openCases());
  await d.store.putTip({ id, ...parsed.data, status: caseId ? "ASSIGNED" : "RECEIVED", caseId, rewardClaimed: false });
  d.audit.append("system:intake", "tip.received", id);
  return { receiptId: id };
}

/** GET /tips/:id/status - returns status only; unknown IDs look like "RECEIVED" to avoid an existence oracle. */
export async function getStatus(receiptId: string, d: Deps): Promise<{ status: string }> {
  const t = await d.store.getTip(receiptId);
  return { status: t?.status ?? "RECEIVED" };
}

/** Case officer confirms a tip is credible; forwards it to SAPS over the secured gateway. */
export async function verifyTip(role: Role, actor: string, tipId: string, d: Deps): Promise<void> {
  authorize(role, "tip:verify");
  const tip = await d.store.getTip(tipId);
  if (!tip) throw new ApiError(404, "Not found");
  await d.saps.forward(tip);
  await d.store.setStatus(tipId, "VERIFIED");
  d.audit.append(actor, "tip.verified", tipId);
}

/** POST /rewards/claim - proof of knowledge of the secret behind the commitment; one-time voucher. */
export async function claimReward(receiptId: string, secretHex: string, d: Deps): Promise<{ voucher: string }> {
  const tip = await d.store.getTip(receiptId);
  // One generic error for every failure path: no oracle on which part was wrong.
  if (!tip || !secretMatches(secretHex, tip.commitment) || !(await d.store.claimIfEligible(receiptId))) {
    throw new ApiError(403, "Claim not available");
  }
  const voucher = await d.vouchers.issue();
  d.audit.append("system:rewards", "reward.issued", receiptId);
  return { voucher };
}
