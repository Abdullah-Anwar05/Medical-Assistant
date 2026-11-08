import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export function useSignOut() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  async function signOut(): Promise<void> {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return { busy, signOut };
}
