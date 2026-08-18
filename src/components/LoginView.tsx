import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';

export function LoginView() {
  const { signIn } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      await signIn();
    } catch (err) {
      console.error(err);
      setError('Could not sign in with Google. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-text">
      <Card className="w-full max-w-sm flex flex-col items-center text-center p-8 gap-6 border border-surface-border shadow-md">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-accent">
          <Icon name="check" className="w-8 h-8" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Talika</h1>
          <p className="text-sm text-text-muted">
            Fast, minimal, offline-first to-do list with multi-device sync.
          </p>
        </div>

        {error && (
          <div className="w-full p-3 rounded-md bg-danger/10 text-danger text-xs font-medium">
            {error}
          </div>
        )}

        <Button
          onClick={handleSignIn}
          disabled={signingIn}
          variant="primary"
          className="w-full gap-2"
        >
          <Icon name="logIn" />
          <span>{signingIn ? 'Signing in…' : 'Sign in with Google'}</span>
        </Button>
      </Card>
    </div>
  );
}
