#!/usr/bin/env node
/**
 * EPMS - migration runner. Applies every db/migrations/*.sql to $DATABASE_URL.
 *
 * Uses `pg` (the original Postgres client) because it supports multi-statement
 * SQL bodies with dollar-quoted blocks in a single round-trip - which Neon's
 * HTTP tagged-template client does not. `pg` is a devDependency, so the
 * application bundle stays unaffected.
 *
 * Usage:  `npm run db:migrate`
 *   (DATABASE_URL is read from process env or from .env.local).
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lightweight .env.local loader (avoids dotenv dep)
async function loadEnvLocal() {
  try {
    const txt = await readFile(resolve(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch {
    /* ignore */
  }
}

await loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('✗ DATABASE_URL is not set. Add it to .env.local or run `vercel env pull .env.local`.');
  process.exit(1);
}

const dir = resolve(__dirname, '..', 'db', 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
if (files.length === 0) {
  console.error('✗ No migration files found in db/migrations/');
  process.exit(1);
}

const host = url.split('@')[1]?.split('/')[0] ?? 'database';
console.log(`→ Running ${files.length} migration${files.length === 1 ? '' : 's'} against ${host}…\n`);

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  for (const file of files) {
    process.stdout.write(`  ${file} `);
    const text = await readFile(join(dir, file), 'utf-8');
    try {
      await client.query('BEGIN');
      await client.query(text);
      await client.query('COMMIT');
      console.log('✓');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.log('✗');
      console.error('\n' + (err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  }
  console.log('\n✓ All migrations applied.');
} finally {
  await client.end();
}
