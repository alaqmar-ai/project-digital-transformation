#!/usr/bin/env node
/**
 * EPMS - production handover setup.
 *
 * DESTRUCTIVE: clears all sample project data and replaces every user account
 * with the real handover roster. Run once against the production DB:
 *
 *   npm run db:migrate            # ensure users.password_hash exists
 *   node scripts/setup-handover.mjs --yes
 *
 * Each user's initial password equals their username. Holidays are kept.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadEnvLocal() {
  try {
    const txt = await readFile(resolve(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m || process.env[m[1]]) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch {
    /* ignore */
  }
}
await loadEnvLocal();

if (!process.argv.includes('--yes')) {
  console.error('Refusing to run without --yes (this wipes all project data and users).');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set.');
  process.exit(1);
}

// Must match src/lib/auth.ts exactly.
function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const USERS = [
  { username: 'faris',     name: 'Faris',     role: 'ADMIN' },
  { username: 'hazlami',   name: 'Hazlami',   role: 'ADMIN' },
  { username: 'tahir',     name: 'Tahir',     role: 'ADMIN' },
  { username: 'rohaizi',   name: 'Rohaizi',   role: 'STAFF' },
  { username: 'rama',      name: 'Rama',      role: 'STAFF' },
  { username: 'akram',     name: 'Akram',     role: 'STAFF' },
  { username: 'izwandi',   name: 'Izwandi',   role: 'STAFF' },
  { username: 'hisyam',    name: 'Hisyam',    role: 'STAFF' },
  { username: 'ariff',     name: 'Ariff',     role: 'STAFF' },
  { username: 'saufi',     name: 'Saufi',     role: 'STAFF' },
  { username: 'kevin',     name: 'Kevin',     role: 'STAFF' },
  { username: 'adib',      name: 'Adib',      role: 'STAFF' },
  { username: 'muzhaffar', name: 'Muzhaffar', role: 'STAFF' },
];

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query('begin');

  // Safety: ensure the column exists even if migrate wasn't run.
  await client.query('alter table users add column if not exists password_hash text');

  console.log('→ Clearing sample data…');
  for (const tbl of [
    'stage_checkpoints',
    'daily_todos',
    'notifications',
    'activity_logs',
    'attendance_records',
    'stage_schedules',
    'sub_projects',
    'major_projects',
    'users',
  ]) {
    await client.query(`delete from ${tbl}`);
  }

  console.log(`→ Inserting ${USERS.length} users (password = username)…`);
  for (const u of USERS) {
    await client.query(
      'insert into users (username, name, role, password_hash) values ($1,$2,$3,$4)',
      [u.username, u.name, u.role, hashPassword(u.username)]
    );
  }

  await client.query('commit');
  const admins = USERS.filter((u) => u.role === 'ADMIN').map((u) => u.username).join(', ');
  console.log(`\n✓ Handover setup complete: ${USERS.length} users (admins: ${admins}). All sample projects cleared.`);
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error('\n✗ Failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.end();
}
