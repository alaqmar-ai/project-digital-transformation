/**
 * Data adapter - Neon Postgres (via Server Actions) or localStorage fallback.
 *
 * When NEXT_PUBLIC_USE_NEON=true, every call goes through a typed Server Action
 * that holds DATABASE_URL server-side. Otherwise the store persists to
 * localStorage so the demo runs without a database.
 */

import type {
  MajorProject,
  SubProject,
  StageSchedule,
  StageCheckpoint,
  DailyTodo,
  AttendanceRecord,
  Holiday,
  NotificationItem,
  ActivityLog,
  User,
  Status,
  HolidayKind,
  NotificationKind,
} from '@/lib/types';
import { STAGES } from '@/lib/constants';
import * as srv from '@/app/actions/data';

export const useNeon = process.env.NEXT_PUBLIC_USE_NEON?.trim() === 'true';

// ─── localStorage keys (versioned) ─────────────────────────────────────────

const KEY = {
  users: 'epms_users_v2',
  majors: 'epms_majors_v2',
  subs: 'epms_subs_v2',
  stages: 'epms_stages_v2',
  attendance: 'epms_attendance_v2',
  holidays: 'epms_holidays_v2',
  notifications: 'epms_notifications_v2',
  logs: 'epms_logs_v2',
} as const;

function load<T>(k: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(k: string, v: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(k, JSON.stringify(v));
}

function rid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
function nowIso() {
  return new Date().toISOString();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('epms_user_v2');
    if (!raw) return '';
    const u = JSON.parse(raw);
    const id = u?.id ?? '';
    // When Neon is enabled, activity_logs.user_id is a uuid column.
    // Drop legacy demo ids like 'u_admin' so the insert doesn't crash.
    if (useNeon && !UUID_RE.test(id)) return '';
    return id;
  } catch {
    return '';
  }
}

// ─── Users ─────────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  { id: 'u_admin', username: 'admin', name: 'Administrator', role: 'ADMIN', email: 'admin@epms.local' },
  { id: 'u_staff', username: 'staff', name: 'Staff User',    role: 'STAFF', email: 'staff@epms.local' },
  { id: 'u_ahmad', username: 'ahmad', name: 'Ahmad',         role: 'STAFF' },
  { id: 'u_faiz',  username: 'faiz',  name: 'Faiz',          role: 'STAFF' },
  { id: 'u_hidayat', username: 'hidayat', name: 'Hidayat',   role: 'STAFF' },
];

export async function listUsers(): Promise<User[]> {
  if (useNeon) return srv.listUsersAction();
  let users = load<User[]>(KEY.users, []);
  if (users.length === 0) {
    users = SEED_USERS;
    save(KEY.users, users);
  }
  return users;
}

export async function createUser(input: {
  username: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  email?: string;
}): Promise<User> {
  if (useNeon) {
    const u = await srv.createUserAction(input);
    await srv.logActivityAction({ userId: actorId(), action: 'create_user', refType: 'user', refId: u.id, after: u });
    return u;
  }
  const users = load<User[]>(KEY.users, SEED_USERS);
  const u: User = { id: rid('u'), ...input };
  users.push(u);
  save(KEY.users, users);
  return u;
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, 'username' | 'name' | 'role' | 'email'>>
): Promise<User> {
  if (useNeon) {
    const u = await srv.updateUserAction(id, {
      ...patch,
      email: patch.email === undefined ? undefined : (patch.email ?? null),
    });
    await srv.logActivityAction({ userId: actorId(), action: 'update_user', refType: 'user', refId: id, after: u });
    return u;
  }
  const users = load<User[]>(KEY.users, SEED_USERS);
  const i = users.findIndex((u) => u.id === id);
  if (i < 0) throw new Error('User not found');
  users[i] = { ...users[i], ...patch };
  save(KEY.users, users);
  return users[i];
}

export async function deleteUser(id: string): Promise<void> {
  if (useNeon) {
    await srv.deleteUserAction(id);
    await srv.logActivityAction({ userId: actorId(), action: 'delete_user', refType: 'user', refId: id });
    return;
  }
  const users = load<User[]>(KEY.users, SEED_USERS);
  save(KEY.users, users.filter((u) => u.id !== id));
}

