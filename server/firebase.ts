// Firebase Admin SDK initialisation for Firestore persistence
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let db: Firestore;

export function getDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) {
      // Uses default credentials on Cloud Run (automatically available).
      // For local dev, set GOOGLE_APPLICATION_CREDENTIALS env var.
      try {
        initializeApp({
          projectId: process.env.GCLOUD_PROJECT || 'gen-lang-client-0304161347',
        });
      } catch {
        initializeApp();
      }
    }
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}
