import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const isDev = import.meta.env.DEV;
const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isPlaceholderKey = !rawApiKey || rawApiKey === 'fake-api-key-for-dev';
const useEmulator = isDev || import.meta.env.VITE_USE_EMULATOR === 'true' || isPlaceholderKey;

const firebaseConfig = {
  apiKey: rawApiKey || 'fake-api-key-for-dev',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'localhost',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-talika',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef'
};

export const app = initializeApp(firebaseConfig);

// Initialize Firestore with modern persistent multi-tab cache settings
export const db = typeof window !== 'undefined'
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
  : getFirestore(app);

export const auth = getAuth(app);

const isExtension = typeof window !== 'undefined' && (
  window.location.protocol.startsWith('chrome-extension') ||
  window.location.protocol.startsWith('moz-extension')
);

const emulatorHost = (typeof window !== 'undefined' && window.location.hostname && !isExtension && window.location.hostname !== 'localhost')
  ? window.location.hostname
  : '127.0.0.1';

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
