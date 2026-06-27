import type { User } from './types';
import { CONFIG } from './constants';
import { authenticateAction } from '@/app/actions/data';

// ── Authentication ──
// Credentials are verified server-side (scrypt hash compare) via a Server
// Action, so no passwords or hashes ever reach the client bundle.

export async function loginUser(username: string, password: string): Promise<User> {
  const user = await authenticateAction(username, password);
  if (!user) throw new Error('Invalid credentials');
  return user;
}

// Optional shared-link token bypass (read-only dashboard preview).
export async function validateToken(token: string): Promise<boolean> {
  return token === CONFIG.TEAM_TOKEN;
}
