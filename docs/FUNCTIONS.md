# Function reference
| Function | File | Purpose |
|---|---|---|
| `TipSchema` | validate.ts | Strict allow-list validation of a submission; rejects unknown fields |
| `sha256`, `newId` | crypto.ts | Hashing; 128-bit random receipt IDs |
| `secretMatches` | crypto.ts | Constant-time check that a claim secret matches its stored commitment |
| `authorize` | audit.ts | RBAC check, throws `Forbidden` |
| `AuditLog.append/verify/read` | audit.ts | Hash-chained log; tamper detection; audited reads |
| `stats` | audit.ts | Aggregate counts with k-anonymity suppression, analyst only, audited |
| `autoAssign` | router.ts | Matches tip to open case by category and geohash proximity; else triage |
| `submitTip` | handlers.ts | Anonymous intake: validate, dedupe, assign, store, audit |
| `getStatus` | handlers.ts | Status lookup without existence oracle |
| `verifyTip` | handlers.ts | Case officer verification and forward to SAPS |
| `claimReward` | handlers.ts | One-time voucher issue after proof of secret |
| `sealTip` | mobile/src/lib/seal.ts | On-phone sealed-box encryption (X25519, HKDF, XChaCha20-Poly1305, padded); creates commitment and claim secret |
| `TipStore`, `InMemoryStore` | store.ts | Persistence port; DynamoDB adapter in production |
| `authenticate` | auth.ts | Verifies staff JWT (RS256, issuer, audience, expiry); role derived server-side from exactly one group |
| `handle` | http.ts | Framework-free router; fails closed; generic error mapping |
| server | server.ts | Cloud Run/local entrypoint; security headers, 100KB body cap, no request logging; refuses to start without DEMO=1 |
| `encode` | mobile/src/lib/geohash.ts | On-device geohash (5 chars); GPS coordinates never leave the phone |
| `openTip` | mobile/src/lib/seal.ts | Reference decryptor for SAPS tooling and tests; private key never on phone or our servers |
| `api.*` | mobile/src/lib/api.ts | HTTPS-only client, no cookies, 15s timeout |
| `App` | mobile/App.tsx | Screens: report, receipt, check, claim, quick exit, screenshot block |
