import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigComplete(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

/**
 * ブラウザ上でのみ初期化。設定が欠けているときは undefined。
 */
export function getFirebaseApp(): FirebaseApp | undefined {
  if (typeof window === "undefined") return undefined;
  if (!isFirebaseConfigComplete()) return undefined;
  if (!getApps().length) {
    initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain!,
      projectId: firebaseConfig.projectId!,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId!,
    });
  }
  return getApps()[0];
}

export function getFirebaseAuth(): Auth | undefined {
  const app = getFirebaseApp();
  if (!app) return undefined;
  return getAuth(app);
}

export function getFirebaseDb(): Firestore | undefined {
  const app = getFirebaseApp();
  if (!app) return undefined;
  return getFirestore(app);
}

export function getFirebaseStorage(): FirebaseStorage | undefined {
  const app = getFirebaseApp();
  if (!app) return undefined;
  if (!firebaseConfig.storageBucket) return undefined;
  return getStorage(app);
}