// ─── Major projects ────────────────────────────────────────────────────────

export async function listMajorProjects(): Promise<MajorProject[]> {
  if (useNeon) return srv.listMajorProjectsAction();
  return load<MajorProject[]>(KEY.majors, []);
}

export async function createMajorProject(input: {
  projectName: string;
  description?: string;
  ownerId: string;
  status?: Status;
  overallProgress?: number;
}): Promise<MajorProject> {
  if (useNeon) {
    const mp = await srv.createMajorProjectAction({
      projectName: input.projectName,
      description: input.description,
      ownerId: input.ownerId,
      status: input.status,
    });
    await srv.logActivityAction({ userId: actorId(), action: 'create_major_project', refType: 'major_project', refId: mp.id, after: mp });
    return mp;
  }

  const now = nowIso();
  const mp: MajorProject = {
    id: rid('mp'),
    projectName: input.projectName,
    description: input.description,
    ownerId: input.ownerId,
    status: input.status ?? 'Pending',
    overallProgress: input.overallProgress ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = load<MajorProject[]>(KEY.majors, []);
  all.push(mp);
  save(KEY.majors, all);
  logActivityLocal({ userId: actorId(), action: 'create_major_project', refType: 'major_project', refId: mp.id, after: mp });
  return mp;
}

export async function updateMajorProject(id: string, patch: Partial<MajorProject>): Promise<MajorProject> {
  if (useNeon) {
    const mp = await srv.updateMajorProjectAction(id, patch);
    await srv.logActivityAction({ userId: actorId(), action: 'update_major_project', refType: 'major_project', refId: id, after: mp });
    return mp;
  }
  const all = load<MajorProject[]>(KEY.majors, []);
  const i = all.findIndex((m) => m.id === id);
  if (i < 0) throw new Error('Major project not found');
  const before = { ...all[i] };
  all[i] = { ...all[i], ...patch, updatedAt: nowIso() };
  save(KEY.majors, all);
  logActivityLocal({ userId: actorId(), action: 'update_major_project', refType: 'major_project', refId: id, before, after: all[i] });
  return all[i];
}

export async function deleteMajorProject(id: string): Promise<void> {
  if (useNeon) {
    await srv.deleteMajorProjectAction(id);
    await srv.logActivityAction({ userId: actorId(), action: 'delete_major_project', refType: 'major_project', refId: id });
    return;
  }
  save(KEY.majors, load<MajorProject[]>(KEY.majors, []).filter((m) => m.id !== id));
  const subs = load<SubProject[]>(KEY.subs, []);
  const removed = subs.filter((s) => s.majorProjectId === id).map((s) => s.id);
  save(KEY.subs, subs.filter((s) => s.majorProjectId !== id));
  save(KEY.stages, load<StageSchedule[]>(KEY.stages, []).filter((st) => !removed.includes(st.subProjectId)));
  logActivityLocal({ userId: actorId(), action: 'delete_major_project', refType: 'major_project', refId: id });
}

// ─── Sub projects ──────────────────────────────────────────────────────────

export async function listSubProjects(majorProjectId?: string): Promise<SubProject[]> {
  if (useNeon) return srv.listSubProjectsAction(majorProjectId);
  const all = load<SubProject[]>(KEY.subs, []);
  return majorProjectId ? all.filter((s) => s.majorProjectId === majorProjectId) : all;
}

export async function createSubProject(input: {
  majorProjectId: string;
  projectName: string;
  equipmentGroup: SubProject['equipmentGroup'];
  source: SubProject['source'];
  category: string;
  picId: string;
  plannedStart?: string;
  plannedEnd?: string;
  remarks?: string;
}): Promise<SubProject> {
  if (useNeon) {
    const sub = await srv.createSubProjectAction(input);
    await srv.logActivityAction({ userId: actorId(), action: 'create_sub_project', refType: 'sub_project', refId: sub.id, after: sub });
    return sub;
  }

  const now = nowIso();
  const sub: SubProject = {
    id: rid('sp'),
    majorProjectId: input.majorProjectId,
    projectName: input.projectName,
    equipmentGroup: input.equipmentGroup,
    source: input.source,
    category: input.category,
    picId: input.picId,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    progress: 0,
    status: 'Pending',
    remarks: input.remarks,
    createdAt: now,
    updatedAt: now,
  };
  const all = load<SubProject[]>(KEY.subs, []);
  all.push(sub);
  save(KEY.subs, all);

  const stages = load<StageSchedule[]>(KEY.stages, []);
  STAGES.forEach((name, idx) => {
    stages.push({
      id: rid('st'),
      subProjectId: sub.id,
      stageIndex: idx,
      stageName: name,
      plannedDurationDays: 0,
      actualDurationDays: 0,
      status: 'Pending',
      progress: 0,
    });
  });
  save(KEY.stages, stages);
  logActivityLocal({ userId: actorId(), action: 'create_sub_project', refType: 'sub_project', refId: sub.id, after: sub });
  return sub;
}

export async function updateSubProject(id: string, patch: Partial<SubProject>): Promise<SubProject> {
  if (useNeon) {
    const sub = await srv.updateSubProjectAction(id, patch);
    await srv.logActivityAction({ userId: actorId(), action: 'update_sub_project', refType: 'sub_project', refId: id, after: sub });
    return sub;
  }
  const all = load<SubProject[]>(KEY.subs, []);
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) throw new Error('Sub project not found');
  const before = { ...all[i] };
  all[i] = { ...all[i], ...patch, updatedAt: nowIso() };
  save(KEY.subs, all);
  logActivityLocal({ userId: actorId(), action: 'update_sub_project', refType: 'sub_project', refId: id, before, after: all[i] });
  return all[i];
}

