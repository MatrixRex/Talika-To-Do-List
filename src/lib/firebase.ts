import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

// In a real app these would be populated, but for local emulator testing we just need something valid-looking.
const firebaseConfig = {
  apiKey: "fake-api-key",
  authDomain: "demo-todo.firebaseapp.com",
  projectId: "demo-todo",
  storageBucket: "demo-todo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Always connect to emulator for Stage 1
connectFirestoreEmulator(db, '127.0.0.1', 8080);

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support all of the features required to enable persistence.');
  }
});
