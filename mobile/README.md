# SA Sight mobile app (React Native / Expo)

Setup (the repo holds only our code; Expo picks compatible library versions for you):
1. `npx create-expo-app@latest sa-sight-mobile --template blank-typescript`
2. Copy `App.tsx` and the `src/` folder from here into it (replace the default `App.tsx`).
3. `npx expo install expo-location expo-secure-store expo-crypto expo-linear-gradient expo-screen-capture`
4. `npm i @noble/curves@1 @noble/ciphers@1 @noble/hashes@1`
5. Create `.env` with `EXPO_PUBLIC_API_URL=https://<your-cloud-run-url>` (must be https).
6. In `app.json` add plugins:
   `["expo-location", { "locationWhenInUsePermission": "SA Sight uses only a rough 5 km area to route your report." }]`
   `["expo-secure-store", { "faceIDPermission": "Protect your saved receipt." }]`
   Optional discreet mode: set `name` to a neutral name and use a neutral icon.
7. `npx expo start`, then scan the QR code with Expo Go on an Android phone.
8. Test APK: `npx eas-cli build -p android --profile preview`.

Before release: add certificate pinning (needs a development build, not Expo Go), obfuscated release build, no analytics or ad SDKs, and test against the OWASP MASVS checklist. The UI code here has not been compiled or run by us yet; the sealing, geohash and API contract are covered by tests (`npm test` in the repo root).