export async function deleteSubProject(id: string): Promise<void> {
  if (useNeon) {
    await srv.deleteSubProjectAction(id);
    await srv.logActivityAction({ userId: actorId(), action: 'delete_sub_project', refType: 'sub_project', refId: id });
    return;
  }
  save(KEY.subs, load<SubProject[]>(KEY.subs, []).filter((s) => s.id !== id));
  save(KEY.stages, load<StageSchedule[]>(KEY.stages, []).filter((st) => st.subProjectId !== id));
  logActivityLocal({ userId: actorId(), action: 'delete_sub_project', refType: 'sub_project', refId: id });
}

// ─── Stages ────────────────────────────────────────────────────────────────

export async function listStages(subProjectId: string): Promise<StageSchedule[]> {
  if (useNeon) return srv.listStagesAction(subProjectId);
  return load<StageSchedule[]>(KEY.stages, [])
    .filter((s) => s.subProjectId === subProjectId)
    .sort((a, b) => a.stageIndex - b.stageIndex);
}

/** Batched stage fetch across many sub-projects (single query when Neon-enabled). */
export async function listStagesForSubs(subProjectIds: string[]): Promise<StageSchedule[]> {
  if (subProjectIds.length === 0) return [];
  if (useNeon) return srv.listStagesForSubsAction(subProjectIds);
  const ids = new Set(subProjectIds);
  return load<StageSchedule[]>(KEY.stages, [])
    .filter((s) => ids.has(s.subProjectId))
    .sort((a, b) => a.subProjectId.localeCompare(b.subProjectId) || a.stageIndex - b.stageIndex);
}

export async function updateStage(id: string, patch: Partial<StageSchedule>): Promise<StageSchedule> {
  if (useNeon) {
    const st = await srv.updateStageAction(id, patch);
    await srv.logActivityAction({ userId: actorId(), action: 'update_stage', refType: 'stage', refId: id, after: st });
    return st;
  }
  const all = load<StageSchedule[]>(KEY.stages, []);
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) throw new Error('Stage not found');
  const before = { ...all[i] };
  all[i] = { ...all[i], ...patch };
  save(KEY.stages, all);
  logActivityLocal({ userId: actorId(), action: 'update_stage', refType: 'stage', refId: id, before, after: all[i] });
  return all[i];
}

// ─── Stage checkpoints (todolist per stage) ────────────────────────────────

export async function listCheckpointsForStages(stageIds: string[]): Promise<StageCheckpoint[]> {
  if (stageIds.length === 0) return [];
  if (useNeon) return srv.listCheckpointsForStagesAction(stageIds);
  const ids = new Set(stageIds);
  return load<StageCheckpoint[]>('epms_checkpoints_v2', [])
    .filter((c) => ids.has(c.stageId))
    .sort((a, b) => a.stageId.localeCompare(b.stageId) || a.sortOrder - b.sortOrder);
}

