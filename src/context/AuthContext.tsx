import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  signInWithGoogle,
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

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
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
      setLoading(false);
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in error:', err);
      setLoading(false);
      throw err;
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
