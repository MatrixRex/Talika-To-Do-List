import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  signInWithGoogle,
  signInAsDemoUser,
  getRedirectResult,
  signOutUser,
  syncUserProfile,
  updateUserPreferences,
  getCachedAuthUser,
  saveCachedAuthUser,
  getCachedUserProfile,
  saveCachedUserProfile,
  clearCachedAuth,
} from '../lib/auth';
import type { User, UserPrefs } from '../lib/schema';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInDemo: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePrefs: (prefs: Partial<UserPrefs>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialCachedUser = getCachedAuthUser();
  const initialCachedProfile = getCachedUserProfile();
  const hasInitialSession = !!initialCachedUser;

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(
    () => (initialCachedUser ? (initialCachedUser as unknown as FirebaseUser) : null)
  );
  const [userProfile, setUserProfile] = useState<User | null>(
    () => initialCachedProfile
  );
  const [loading, setLoading] = useState<boolean>(
    () => !hasInitialSession
  );

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let isMounted = true;

    // Check for redirect sign-in result (mobile browser fallback)
    getRedirectResult(auth)
      .then(async (cred) => {
        if (!isMounted) return;
        if (cred?.user) {
          setFirebaseUser(cred.user);
          saveCachedAuthUser(cred.user);
          const profile = await syncUserProfile(cred.user);
          if (isMounted) {
            setUserProfile(profile);
            setLoading(false);
          }
        }
      })
      .catch((err) => {
        console.warn('getRedirectResult notice:', err);
      });

    // Safety timeout ONLY when there is no cached session, to avoid hanging on cold unauthenticated starts
    const safetyTimer = setTimeout(() => {
      if (isMounted && !hasInitialSession) {
        setLoading(false);
      }
    }, 3000);

    const unsubAuth = onAuthStateChanged(
      auth,
      async (user) => {
        clearTimeout(safetyTimer);
        if (!isMounted) return;

        if (user) {
          setFirebaseUser(user);
          saveCachedAuthUser(user);
          setLoading(false);

          try {
            const profile = await syncUserProfile(user);
            if (isMounted) {
              setUserProfile(profile);
            }

            // Listen to live changes to user profile (e.g. preferences)
            if (unsubProfile) {
              unsubProfile();
            }
            unsubProfile = onSnapshot(
              doc(db, 'users', user.uid),
              (docSnap) => {
                if (!isMounted) return;
                if (docSnap.exists()) {
                  const p = {
                    ...docSnap.data(),
                    uid: user.uid,
                  } as User;
                  setUserProfile(p);
                  saveCachedUserProfile(p);
                }
              },
              (err) => {
                console.warn('Profile snapshot notice (offline/permission):', err);
              }
            );
          } catch (err) {
            console.error('Failed to sync user profile:', err);
          }
        } else {
          // If no user found by Firebase Auth, confirm via authStateReady before clearing
          auth.authStateReady().then(() => {
            if (!isMounted) return;
            if (!auth.currentUser) {
              clearCachedAuth();
              setFirebaseUser(null);
              setUserProfile(null);
              setLoading(false);
              if (unsubProfile) {
                unsubProfile();
                unsubProfile = null;
              }
            }
          });
        }
      },
      (error) => {
        console.error('onAuthStateChanged error:', error);
        clearTimeout(safetyTimer);
        if (isMounted && !hasInitialSession) {
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [hasInitialSession]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      if (cred?.user) {
        setFirebaseUser(cred.user);
        const profile = await syncUserProfile(cred.user);
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignInDemo = async (email = 'demo@talika.app') => {
    setLoading(true);
    try {
      const cred = await signInAsDemoUser(email);
      if (cred?.user) {
        setFirebaseUser(cred.user);
        const profile = await syncUserProfile(cred.user);
        setUserProfile(profile);
      }
    } catch (err) {
      console.error('Demo sign-in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setUserProfile(null);
      setFirebaseUser(null);
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrefs = async (prefs: Partial<UserPrefs>) => {
    if (!firebaseUser) return;
    const previousProfile = userProfile;
    // Optimistic UI update
    setUserProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        prefs: {
          ...prev.prefs,
          ...prefs,
        },
      };
    });

    try {
      await updateUserPreferences(firebaseUser.uid, prefs);
    } catch (err) {
      console.error('Failed to update user preferences:', err);
      setUserProfile(previousProfile);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        loading,
        signIn: handleSignIn,
        signInDemo: handleSignInDemo,
        signOut: handleSignOut,
        updatePrefs: handleUpdatePrefs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
