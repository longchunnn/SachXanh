import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

function hasFirebaseConfig(config: ReturnType<typeof getFirebaseConfig>) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

const firebaseConfig = getFirebaseConfig();

export const firebaseEnabled = hasFirebaseConfig(firebaseConfig);

const app = firebaseEnabled
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const firebaseApp = app;
export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseDb = app ? getFirestore(app) : null;
