# Demo deployment (Firebase Hosting + Cloud Run + Firestore) - synthetic data only

1. **Project:** create a Firebase project; in the console enable Firestore (Native mode). Pick the location carefully, it cannot be changed later.
2. **Tools:** install the Firebase CLI and the Google Cloud CLI; run `firebase login`, `gcloud auth login`, then `firebase use --add` and `gcloud config set project <id>`.
3. **Lock the database:** `firebase deploy --only firestore:rules` (deny-all rules in `firestore.rules`).
4. **Dedicated identity (no key files):**
   `gcloud iam service-accounts create sa-sight-api`
   `gcloud projects add-iam-policy-binding <id> --member=serviceAccount:sa-sight-api@<id>.iam.gserviceaccount.com --role=roles/datastore.user`
5. **Deploy the API:**
   `gcloud run deploy sa-sight-api --source . --region <region> --service-account sa-sight-api@<id>.iam.gserviceaccount.com --set-env-vars DEMO=1,STORE=firestore --max-instances 1 --allow-unauthenticated`
   Use the same region name in `firebase.json`. `--max-instances 1` matters because the demo audit log is held in memory and is lost on restart.
6. **Deploy the site:** `firebase deploy --only hosting`
7. **Check:** open the hosting URL, submit a synthetic tip, and look for a document in the `tips` collection.

Limits of the demo: audit log not persisted; staff endpoints return 401 until an identity provider is configured (`AUTH_ISSUER`, `AUTH_AUDIENCE`).
