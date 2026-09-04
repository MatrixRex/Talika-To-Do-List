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
  getDocFromCache,
  setDoc,
  updateDoc,
  Timestamp,
  terminate,
  clearIndexedDbPersistence,
  type DocumentSnapshot
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { auth, db } from './firebase';
import { UserSchema, type User, type UserPrefs } from './schema';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

interface ChromeApi {
  identity?: {
    getAuthToken?: (options: { interactive: boolean }, callback: (token?: string) => void) => void;
    launchWebAuthFlow?: (options: { url: string; interactive: boolean }) => Promise<string>;
    getRedirectURL?: (path?: string) => string;
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

  // 1. Chrome Extension Target (Manifest V3)
  // Note: Standard signInWithPopup is blocked by MV3 CSP (cannot inject remote apis.google.com/js/api.js script).
  // In extensions, Google Auth uses chrome.identity.getAuthToken or launchWebAuthFlow.
  if (isExtension) {
    if (chromeObj?.identity?.getAuthToken) {
      try {
        const token = await new Promise<string>((resolve, reject) => {
          chromeObj.identity!.getAuthToken!({ interactive: true }, (token?: string) => {
            if (chromeObj.runtime?.lastError || !token) {
              const err = chromeObj.runtime?.lastError;
              return reject(err || new Error('No token returned from chrome.identity'));
            }
            resolve(token);
          });
        });
        const credential = GoogleAuthProvider.credential(null, token);
        return await signInWithCredential(auth, credential);
      } catch (identityErr: unknown) {
        console.warn('chrome.identity.getAuthToken error:', identityErr);

        // Try launchWebAuthFlow if Google Client ID is configured in env
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_FIREBASE_CLIENT_ID;
        if (clientId && chromeObj?.identity?.launchWebAuthFlow && chromeObj?.identity?.getRedirectURL) {
          try {
            const redirectUri = chromeObj.identity.getRedirectURL();
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('openid email profile')}`;
            const responseUrl = await chromeObj.identity.launchWebAuthFlow({
              url: authUrl,
              interactive: true,
            });
            const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
            const accessToken = hashParams.get('access_token');
            if (accessToken) {
              const credential = GoogleAuthProvider.credential(null, accessToken);
              return await signInWithCredential(auth, credential);
            }
          } catch (flowErr) {
            console.warn('launchWebAuthFlow failed:', flowErr);
          }
        }

        const errObj = identityErr as { message?: string };
        const isMissingOAuth = !errObj?.message || errObj.message.includes('OAuth2') || errObj.message.includes('client ID');
        if (isMissingOAuth) {
          throw new Error(
            'Google Sign-In on Chrome extension requires an OAuth2 client ID in Google Cloud Console. For local testing, please click "Quick Demo Sign-In".',
            { cause: identityErr }
          );
        }
        throw identityErr;
      }
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

  // 3. Web / PWA
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (popupErr: unknown) {
    const error = popupErr as { code?: string };
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
      console.warn('Popup blocked, falling back to signInWithRedirect:', popupErr);
      await signInWithRedirect(auth, googleProvider);
      return null;
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

export interface CachedAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

const AUTH_USER_KEY = 'talika:auth_user';
const USER_PROFILE_KEY = 'talika:user_profile';

export function getCachedAuthUser(): CachedAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.uid === 'string') {
      return parsed as CachedAuthUser;
    }
  } catch (err) {
    console.warn('Failed to parse cached auth user:', err);
  }
  return null;
}

export function saveCachedAuthUser(user: FirebaseUser | CachedAuthUser): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CachedAuthUser = {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save cached auth user:', err);
  }
}

export function getCachedUserProfile(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.uid === 'string') {
      if (parsed.createdAt && typeof parsed.createdAt.seconds === 'number') {
        parsed.createdAt = new Timestamp(parsed.createdAt.seconds, parsed.createdAt.nanoseconds || 0);
      }
      return UserSchema.parse(parsed);
    }
  } catch (err) {
    console.warn('Failed to parse cached user profile:', err);
  }
  return null;
}

export function saveCachedUserProfile(profile: User): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.warn('Failed to save cached user profile:', err);
  }
}

export function clearCachedAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
  } catch (err) {
    console.warn('Failed to clear cached auth:', err);
  }
}

export function hasCachedAuthSession(): boolean {
  return getCachedAuthUser() !== null;
}

export function getEffectiveUserId(): string {
  return auth.currentUser?.uid || getCachedAuthUser()?.uid || '';
}

/**
 * Sign out and clear local IndexedDB cache per SPEC.md Stage 3 exit criterion.
 */
export async function signOutUser(): Promise<void> {
  clearCachedAuth();
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
  saveCachedAuthUser(firebaseUser);
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    let userSnap: DocumentSnapshot | null = null;
    try {
      userSnap = await getDocFromCache(userRef);
    } catch {
      // If not in cache or offline, will try server
    }
    if (!userSnap || !userSnap.exists()) {
      userSnap = await getDoc(userRef);
    }
    if (userSnap && userSnap.exists()) {
      const raw = userSnap.data();
      const user = UserSchema.parse({
        ...raw,
        uid: firebaseUser.uid,
      });
      if (user.email && user.email !== user.email.toLowerCase()) {
        user.email = user.email.toLowerCase();
        await updateDoc(userRef, { email: user.email }).catch(() => {});
      }
      saveCachedUserProfile(user);
      return user;
    }
  } catch (err) {
    console.warn('Could not read user profile from Firestore, using local cache/defaults:', err);
  }

  // Check local cache if available before using default
  const cached = getCachedUserProfile();
  if (cached && cached.uid === firebaseUser.uid) {
    return cached;
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
  saveCachedUserProfile(validated);
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
