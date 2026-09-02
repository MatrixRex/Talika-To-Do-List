import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, AppLogo } from '../ui';
import { Icon } from '../ui/icons';

export function LoginView() {
  const { signIn, signInDemo } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatAuthError = (err: unknown): string => {
    const errorObj = err as { code?: string; message?: string };
    const code = errorObj?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in popup was closed before completing.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Cannot connect to authentication server. If testing locally, ensure Firebase emulator is running (`pnpm dev`).';
    }
    if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
      return 'Invalid Firebase API Key. Please configure `VITE_FIREBASE_API_KEY` in `.env` or run with local emulators (`pnpm dev`).';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).';
    }
    if (errorObj?.message) {
      return errorObj.message;
    }
    return 'Could not sign in with Google. Please try again or use Quick Demo Sign-In.';
  };

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await signIn();
    } catch (err) {
      console.error(err);
      setError(formatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleDemoSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await signInDemo();
    } catch (err) {
      console.error(err);
      setError(formatAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-4 bg-background text-text">
      <Card className="w-full max-w-sm flex flex-col items-center text-center p-8 gap-6 border border-surface-border shadow-md">
        <AppLogo size="xl" className="shadow-md" />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Talika</h1>
          <p className="text-sm text-text-muted">
            Fast, minimal, offline-first to-do list with multi-device sync.
          </p>
        </div>

        {error && (
          <div className="w-full p-3 rounded-md bg-danger/10 text-danger text-xs font-medium text-left">
            {error}
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            variant="primary"
            className="w-full gap-2"
          >
            <Icon name="logIn" />
            <span>{signingIn ? 'Signing in…' : 'Sign in with Google'}</span>
          </Button>

          <Button
            onClick={handleDemoSignIn}
            disabled={signingIn}
            variant="secondary"
            className="w-full gap-2"
          >
            <Icon name="user" />
            <span>{signingIn ? 'Signing in…' : 'Quick Demo Sign-In'}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
