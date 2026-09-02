import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, Button, Input, AppLogo } from '../ui';
import { Icon } from '../ui/icons';

export function LoginView() {
  const { signIn, signInWithEmail, signUpWithEmail, signInDemo } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const formatAuthError = (err: unknown): string => {
    const errorObj = err as { code?: string; message?: string };
    const code = errorObj?.code || '';
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in popup was closed before completing.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Cannot connect to authentication server. If testing locally, ensure Firebase emulator is running (`pnpm dev`) or check your internet connection.';
    }
    if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid') {
      return 'Invalid Firebase API Key. Please add valid Firebase credentials to `.env` or run with local emulators (`pnpm dev`).';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Please sign in instead.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.';
    }
    if (errorObj?.message) {
      return errorObj.message;
    }
    return 'Could not complete sign in. Please try again or use Quick Demo Sign-In.';
  };

  const handleGoogleSignIn = async () => {
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    try {
      setSigningIn(true);
      setError(null);
      if (isRegistering) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
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
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            variant="primary"
            className="w-full gap-2"
          >
            <Icon name="logIn" />
            <span>{signingIn ? 'Signing in…' : 'Sign in with Google'}</span>
          </Button>

          {showEmailForm ? (
            <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3 pt-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={signingIn}
                required
                className="w-full"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={signingIn}
                required
                className="w-full"
              />
              <Button
                type="submit"
                disabled={signingIn}
                variant="secondary"
                className="w-full gap-2"
              >
                <Icon name={isRegistering ? 'plus' : 'logIn'} />
                <span>
                  {signingIn
                    ? 'Processing…'
                    : isRegistering
                    ? 'Create Account'
                    : 'Sign In with Email'}
                </span>
              </Button>
              <div className="flex justify-between items-center text-xs text-text-muted pt-1">
                <button
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)}
                  className="hover:text-text underline"
                >
                  {isRegistering ? 'Have an account? Sign In' : 'Need account? Sign Up'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="hover:text-text"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <Button
              onClick={() => setShowEmailForm(true)}
              disabled={signingIn}
              variant="secondary"
              className="w-full gap-2"
            >
              <Icon name="mail" />
              <span>Sign In with Email</span>
            </Button>
          )}

          <Button
            onClick={handleDemoSignIn}
            disabled={signingIn}
            variant="ghost"
            className="w-full gap-2 text-text-muted hover:text-text text-xs"
          >
            <Icon name="user" />
            <span>{signingIn ? 'Signing in…' : 'Quick Demo Sign-In'}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
