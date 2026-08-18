import {
  signInWithPopup,
  signInWithCredential,
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

interface ChromeIdentity {
  identity?: {
    getAuthToken?: (options: { interactive: boolean }, callback: (token?: string) => void) => void;
  };
  runtime?: {
    lastError?: unknown;
  };
}

/**
 * Platform-aware Google Sign-In supporting Web, Chrome Extension MV3, and Capacitor Android.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const chromeObj = (typeof globalThis !== 'undefined' ? (globalThis as unknown as { chrome?: ChromeIdentity }).chrome : undefined);

  // 1. Chrome Extension target (MV3 identity API)
  if (chromeObj?.identity?.getAuthToken) {
    return new Promise((resolve, reject) => {
      chromeObj.identity!.getAuthToken!({ interactive: true }, async (token?: string) => {
        if (chromeObj.runtime?.lastError || !token) {
          return reject(chromeObj.runtime?.lastError || new Error('Chrome identity failed to get auth token'));
        }
        try {
          const credential = GoogleAuthProvider.credential(null, token);
          const cred = await signInWithCredential(auth, credential);
          resolve(cred);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // 2. Capacitor Android / Native Shell
  if (Capacitor.isNativePlatform()) {
    // Native Capacitor platform can use popup or Capacitor GoogleAuth plugin if installed
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (nativeErr) {
      console.warn('Capacitor native popup fallback failed, retrying standard popup', nativeErr);
      return await signInWithPopup(auth, googleProvider);
    }
  }

  // 3. Web / PWA
  return await signInWithPopup(auth, googleProvider);
}

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
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const raw = userSnap.data();
    return UserSchema.parse({
      ...raw,
      uid: firebaseUser.uid,
    });
  }

  // First sign-in: initialize user profile document with default preferences
  const initialUser: User = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || 'Anonymous User',
    photoURL: firebaseUser.photoURL || null,
    createdAt: Timestamp.now(),
    schemaVersion: 1,
    prefs: {
      hideCompletedTasks: false,
      hideCompletedSubtasks: false,
      rememberLastFolder: false,
    },
  };

  const validated = UserSchema.parse(initialUser);
  await setDoc(userRef, validated);
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

  await updateDoc(userRef, updatePayload);
}
