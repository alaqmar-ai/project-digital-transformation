'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/types';
import { listUsersAction } from '@/app/actions/data';

const STORAGE_KEY = 'epms_user_v2';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const useNeon = process.env.NEXT_PUBLIC_USE_NEON?.trim() === 'true';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const parsed: User = JSON.parse(stored);
        // Legacy sessions stored demo ids like "u_admin". When Neon is enabled
        // every downstream query expects a real uuid, so resolve once on
        // restore and persist the real id.
        if (useNeon && parsed?.username && !UUID_RE.test(parsed.id)) {
          try {
            const dbUsers = await listUsersAction();
            const match = dbUsers.find(
              (u) => u.username.toLowerCase() === parsed.username.toLowerCase()
            );
            if (match) {
              const resolved: User = {
                id: match.id,
                username: match.username,
                name: match.name,
                role: match.role,
                email: match.email,
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
              if (!cancelled) setUser(resolved);
              return;
            }
          } catch {
            /* fall through to stored user */
          }
        }
        if (!cancelled) setUser(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((userData: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
