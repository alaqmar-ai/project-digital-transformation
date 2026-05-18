/**
 * Demo seeder - fills the localStorage store with realistic-looking data
 * the first time the app is opened. Idempotent (keyed by SEED_VERSION).
 *
 * Re-run by bumping SEED_VERSION or clearing localStorage.
 */

import type {
  MajorProject,
  SubProject,
  StageSchedule,
  AttendanceRecord,
  Holiday,
  Status,
  EquipmentGroup,
  SourceType,
} from '@/lib/types';
import { STAGES, ATTENDANCE_WEEKDAY } from '@/lib/constants';

const SEED_VERSION = 'v3-2026-05';
const SEED_KEY = 'epms_seed_version';

const KEY = {
  majors: 'epms_majors_v2',
  subs: 'epms_subs_v2',
  stages: 'epms_stages_v2',
  attendance: 'epms_attendance_v2',
  holidays: 'epms_holidays_v2',
  notifFired: 'epms_notif_fired_v2',
  notifs: 'epms_notifications_v2',
} as const;

function save<T>(k: string, v: T) {
  localStorage.setItem(k, JSON.stringify(v));
}
function load<T>(k: string, fallback: T): T {
  try {
    const r = localStorage.getItem(k);
    return r ? (JSON.parse(r) as T) : fallback;
  } catch {
    return fallback;
  }
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function rid(p: string) { return `${p}_${Math.random().toString(36).slice(2, 10)}`; }

/** Seed dummy data if needed. Safe to call repeatedly. */
export function maybeSeed() {
  if (typeof window === 'undefined') return;
  // When the real DB is enabled, sample data is seeded via SQL migrations.
  if (process.env.NEXT_PUBLIC_USE_NEON === 'true') return;
  if (localStorage.getItem(SEED_KEY) === SEED_VERSION) return;

  // If there is any user-created data, don't overwrite - just bump the version
  // so we don't keep re-checking on every load.
  const hasMajors = load<MajorProject[]>(KEY.majors, []).length > 0;
  if (hasMajors) {
    localStorage.setItem(SEED_KEY, SEED_VERSION);
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // User IDs (match the seeded users in api.ts)
  const U = {
    admin: 'u_admin',
    staff: 'u_staff',
    ahmad: 'u_ahmad',
    faiz: 'u_faiz',
    hidayat: 'u_hidayat',
  };

  // ── Major projects ────────────────────────────────────────────────────────
  const majors: MajorProject[] = [
    {
      id: rid('mp'),
      projectName: 'Chassis Line 4 Retooling',
      description: 'Retool the chassis main line to support new model platform.',
      ownerId: U.hidayat,
      status: 'In Progress',
      overallProgress: 62,
      createdAt: iso(addDays(today, -120)),
      updatedAt: iso(addDays(today, -1)),
    },
    {
      id: rid('mp'),
      projectName: 'Trim & Final Robotics Cell',
      description: 'New robotic cell in Trim & Final for door & dashboard fitment.',
      ownerId: U.ahmad,
      status: 'In Progress',
      overallProgress: 41,
      createdAt: iso(addDays(today, -90)),
      updatedAt: iso(addDays(today, -2)),
    },
    {
      id: rid('mp'),
      projectName: 'Inspection Tunnel Upgrade',
      description: 'Replace legacy inspection tunnel with vision-based QC system.',
      ownerId: U.faiz,
      status: 'Delayed',
      overallProgress: 28,
      createdAt: iso(addDays(today, -70)),
      updatedAt: iso(addDays(today, -3)),
    },
    {
      id: rid('mp'),
      projectName: 'Pilot Line for New EV Model',
      description: 'Build pilot line for upcoming EV model - feasibility + tooling.',
      ownerId: U.admin,
      status: 'Pending',
      overallProgress: 12,
      createdAt: iso(addDays(today, -30)),
      updatedAt: iso(addDays(today, -5)),
    },
  ];

  // ── Sub-projects (varied) ────────────────────────────────────────────────
  type SubSeed = {
    name: string;
    majorIdx: number;
    group: EquipmentGroup;
    source: SourceType;
    category: string;
    picId: string;
    plannedStartOffset: number;
    plannedEndOffset: number;
    progress: number;
    status: Status;
    remarks?: string;
  };

  const subSeeds: SubSeed[] = [
    // Chassis Line 4 Retooling
    { name: 'Welding Robot Cell B-2 Upgrade', majorIdx: 0, group: 'Chassis', source: 'Overseas', category: 'Replacement', picId: U.ahmad, plannedStartOffset: -110, plannedEndOffset: -10, progress: 92, status: 'In Progress', remarks: 'Awaiting final acceptance from line manager.' },
    { name: 'Body Side Jig Replacement', majorIdx: 0, group: 'Chassis', source: 'TMA', category: 'Replacement', picId: U.hidayat, plannedStartOffset: -100, plannedEndOffset: 5, progress: 70, status: 'In Progress' },
    { name: 'Underbody Conveyor Refresh', majorIdx: 0, group: 'Chassis', source: 'Local', category: 'Upgrade', picId: U.faiz, plannedStartOffset: -90, plannedEndOffset: 30, progress: 45, status: 'In Progress' },

    // Trim & Final Robotics Cell
    { name: 'Door Fitment Robotic Cell', majorIdx: 1, group: 'Trim', source: 'Overseas', category: 'New Model', picId: U.ahmad, plannedStartOffset: -80, plannedEndOffset: 15, progress: 60, status: 'In Progress' },
    { name: 'Dashboard Assembly Line', majorIdx: 1, group: 'Final', source: 'TMA', category: 'New Model', picId: U.staff, plannedStartOffset: -70, plannedEndOffset: 40, progress: 35, status: 'In Progress' },
    { name: 'Headlamp Aiming Station', majorIdx: 1, group: 'Final', source: 'Local', category: 'Upgrade', picId: U.faiz, plannedStartOffset: -60, plannedEndOffset: -8, progress: 100, status: 'Completed', remarks: 'Closed out and signed off by quality.' },

    // Inspection Tunnel Upgrade - one delayed
    { name: 'Vision QC Frame Installation', majorIdx: 2, group: 'Inspection', source: 'Overseas', category: 'Safety', picId: U.hidayat, plannedStartOffset: -60, plannedEndOffset: -7, progress: 55, status: 'Delayed', remarks: 'Customs delay on imported camera rig.' },
    { name: 'Tunnel Lighting Refit', majorIdx: 2, group: 'Inspection', source: 'Local', category: 'Kaizen', picId: U.ahmad, plannedStartOffset: -55, plannedEndOffset: 12, progress: 25, status: 'In Progress' },

    // Pilot Line for New EV Model
    { name: 'Battery Tray Pilot Tooling', majorIdx: 3, group: 'Pilot', source: 'Overseas', category: 'New Model', picId: U.staff, plannedStartOffset: -25, plannedEndOffset: 90, progress: 18, status: 'In Progress' },
    { name: 'EV Motor Assembly Station', majorIdx: 3, group: 'General', source: 'TMA', category: 'New Model', picId: U.admin, plannedStartOffset: -20, plannedEndOffset: 120, progress: 5, status: 'Pending' },
  ];

  const subs: SubProject[] = subSeeds.map((s) => {
    const planStart = iso(addDays(today, s.plannedStartOffset));
    const planEnd = iso(addDays(today, s.plannedEndOffset));
    const actualStart = s.progress > 0 ? iso(addDays(today, s.plannedStartOffset + 2)) : undefined;
    const actualEnd = s.status === 'Completed' ? iso(addDays(today, s.plannedEndOffset - 1)) : undefined;
    return {
      id: rid('sp'),
      majorProjectId: majors[s.majorIdx].id,
      projectName: s.name,
      equipmentGroup: s.group,
      source: s.source,
      category: s.category,
      picId: s.picId,
      plannedStart: planStart,
      plannedEnd: planEnd,
      actualStart,
      actualEnd,
      progress: s.progress,
      status: s.status,
      remarks: s.remarks,
      createdAt: iso(addDays(today, s.plannedStartOffset - 5)),
      updatedAt: iso(addDays(today, -2)),
    };
  });

  // ── Stage schedules ──────────────────────────────────────────────────────
  // Distribute 7 stages across the sub-project's plan window.
  const stages: StageSchedule[] = [];
  subs.forEach((sub, subIdx) => {
    const seed = subSeeds[subIdx];
    const totalDays = seed.plannedEndOffset - seed.plannedStartOffset;
    const stageDays = Math.max(2, Math.floor(totalDays / STAGES.length));
    STAGES.forEach((stageName, i) => {
      const planStartOffset = seed.plannedStartOffset + i * stageDays;
      const planEndOffset = i === STAGES.length - 1 ? seed.plannedEndOffset : planStartOffset + stageDays - 1;
      const planStart = iso(addDays(today, planStartOffset));
      const planEnd = iso(addDays(today, planEndOffset));

      // Determine stage status based on overall progress
      const stageThreshold = ((i + 1) / STAGES.length) * 100;
      let status: Status;
      let stageProgress = 0;
      let actualStart: string | undefined;
      let actualEnd: string | undefined;

      if (sub.status === 'Cancelled') {
        status = 'Cancelled';
      } else if (seed.progress >= stageThreshold) {
        status = 'Completed';
        stageProgress = 100;
        actualStart = iso(addDays(today, planStartOffset + (i % 2 === 0 ? 1 : -1)));
        actualEnd = iso(addDays(today, planEndOffset + (i % 3 === 0 ? -1 : 2)));
      } else if (seed.progress >= stageThreshold - 100 / STAGES.length) {
        // In progress stage
        const within = ((seed.progress - (stageThreshold - 100 / STAGES.length)) / (100 / STAGES.length)) * 100;
        stageProgress = Math.round(Math.max(0, Math.min(100, within)));
        status = planEndOffset < 0 ? 'Delayed' : 'In Progress';
        actualStart = iso(addDays(today, planStartOffset + 1));
      } else if (planEndOffset < 0) {
        status = 'Delayed';
        stageProgress = 0;
      } else {
        status = 'Pending';
      }

      stages.push({
        id: rid('st'),
        subProjectId: sub.id,
        stageIndex: i,
        stageName,
        planStart,
        planEnd,
        plannedDurationDays: planEndOffset - planStartOffset + 1,
        actualStart,
        actualEnd,
        actualDurationDays: actualStart && actualEnd ? Math.max(1, Math.round((Date.parse(actualEnd) - Date.parse(actualStart)) / 86400000) + 1) : 0,
        status,
        progress: stageProgress,
        remarks: status === 'Delayed' ? 'Tracking with line manager.' : undefined,
      });
    });
  });

  // Make a few stages due today (for Daily Progress visibility)
  if (stages.length > 5) {
    stages[2].planEnd = iso(today);
    stages[6].planEnd = iso(today);
    stages[2].status = 'In Progress';
    stages[6].status = 'In Progress';
  }

  // ── Attendance (last 30 weekdays for the 4 non-admin users) ──────────────
  const attendance: AttendanceRecord[] = [];
  const attendanceUsers = [U.staff, U.ahmad, U.faiz, U.hidayat];

  for (let dayOffset = -30; dayOffset <= 0; dayOffset++) {
    const d = addDays(today, dayOffset);
    const weekday = d.getDay();
    if (weekday === 0 || weekday === 6) continue; // skip weekends

    attendanceUsers.forEach((uid, userIdx) => {
      // 80% Present, 5% Annual Leave, 4% Medical, 3% Training, etc.
      const r = (Math.abs((d.getDate() * 31 + userIdx * 7)) % 100);
      let status: AttendanceRecord['status'];
      if (r < 75) status = 'Present';
      else if (r < 82) status = 'Annual Leave';
      else if (r < 86) status = 'Medical Leave';
      else if (r < 90) status = 'Training';
      else if (r < 93) status = 'Half-day (AM)';
      else if (r < 96) status = 'Business Trip';
      else if (r < 98) status = 'Emergency Leave';
      else status = ATTENDANCE_WEEKDAY[r % ATTENDANCE_WEEKDAY.length];

      attendance.push({
        id: rid('att'),
        userId: uid,
        date: iso(d),
        status,
        recordedBy: U.admin,
        createdAt: iso(d),
      });
    });
  }

  // ── Holidays ─────────────────────────────────────────────────────────────
  const yr = today.getFullYear();
  const holidays: Holiday[] = [
    { id: rid('h'), date: `${yr}-01-01`, name: "New Year's Day", kind: 'Public Holiday', createdAt: iso(today) },
    { id: rid('h'), date: `${yr}-05-01`, name: 'Labour Day', kind: 'Public Holiday', createdAt: iso(today) },
    { id: rid('h'), date: `${yr}-08-31`, name: 'National Day', kind: 'Public Holiday', createdAt: iso(today) },
    { id: rid('h'), date: `${yr}-12-25`, name: 'Christmas Day', kind: 'Public Holiday', createdAt: iso(today) },
  ];

  // ── Write everything ─────────────────────────────────────────────────────
  save(KEY.majors, majors);
  save(KEY.subs, subs);
  save(KEY.stages, stages);
  save(KEY.attendance, attendance);
  save(KEY.holidays, holidays);
  // Clear notification fired-log so the engine will re-evaluate against the new data
  localStorage.removeItem(KEY.notifFired);
  localStorage.removeItem(KEY.notifs);

  localStorage.setItem(SEED_KEY, SEED_VERSION);
}