export async function createCheckpoint(input: {
  stageId: string;
  label: string;
  sortOrder?: number;
}): Promise<StageCheckpoint> {
  if (useNeon) return srv.createCheckpointAction(input);
  const now = nowIso();
  const cp: StageCheckpoint = {
    id: rid('cp'),
    stageId: input.stageId,
    label: input.label,
    done: false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = load<StageCheckpoint[]>('epms_checkpoints_v2', []);
  all.push(cp);
  save('epms_checkpoints_v2', all);
  return cp;
}

export async function updateCheckpoint(
  id: string,
  patch: Partial<{ label: string; done: boolean; sortOrder: number }>
): Promise<StageCheckpoint> {
  if (useNeon) return srv.updateCheckpointAction(id, patch);
  const all = load<StageCheckpoint[]>('epms_checkpoints_v2', []);
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('Checkpoint not found');
  all[i] = { ...all[i], ...patch, updatedAt: nowIso() };
  save('epms_checkpoints_v2', all);
  return all[i];
}

export async function deleteCheckpoint(id: string): Promise<void> {
  if (useNeon) return srv.deleteCheckpointAction(id);
  save(
    'epms_checkpoints_v2',
    load<StageCheckpoint[]>('epms_checkpoints_v2', []).filter((c) => c.id !== id)
  );
}

// ─── Daily todos (personal todoist) ────────────────────────────────────────

const DAILY_TODOS_KEY = 'epms_daily_todos_v1';

export async function listDailyTodos(userId: string): Promise<DailyTodo[]> {
  if (useNeon) return srv.listDailyTodosAction(userId);
  return load<DailyTodo[]>(DAILY_TODOS_KEY, [])
    .filter((t) => t.userId === userId)
    .sort((a, b) =>
      Number(a.done) - Number(b.done) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
    );
}

export async function createDailyTodo(input: {
  userId: string;
  label: string;
  dueDate?: string;
  sortOrder?: number;
}): Promise<DailyTodo> {
  if (useNeon) return srv.createDailyTodoAction(input);
  const now = nowIso();
  const t: DailyTodo = {
    id: rid('td'),
    userId: input.userId,
    label: input.label,
    done: false,
    dueDate: input.dueDate,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = load<DailyTodo[]>(DAILY_TODOS_KEY, []);
  all.push(t);
  save(DAILY_TODOS_KEY, all);
  return t;
}

export async function updateDailyTodo(
  id: string,
  patch: Partial<{ label: string; done: boolean; dueDate: string | null; sortOrder: number }>
): Promise<DailyTodo> {
  if (useNeon) return srv.updateDailyTodoAction(id, patch);
  const all = load<DailyTodo[]>(DAILY_TODOS_KEY, []);
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) throw new Error('Todo not found');
  all[i] = {
    ...all[i],
    ...patch,
    dueDate: patch.dueDate === null ? undefined : patch.dueDate ?? all[i].dueDate,
    updatedAt: nowIso(),
  };
  save(DAILY_TODOS_KEY, all);
  return all[i];
}

export async function deleteDailyTodo(id: string): Promise<void> {
  if (useNeon) return srv.deleteDailyTodoAction(id);
  save(DAILY_TODOS_KEY, load<DailyTodo[]>(DAILY_TODOS_KEY, []).filter((t) => t.id !== id));
}

// ─── Attendance ────────────────────────────────────────────────────────────

function monthBounds(month: { year: number; monthIndex: number }) {
  const first = new Date(month.year, month.monthIndex, 1);
  const last = new Date(month.year, month.monthIndex + 1, 0);
  const f = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
  const l = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from: f, to: l };
}

export async function listAttendance(
  month?: { year: number; monthIndex: number },
  userId?: string
): Promise<AttendanceRecord[]> {
  if (useNeon) {
    return srv.listAttendanceAction(month ? monthBounds(month) : undefined, userId);
  }
  let recs = load<AttendanceRecord[]>(KEY.attendance, []);
  if (userId) recs = recs.filter((r) => r.userId === userId);
  if (month) {
    const m = String(month.monthIndex + 1).padStart(2, '0');
    const pref = `${month.year}-${m}`;
    recs = recs.filter((r) => r.date.startsWith(pref));
  }
  return recs;
}

