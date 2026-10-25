import { ApiError, submitTip, getStatus, verifyTip, claimReward, type Deps } from "./handlers";
import { Forbidden, stats } from "./audit";
import { AuthError, type Identity } from "./auth";

export interface Req { method: string; path: string; authorization?: string; body?: unknown }
export interface Res { status: number; body: unknown }
export interface HttpDeps extends Deps { authenticate: (h?: string) => Promise<Identity>; sapsPublicKey: object }

const ok = (body: unknown, status = 200): Res => ({ status, body });
const ID = "([a-f0-9]{32})";

/** Framework-free router: same code runs on Cloud Run, Lambda (via adapter) or tests. Fails closed. */
export async function handle(r: Req, d: HttpDeps): Promise<Res> {
  try {
    const { method: m, path: p } = r;
    let x: RegExpExecArray | null;
    if (m === "GET" && p === "/api/saps-public-key") return ok(d.sapsPublicKey);
    if (m === "POST" && p === "/api/tips") return ok(await submitTip(r.body, d), 201);
    if (m === "GET" && (x = new RegExp(`^/api/tips/${ID}/status$`).exec(p))) return ok(await getStatus(x[1]!, d));
    if (m === "POST" && p === "/api/rewards/claim") {
      const b = r.body as { receiptId?: unknown; secret?: unknown } | null;
      if (typeof b?.receiptId !== "string" || typeof b.secret !== "string") throw new ApiError(400, "Invalid request");
      return ok(await claimReward(b.receiptId, b.secret, d));
    }
    if (m === "POST" && (x = new RegExp(`^/api/tips/${ID}/verify$`).exec(p))) {
      const who = await d.authenticate(r.authorization);
      await verifyTip(who.role, who.actor, x[1]!, d);
      return ok({ ok: true });
    }
    if (m === "GET" && p === "/api/stats") {
      const who = await d.authenticate(r.authorization);
      return ok(stats(who.role, await d.store.all(), d.audit, who.actor));
    }
    if (m === "GET" && p === "/api/audit") {
      const who = await d.authenticate(r.authorization);
      return ok(d.audit.read(who.role, who.actor));
    }
    return { status: 404, body: { error: "Not found" } };
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, body: { error: e.message } };
    if (e instanceof AuthError) return { status: 401, body: { error: "Unauthorized" } };
    if (e instanceof Forbidden) return { status: 403, body: { error: "Forbidden" } };
    return { status: 500, body: { error: "Internal error" } }; // never leak internals
  }
}
