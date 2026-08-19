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
  updateUserPreferences
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    // Check for redirect sign-in result (mobile browser fallback)
    getRedirectResult(auth)
      .then(async (cred) => {
        if (cred?.user) {
          setFirebaseUser(cred.user);
          const profile = await syncUserProfile(cred.user);
          setUserProfile(profile);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('getRedirectResult notice:', err);
      });

    // Safety fallback: ensure initial loading resolves even on slow/offline connections
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubAuth = onAuthStateChanged(
      auth,
      async (user) => {
        clearTimeout(fallbackTimer);
        setFirebaseUser(user);
        setLoading(false);

        if (user) {
          try {
            const profile = await syncUserProfile(user);
            setUserProfile(profile);

            // Listen to live changes to user profile (e.g. preferences)
            unsubProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
              if (docSnap.exists()) {
                setUserProfile({
                  ...docSnap.data(),
                  uid: user.uid,
                } as User);
              }
            });
          } catch (err) {
            console.error('Failed to load user profile:', err);
          }
        } else {
          setUserProfile(null);
          if (unsubProfile) {
            unsubProfile();
            unsubProfile = null;
          }
        }
      },
      (error) => {
        console.error('onAuthStateChanged error:', error);
        clearTimeout(fallbackTimer);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

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
    await updateUserPreferences(firebaseUser.uid, prefs);
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
