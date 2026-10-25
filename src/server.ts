import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { createRemoteJWKSet } from "jose";
import { handle, type HttpDeps } from "./http";
import { AuditLog } from "./audit";
import { InMemoryStore, type TipStore } from "./store";
import { authenticate, AuthError } from "./auth";
import { newId } from "./crypto";

// Fail closed: production adapters (DynamoDB, SQS, SAPS mTLS gateway, voucher partner) are not wired yet.
if (process.env.DEMO !== "1") { console.error("Refusing to start: set DEMO=1 (synthetic data only)."); process.exit(1); }

const issuer = process.env.AUTH_ISSUER, audience = process.env.AUTH_AUDIENCE;
const getKey = issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : undefined;
const { publicKey } = generateKeyPairSync("x25519"); // demo key; private half is discarded

const demoCases = [ // sample open cases: Cape Town CBD, Mfuleni, Somerset West
  { id: "DEMO-CASE-1", category: "GBV", geohash: "k3vp5" }, { id: "DEMO-CASE-2", category: "GBV", geohash: "k3vq8" }, { id: "DEMO-CASE-3", category: "GBV", geohash: "k3vqh" },
];
let store: TipStore;
if (process.env.STORE === "firestore") {
  const fs = new (await import("./firestore")).FirestoreStore();
  await fs.ensureCases(demoCases);
  store = fs;
} else store = new InMemoryStore(demoCases);

const deps: HttpDeps = {
  store,
  audit: new AuditLog(),
  saps: { forward: async () => {} },
  vouchers: { issue: async () => `DEMO-${newId(6).toUpperCase()}` },
  sapsPublicKey: publicKey.export({ format: "jwk" }),
  authenticate: (h) => (issuer && audience && getKey ? authenticate(h, { issuer, audience, getKey }) : Promise.reject(new AuthError("Unauthorized"))),
};

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
} as const;
const MAX_BODY = 100_000;

createServer(async (req, res) => {
  const send = (status: number, type: string, body: string) => { res.writeHead(status, { ...SECURITY_HEADERS, "content-type": type }); res.end(body); };
  const path = (req.url ?? "/").split("?")[0]!;
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(413, "application/json", '{"error":"Too large"}'); chunks.push(c as Buffer); }
  let body: unknown;
  try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined; }
  catch { return send(400, "application/json", '{"error":"Invalid JSON"}'); }
  const out = await handle({ method: req.method ?? "GET", path, authorization: req.headers.authorization, body }, deps);
  send(out.status, "application/json", JSON.stringify(out.body)); // note: no request logging, so no IPs retained
}).listen(Number(process.env.PORT ?? 8080));
