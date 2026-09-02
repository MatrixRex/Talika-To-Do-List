import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
  type UserCredential
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  terminate,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { auth, db } from './firebase';
import { UserSchema, type User, type UserPrefs } from './schema';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

interface ChromeApi {
  identity?: {
    getAuthToken?: (options: { interactive: boolean }, callback: (token?: string) => void) => void;
  };
  tabs?: {
    create?: (options: { url: string }) => void;
  };
  runtime?: {
    getURL?: (path: string) => string;
    lastError?: unknown;
  };
}

/**
 * Platform-aware Google Sign-In supporting Web, Chrome Extension MV3, and Capacitor Android.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const isExtension = typeof window !== 'undefined' && (
    window.location.protocol.startsWith('chrome-extension') ||
    window.location.protocol.startsWith('moz-extension')
  );

  const chromeObj = (typeof globalThis !== 'undefined' ? (globalThis as unknown as { chrome?: ChromeApi }).chrome : undefined);

  // If in Chrome Extension and inside a popup window (width <= 460), open Talika in a dedicated tab so popup closing doesn't abort sign-in
  if (isExtension && chromeObj?.tabs?.create && chromeObj?.runtime?.getURL && window.innerWidth <= 460) {
    chromeObj.tabs.create({ url: chromeObj.runtime.getURL('index.html') });
    return null;
  }

  // 1. Chrome Extension target (MV3 identity API if oauth2 client configured)
  if (chromeObj?.identity?.getAuthToken) {
    try {
      const token = await new Promise<string>((resolve, reject) => {
        chromeObj.identity!.getAuthToken!({ interactive: true }, (token?: string) => {
          if (chromeObj.runtime?.lastError || !token) {
            return reject(chromeObj.runtime?.lastError || new Error('Chrome identity failed to get auth token'));
          }
          resolve(token);
        });
      });
      const credential = GoogleAuthProvider.credential(null, token);
      return await signInWithCredential(auth, credential);
    } catch (identityErr) {
      console.warn('Chrome identity getAuthToken unavailable, falling back to popup:', identityErr);
    }
  }

  // 2. Capacitor Android / Native Shell
  if (Capacitor.isNativePlatform()) {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (nativeErr) {
      console.warn('Capacitor native popup fallback failed, retrying standard popup', nativeErr);
      return await signInWithPopup(auth, googleProvider);
    }
  }

  // 3. Web / PWA / Extension Tab
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (popupErr: unknown) {
    const error = popupErr as { code?: string };
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
      if (!isExtension) {
        console.warn('Popup blocked, falling back to signInWithRedirect:', popupErr);
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
    }
    throw popupErr;
  }
}

/**
 * 1-Tap instant sign-in for emulator / local testing without relying on popup windows.
 */
export async function signInAsDemoUser(email = 'demo@talika.app', password = 'password123'): Promise<UserCredential> {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (
      error.code === 'auth/user-not-found' ||
      error.code === 'auth/invalid-credential' ||
      error.code === 'auth/invalid-email'
    ) {
      return await createUserWithEmailAndPassword(auth, email, password);
    }
    throw err;
  }
}

export { getRedirectResult };

/**
 * Sign out and clear local IndexedDB cache per SPEC.md Stage 3 exit criterion.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.warn('IndexedDB persistence cleanup after signout:', err);
  }
}

/**
 * Synchronize and ensure the users/{uid} document exists in Firestore matching SPEC.md data model.
 */
export async function syncUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const raw = userSnap.data();
      const user = UserSchema.parse({
        ...raw,
        uid: firebaseUser.uid,
      });
      if (user.email && user.email !== user.email.toLowerCase()) {
        user.email = user.email.toLowerCase();
        await updateDoc(userRef, { email: user.email });
      }
      return user;
    }
  } catch (err) {
    console.warn('Could not read user profile from Firestore, using defaults:', err);
  }

  // First sign-in: initialize user profile document with default preferences
  const initialUser: User = {
    uid: firebaseUser.uid,
    email: (firebaseUser.email || '').toLowerCase(),
    displayName: firebaseUser.displayName || 'Anonymous User',
    photoURL: firebaseUser.photoURL || null,
    createdAt: Timestamp.now(),
    schemaVersion: 1,
    prefs: {
      hideCompletedTasks: true,
      hideCompletedSubtasks: false,
      rememberLastFolder: false,
      reduceAnimations: false,
      fastMode: false,
    },
  };

  const validated = UserSchema.parse(initialUser);
  try {
    await setDoc(userRef, validated);
  } catch (err) {
    console.warn('Could not write initial user profile to Firestore:', err);
  }
  return validated;
}

/**
 * Update user preferences in Firestore.
 */
export async function updateUserPreferences(uid: string, prefs: Partial<UserPrefs>): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const updatePayload: Record<string, boolean> = {};
  if (prefs.hideCompletedTasks !== undefined) {
    updatePayload['prefs.hideCompletedTasks'] = prefs.hideCompletedTasks;
  }
  if (prefs.hideCompletedSubtasks !== undefined) {
    updatePayload['prefs.hideCompletedSubtasks'] = prefs.hideCompletedSubtasks;
  }
  if (prefs.rememberLastFolder !== undefined) {
    updatePayload['prefs.rememberLastFolder'] = prefs.rememberLastFolder;
  }
  if (prefs.reduceAnimations !== undefined) {
    updatePayload['prefs.reduceAnimations'] = prefs.reduceAnimations;
  }
  if (prefs.fastMode !== undefined) {
    updatePayload['prefs.fastMode'] = prefs.fastMode;
  }

  if (Object.keys(updatePayload).length > 0) {
    await updateDoc(userRef, updatePayload);
  }
}
