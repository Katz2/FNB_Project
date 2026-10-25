# SA Sight
Anonymous, verifiable, encrypted crime tip-offs (React Native mobile app + serverless API) routed to SAPS cases, with untraceable voucher rewards. FNB AOTY Hackathon 2026, Team Kopanya.

    npm i && npm run typecheck && npm test

Docs: `docs/SECURITY.md` (SSDLC, threat model, Well-Architected), `docs/FUNCTIONS.md`.

**Status:** API, staff auth, audit, Firestore demo store, on-phone encryption and geohash are built and tested (14 tests). The mobile UI (`mobile/App.tsx`) is written but not yet compiled or run: see `mobile/README.md`. Demo API: `DEMO=1 npm start`. Not yet built: DynamoDB/SQS adapters, SAPS mTLS gateway, CDK stack, voucher partner integration.