export async function upsertAttendance(rec: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<AttendanceRecord> {
  if (useNeon) {
    return srv.upsertAttendanceAction({
      userId: rec.userId,
      date: rec.date,
      status: rec.status,
      remarks: rec.remarks,
      recordedBy: rec.recordedBy,
    });
  }
  const all = load<AttendanceRecord[]>(KEY.attendance, []);
  const i = all.findIndex((r) => r.userId === rec.userId && r.date === rec.date);
  if (i >= 0) all[i] = { ...all[i], ...rec };
  else all.push({ ...rec, id: rid('att'), createdAt: nowIso() });
  save(KEY.attendance, all);
  return all[i >= 0 ? i : all.length - 1];
}

export async function deleteAttendance(id: string): Promise<void> {
  if (useNeon) return srv.deleteAttendanceAction(id);
  save(KEY.attendance, load<AttendanceRecord[]>(KEY.attendance, []).filter((r) => r.id !== id));
}

// ─── Holidays ──────────────────────────────────────────────────────────────

export async function listHolidays(): Promise<Holiday[]> {
  if (useNeon) return srv.listHolidaysAction();
  return load<Holiday[]>(KEY.holidays, []).sort((a, b) => a.date.localeCompare(b.date));
}

export async function createHoliday(input: { date: string; name: string; kind: HolidayKind }): Promise<Holiday> {
  if (useNeon) return srv.createHolidayAction(input);
  const h: Holiday = { ...input, id: rid('h'), createdAt: nowIso() };
  const all = load<Holiday[]>(KEY.holidays, []);
  const i = all.findIndex((x) => x.date === input.date);
  if (i >= 0) all[i] = h;
  else all.push(h);
  save(KEY.holidays, all);
  return h;
}

export async function deleteHoliday(id: string): Promise<void> {
  if (useNeon) return srv.deleteHolidayAction(id);
  save(KEY.holidays, load<Holiday[]>(KEY.holidays, []).filter((h) => h.id !== id));
}

// ─── Notifications ─────────────────────────────────────────────────────────

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  if (useNeon) return srv.listNotificationsAction(userId);
  return load<NotificationItem[]>(KEY.notifications, [])
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createNotification(n: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  refType?: NotificationItem['refType'];
  refId?: string;
}): Promise<NotificationItem> {
  if (useNeon) {
    return srv.createNotificationAction({
      userId: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      refType: n.refType,
      refId: n.refId,
    });
  }
  const item: NotificationItem = { ...n, id: rid('nt'), isRead: false, createdAt: nowIso() };
  const all = load<NotificationItem[]>(KEY.notifications, []);
  all.push(item);
  save(KEY.notifications, all);
  return item;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (useNeon) return srv.markNotificationReadAction(id);
  const all = load<NotificationItem[]>(KEY.notifications, []);
  const i = all.findIndex((n) => n.id === id);
  if (i >= 0) {
    all[i].isRead = true;
    save(KEY.notifications, all);
  }
}

// ─── Activity log ──────────────────────────────────────────────────────────

function logActivityLocal(entry: Omit<ActivityLog, 'id' | 'createdAt'>) {
  const all = load<ActivityLog[]>(KEY.logs, []);
  all.push({ ...entry, id: rid('log'), createdAt: nowIso() });
  save(KEY.logs, all);
}

export async function logActivity(entry: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<void> {
  if (useNeon) return srv.logActivityAction(entry);
  logActivityLocal(entry);
}

export async function listActivity(limit = 100): Promise<ActivityLog[]> {
  if (useNeon) return srv.listActivityAction(limit);
  return load<ActivityLog[]>(KEY.logs, [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

// ─── Derived helpers (unchanged) ───────────────────────────────────────────

export function statusFor(
  todayIso: string,
  planEnd: string | undefined,
  current: Status
): Status {
  if (current === 'Completed' || current === 'Cancelled') return current;
  if (planEnd && todayIso > planEnd) return 'Delayed';
  return current;
}
