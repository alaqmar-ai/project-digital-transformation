#!/usr/bin/env node
/**
 * Project Digital Transformation - demo data seeder for Neon.
 *
 * Populates major_projects, sub_projects, stage_schedules, attendance_records
 * and holiday_calendar with realistic-looking content. Idempotent - exits
 * early if major_projects already has rows.
 *
 * Usage:  `npm run db:seed`
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  console.error('✗ DATABASE_URL is not set.');
  process.exit(1);
}

const STAGES = [
  'Concept',
  'Tender Spec',
  'Capex',
  'Design and Drawing',
  'Fabrication',
  'Pre Delivery',
  'Tax Exemption',
  'Delivery to Site',
  'Installation',
  'Trial',
  'Handover',
];
const ATTENDANCE_WEEKDAY = [
  'Present', 'Annual Leave', 'Half-day (AM)', 'Half-day (PM)', 'Emergency Leave',
  'Medical Leave', 'Hospitalization Leave', 'Training', 'Business Trip',
  'Unpaid Leave', 'Compassionate Leave', 'Holiday Job', 'Late', 'SAP'
];

function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  // Idempotency guard
  const { rows: mcount } = await client.query('select count(*)::int as n from major_projects');
  if (mcount[0].n > 0) {
    console.log(`→ Already seeded (${mcount[0].n} major projects). Skipping.`);
    process.exit(0);
  }

  console.log('→ Loading user IDs…');
  const { rows: users } = await client.query(
    "select id, username from users where username in ('admin','staff','ahmad','faiz','hidayat')"
  );
  const U = Object.fromEntries(users.map((u) => [u.username, u.id]));
  if (!U.admin) {
    console.error('✗ Demo users missing. Run `npm run db:migrate` first.');
    process.exit(1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Major projects ────────────────────────────────────────────────────
  console.log('→ Inserting major projects…');
  const majorSeeds = [
    { name: 'Toyota Vios',          desc: 'Production line setup and tooling for Toyota Vios sedan.',           owner: U.hidayat, status: 'In Progress', prog: 62, createdOff: -120 },
    { name: 'Toyota Corolla Cross', desc: 'New model introduction line for Toyota Corolla Cross SUV.',          owner: U.ahmad,   status: 'In Progress', prog: 41, createdOff: -90  },
    { name: 'Toyota Hilux',         desc: 'Body-on-frame line upgrade for Toyota Hilux pickup.',                owner: U.faiz,    status: 'Delayed',     prog: 28, createdOff: -70  },
    { name: 'Toyota Camry',         desc: 'Pilot tooling and validation line for Toyota Camry refresh.',        owner: U.admin,   status: 'Pending',     prog: 12, createdOff: -30  },
  ];
  const majorIds = [];
  for (const m of majorSeeds) {
    const { rows } = await client.query(
      `insert into major_projects (project_name, description, owner_id, status, overall_progress, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [m.name, m.desc, m.owner, m.status, m.prog, iso(addDays(today, m.createdOff)), iso(addDays(today, -1))]
    );
    majorIds.push(rows[0].id);
  }

  // ── Sub projects ──────────────────────────────────────────────────────
  console.log('→ Inserting sub-projects…');
  const subSeeds = [
    { name: 'Welding Robot Cell B-2 Upgrade', mi: 0, group: 'Chassis',    source: 'Overseas', cat: 'Replacement', pic: U.ahmad,   ps: -110, pe: -10, prog: 92, status: 'In Progress', rem: 'Awaiting final acceptance from line manager.' },
    { name: 'Body Side Jig Replacement',      mi: 0, group: 'Chassis',    source: 'TMA',      cat: 'Replacement', pic: U.hidayat, ps: -100, pe:   5, prog: 70, status: 'In Progress' },
    { name: 'Underbody Conveyor Refresh',     mi: 0, group: 'Chassis',    source: 'Local',    cat: 'Upgrade',     pic: U.faiz,    ps:  -90, pe:  30, prog: 45, status: 'In Progress' },
    { name: 'Door Fitment Robotic Cell',      mi: 1, group: 'Trim',       source: 'Overseas', cat: 'New Model',   pic: U.ahmad,   ps:  -80, pe:  15, prog: 60, status: 'In Progress' },
    { name: 'Dashboard Assembly Line',        mi: 1, group: 'Final',      source: 'TMA',      cat: 'New Model',   pic: U.staff,   ps:  -70, pe:  40, prog: 35, status: 'In Progress' },
    { name: 'Headlamp Aiming Station',        mi: 1, group: 'Final',      source: 'Local',    cat: 'Upgrade',     pic: U.faiz,    ps:  -60, pe:  -8, prog: 100, status: 'Completed', rem: 'Closed out and signed off by quality.' },
    { name: 'Vision QC Frame Installation',   mi: 2, group: 'Inspection', source: 'Overseas', cat: 'Safety',      pic: U.hidayat, ps:  -60, pe:  -7, prog: 55, status: 'Delayed', rem: 'Customs delay on imported camera rig.' },
    { name: 'Tunnel Lighting Refit',          mi: 2, group: 'Inspection', source: 'Local',    cat: 'Kaizen',      pic: U.ahmad,   ps:  -55, pe:  12, prog: 25, status: 'In Progress' },
    { name: 'Battery Tray Pilot Tooling',     mi: 3, group: 'Pilot',      source: 'Overseas', cat: 'New Model',   pic: U.staff,   ps:  -25, pe:  90, prog: 18, status: 'In Progress' },
    { name: 'EV Motor Assembly Station',      mi: 3, group: 'General',    source: 'TMA',      cat: 'New Model',   pic: U.admin,   ps:  -20, pe: 120, prog:  5, status: 'Pending' },
  ];
  const subIds = [];
  for (const s of subSeeds) {
    const planStart = iso(addDays(today, s.ps));
    const planEnd = iso(addDays(today, s.pe));
    const actualStart = s.prog > 0 ? iso(addDays(today, s.ps + 2)) : null;
    const actualEnd = s.status === 'Completed' ? iso(addDays(today, s.pe - 1)) : null;
    const { rows } = await client.query(
      `insert into sub_projects (major_project_id, project_name, equipment_group, source, category, pic_id,
        planned_start, planned_end, actual_start, actual_end, progress, status, remarks)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [majorIds[s.mi], s.name, s.group, s.source, s.cat, s.pic, planStart, planEnd, actualStart, actualEnd, s.prog, s.status, s.rem ?? null]
    );
    subIds.push({ id: rows[0].id, seed: s });
  }

  // ── Stage schedules ───────────────────────────────────────────────────
  console.log('→ Inserting stage schedules…');
  for (const { id: subId, seed } of subIds) {
    const totalDays = seed.pe - seed.ps;
    const stageDays = Math.max(2, Math.floor(totalDays / STAGES.length));
    for (let i = 0; i < STAGES.length; i++) {
      const ps = seed.ps + i * stageDays;
      const pe = i === STAGES.length - 1 ? seed.pe : ps + stageDays - 1;
      const threshold = ((i + 1) / STAGES.length) * 100;

      let status, progress = 0, actualStart = null, actualEnd = null;
      if (seed.prog >= threshold) {
        status = 'Completed';
        progress = 100;
        actualStart = iso(addDays(today, ps + (i % 2 === 0 ? 1 : -1)));
        actualEnd = iso(addDays(today, pe + (i % 3 === 0 ? -1 : 2)));
      } else if (seed.prog >= threshold - 100 / STAGES.length) {
        const within = ((seed.prog - (threshold - 100 / STAGES.length)) / (100 / STAGES.length)) * 100;
        progress = Math.round(Math.max(0, Math.min(100, within)));
        status = pe < 0 ? 'Delayed' : 'In Progress';
        actualStart = iso(addDays(today, ps + 1));
      } else if (pe < 0) {
        status = 'Delayed';
      } else {
        status = 'Pending';
      }

      await client.query(
        `insert into stage_schedules (sub_project_id, stage_index, stage_name, plan_start, plan_end,
          actual_start, actual_end, status, progress, remarks)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          subId, i, STAGES[i],
          iso(addDays(today, ps)),
          iso(addDays(today, pe)),
          actualStart, actualEnd, status, progress,
          status === 'Delayed' ? 'Tracking with line manager.' : null,
        ]
      );
    }
  }

  // ── Attendance (30 weekdays × 4 users) ───────────────────────────────
  console.log('→ Inserting attendance records…');
  const attendanceUsers = [U.staff, U.ahmad, U.faiz, U.hidayat];
  let attCount = 0;
  for (let off = -30; off <= 0; off++) {
    const d = addDays(today, off);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    for (let uIdx = 0; uIdx < attendanceUsers.length; uIdx++) {
      const r = Math.abs(d.getDate() * 31 + uIdx * 7) % 100;
      let status;
      if (r < 75) status = 'Present';
      else if (r < 82) status = 'Annual Leave';
      else if (r < 86) status = 'Medical Leave';
      else if (r < 90) status = 'Training';
      else if (r < 93) status = 'Half-day (AM)';
      else if (r < 96) status = 'Business Trip';
      else if (r < 98) status = 'Emergency Leave';
      else status = ATTENDANCE_WEEKDAY[r % ATTENDANCE_WEEKDAY.length];
      await client.query(
        `insert into attendance_records (user_id, date, status, recorded_by)
         values ($1, $2, $3, $4) on conflict (user_id, date) do nothing`,
        [attendanceUsers[uIdx], iso(d), status, U.admin]
      );
      attCount++;
    }
  }

  // ── Holidays ─────────────────────────────────────────────────────────
  console.log('→ Inserting holidays…');
  const yr = today.getFullYear();
  for (const [d, n] of [
    [`${yr}-01-01`, "New Year's Day"],
    [`${yr}-05-01`, 'Labour Day'],
    [`${yr}-08-31`, 'National Day'],
    [`${yr}-12-25`, 'Christmas Day'],
  ]) {
    await client.query(
      `insert into holiday_calendar (date, name, kind)
       values ($1, $2, 'Public Holiday') on conflict (date) do nothing`,
      [d, n]
    );
  }

  console.log(`\n✓ Seed complete: 4 majors, ${subSeeds.length} subs, ${subSeeds.length * STAGES.length} stages, ${attCount} attendance, 4 holidays.`);
} finally {
  await client.end();
}
