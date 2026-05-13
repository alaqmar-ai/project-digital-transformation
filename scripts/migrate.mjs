#!/usr/bin/env node
/**
 * EPMS — Neon migration runner.
 *
 * Reads every *.sql file in db/migrations/ (in lexicographic order) and runs
 * it against $DATABASE_URL. Idempotent — each migration is wrapped in a
 * transaction so a partial failure rolls back.
 *
 * Usage:  DATABASE_URL=postgres://... node scripts/migrate.mjs
 *   or:   npm run db:migrate
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if it exists (no need for dotenv since we keep this minimal)
async function loadEnvLocal() {
  try {
    const txt = await readFile(resolve(__dirname, '..', '.env.local'), 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      if (m[1].startsWith('#')) continue;
      if (process.env[m[1]]) continue; // don't overwrite real env
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
  console.error('✗ DATABASE_URL is not set. Run `vercel env pull .env.local` first.');
  process.exit(1);
}

const sql = neon(url);

const dir = resolve(__dirname, '..', 'db', 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error('✗ No migration files found in db/migrations/');
  process.exit(1);
}

console.log(`→ Running ${files.length} migration${files.length === 1 ? '' : 's'} against ${url.split('@')[1]?.split('/')[0] ?? 'database'}…\n`);

for (const file of files) {
  process.stdout.write(`  ${file} `);
  const text = await readFile(join(dir, file), 'utf-8');
  try {
    await sql.transaction((tx) => {
      const statements = splitSqlStatements(text);
      return statements.map((stmt) => tx.unsafe(stmt));
    });
    console.log('✓');
  } catch (err) {
    console.log('✗');
    console.error('\n' + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

console.log('\n✓ All migrations applied.');

// Naive splitter that respects `$$ … $$` dollar-quoted blocks (used heavily
// in the init migration for `do $$ … end $$` enum guards and triggers).
function splitSqlStatements(text) {
  const out = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '$$') {
      inDollar = !inDollar;
      buf += two;
      i++;
      continue;
    }
    const ch = text[i];
    if (ch === ';' && !inDollar) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}
