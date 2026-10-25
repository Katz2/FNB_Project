# SA Sight - Security (SSDLC) and Architecture

## 1. Security requirements and risk assessment
| Risk | Control |
|---|---|
| Tipster identified (IP, device, metadata) | No accounts; strict schema rejects extra fields; API Gateway/CloudFront access logs with IP disabled; client strips metadata; only coarse geohash (~5km) and hour bucket stored |
| Tip content leaked in transit/at rest | Client-side sealed-box encryption (X25519 + XChaCha20-Poly1305 to the SAPS public key, padded to hide length); TLS 1.3; KMS at rest; platform never holds plaintext |
| Fake tips / reward fraud | Case-officer verification gate; reward only when VERIFIED; one-time claim via atomic conditional write; rate limiting and WAF |
| Reward links tipster to tip | Claim = proof of knowledge of a secret (hash commitment). Voucher code is issued in-app, no phone or ID |
| Insider abuse | RBAC least privilege, aggregate stats with k-anonymity (k=5), hash-chained audit log, auditor role separate from operators |
| Tampering with records | Hash-chained audit; S3 Object Lock (compliance mode) for log archives |
| Enumeration | Generic errors on claim/status; 128-bit receipt IDs |

POPIA: data minimisation by design, no personal information collected from tipsters.

## 2. Threat model (STRIDE, key items)
Spoofing: SAPS gateway uses mTLS and signed payloads. Tampering: signed and chained records. Repudiation: audited actions. Information disclosure: E2E encryption, no PII. DoS: WAF, throttling, payload cap 64KB. Elevation: per-role IAM, no shared admin.

## 3. Secure development
Strict TypeScript, allow-list validation, no dynamic eval or SQL, pinned deps, `npm audit` gate in CI (a zod DoS advisory was found and fixed by upgrading to v4), secrets only via AWS Secrets Manager.

## 4. Security testing
Unit tests per control (`npm test`). CI (`.github/workflows/ci.yml`) runs on every push and weekly: gitleaks secret scan over full history, typecheck, tests, `npm audit` gate, CodeQL SAST; Dependabot keeps dependencies and actions current. Still to add: OWASP ZAP (DAST) against the staging API.

## 5. Assessment and secure integration
Pen-test SAPS gateway before go-live; DPIA; key rotation drill.

## Cyber incident protocol
1. Detect (GuardDuty, CloudTrail, WAF alarms to SNS) 2. Contain (revoke IAM session, rotate KMS and SAPS keys, WAF block) 3. Eradicate and recover (redeploy from signed build, restore PITR) 4. Verify audit chain 5. Notify Information Regulator and SAPS within POPIA timelines 6. Post-incident review.

## AWS Well-Architected mapping
- Security: above. Reliability: multi-AZ, DynamoDB PITR, SQS buffer to SAPS with DLQ. Performance: Lambda, CloudFront. Cost: serverless pay-per-use, reward fund budget alarms. Operational excellence: IaC (CDK), CI/CD, runbooks. Sustainability: serverless, right-sized.
- **Hosting:** AWS af-south-1 (Cape Town) for SA data residency; Firebase Hosting + Cloud Functions only for the demo, with synthetic data.

## Data flow
Phone (seal) -> CloudFront/WAF -> API Gateway -> Lambda (validate, route) -> DynamoDB (KMS) -> SQS -> Lambda -> SAPS gateway (mTLS)
