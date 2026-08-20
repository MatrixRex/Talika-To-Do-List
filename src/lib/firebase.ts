import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const isDev = import.meta.env.DEV;
const useEmulator = isDev || import.meta.env.VITE_USE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const emulatorHost = (typeof window !== 'undefined' && window.location.hostname) ? window.location.hostname : '127.0.0.1';

if (useEmulator && typeof window !== 'undefined') {
  try {
    connectFirestoreEmulator(db, emulatorHost, 8080);
  } catch {
    // ignore if already connected
  }
  try {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  } catch {
    // ignore if already connected
  }
}

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support all of the features required to enable persistence.');
    }
  });
}
