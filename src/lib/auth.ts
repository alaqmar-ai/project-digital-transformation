import 'server-only';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing using Node's built-in scrypt - no external dependency,
 * no plaintext stored. Hash format: "<salt-hex>:<derived-hex>".
 */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(plain, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
