import type { RecipientJwk } from "./seal";

export class ApiFailure extends Error { constructor(public status: number) { super("Request failed"); } }

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

/** All calls: HTTPS only (except dev), no cookies, 15s timeout, no custom headers that could identify the device. */
async function call<T>(path: string, init: { method?: string; body?: string } = {}): Promise<T> {
  if (!BASE.startsWith("https://") && !(__DEV__ && BASE.startsWith("http://"))) throw new ApiFailure(0);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15_000);
  try {
    const r = await fetch(BASE + path, { ...init, credentials: "omit", signal: ctl.signal, headers: { "content-type": "application/json" } });
    if (!r.ok) throw new ApiFailure(r.status);
    return (await r.json()) as T;
  } finally { clearTimeout(timer); }
}

export interface TipBody { category: string; geohash: string; hourBucket: string; ciphertext: string; commitment: string }
export const getKey = () => call<RecipientJwk>("/api/saps-public-key");
export const postTip = (b: TipBody) => call<{ receiptId: string }>("/api/tips", { method: "POST", body: JSON.stringify(b) });
export const getStatus = (id: string) => call<{ status: string }>(`/api/tips/${encodeURIComponent(id)}/status`);
export const claim = (receiptId: string, secret: string) => call<{ voucher: string }>("/api/rewards/claim", { method: "POST", body: JSON.stringify({ receiptId, secret }) });
