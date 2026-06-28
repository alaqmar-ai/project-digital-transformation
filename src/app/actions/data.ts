'use server';

import {
  requireSql,
  mapMajor,
  mapSub,
  mapStage,
  mapCheckpoint,
  mapDailyTodo,
  mapAttendance,
  mapHoliday,
  mapInstallationPeriod,
  mapNotification,
  mapActivity,
  mapUser,
  neonEnabled,
} from '@/lib/db/neon';
import type {
  MajorProject,
  SubProject,
  StageSchedule,
  StageCheckpoint,
  DailyTodo,
  AttendanceRecord,
  Holiday,
  InstallationPeriod,
  NotificationItem,
  ActivityLog,
  User,
  Status,
  EquipmentGroup,
  SourceType,
  AttendanceStatus,
  HolidayKind,
  NotificationKind,
} from '@/lib/types';
import { STAGES } from '@/lib/constants';
import { hashPassword, verifyPassword } from '@/lib/auth';

export async function dbAvailableAction(): Promise<boolean> {
  return neonEnabled;
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function listUsersAction(): Promise<User[]> {
  const sql = requireSql();
  const rows = (await sql`select * from users order by name`) as Record<string, unknown>[];
  return rows.map(mapUser);
}

export async function createUserAction(input: {
  username: string;
  name: string;
  role: 'ADMIN' | 'STAFF';
  email?: string;
}): Promise<User> {
  const sql = requireSql();
  const rows = (await sql`
    insert into users (username, name, role, email, password_hash)
    values (${input.username}, ${input.name}, ${input.role}, ${input.email ?? null}, ${hashPassword(input.username)})
    returning *
  `) as Record<string, unknown>[];
  return mapUser(rows[0]);
}

export async function updateUserAction(
  id: string,
  patch: Partial<{ username: string; name: string; role: 'ADMIN' | 'STAFF'; email: string | null }>
): Promise<User> {
  const sql = requireSql();
  const rows = (await sql`
    update users set
      username = coalesce(${patch.username ?? null}, username),
      name     = coalesce(${patch.name ?? null}, name),
      role     = coalesce(${patch.role ?? null}, role),
      email    = coalesce(${patch.email ?? null}, email)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('User not found');
  return mapUser(rows[0]);
}

export async function deleteUserAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from users where id = ${id}`;
}

export async function authenticateAction(username: string, password: string): Promise<User | null> {
  const sql = requireSql();
  const rows = (await sql`
    select * from users where lower(username) = lower(${username}) limit 1
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row || !verifyPassword(password, (row.password_hash as string | null) ?? null)) return null;
  return mapUser(row);
}

export async function changePasswordAction(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'New password must be at least 4 characters' };
  }
  const sql = requireSql();
  const rows = (await sql`select password_hash from users where id = ${userId} limit 1`) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return { ok: false, error: 'User not found' };
  if (!verifyPassword(currentPassword, (row.password_hash as string | null) ?? null)) {
    return { ok: false, error: 'Current password is incorrect' };
  }
  await sql`update users set password_hash = ${hashPassword(newPassword)}, updated_at = now() where id = ${userId}`;
  return { ok: true };
}

// ─── Major projects ───────────────────────────────────────────────────────

export async function listMajorProjectsAction(): Promise<MajorProject[]> {
  const sql = requireSql();
  const rows = (await sql`select * from major_projects order by created_at desc`) as Record<string, unknown>[];
  return rows.map(mapMajor);
}

export async function createMajorProjectAction(input: {
  projectName: string;
  description?: string;
  ownerId: string;
  status?: Status;
}): Promise<MajorProject> {
  const sql = requireSql();
  const rows = (await sql`
    insert into major_projects (project_name, description, owner_id, status)
    values (${input.projectName}, ${input.description ?? null}, ${input.ownerId}, ${input.status ?? 'Pending'})
    returning *
  `) as Record<string, unknown>[];
  return mapMajor(rows[0]);
}

export async function updateMajorProjectAction(
  id: string,
  patch: Partial<MajorProject>
): Promise<MajorProject> {
  const sql = requireSql();
  const rows = (await sql`
    update major_projects set
      project_name     = coalesce(${patch.projectName ?? null}, project_name),
      description      = coalesce(${patch.description ?? null}, description),
      owner_id         = coalesce(${patch.ownerId ?? null}, owner_id),
      status           = coalesce(${patch.status ?? null}, status),
      overall_progress = coalesce(${patch.overallProgress ?? null}, overall_progress)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('Major project not found');
  return mapMajor(rows[0]);
}

export async function deleteMajorProjectAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from major_projects where id = ${id}`;
}

// ─── Sub projects ─────────────────────────────────────────────────────────

export async function listSubProjectsAction(majorId?: string): Promise<SubProject[]> {
  const sql = requireSql();
  const rows = majorId
    ? ((await sql`select * from sub_projects where major_project_id = ${majorId} order by created_at desc`) as Record<string, unknown>[])
    : ((await sql`select * from sub_projects order by created_at desc`) as Record<string, unknown>[]);
  return rows.map(mapSub);
}

export async function createSubProjectAction(input: {
  majorProjectId: string;
  projectName: string;
  equipmentGroup: EquipmentGroup;
  source: SourceType;
  category: string;
  installation?: string;
  picId: string;
  plannedStart?: string;
  plannedEnd?: string;
  remarks?: string;
}): Promise<SubProject> {
  const sql = requireSql();
  const rows = (await sql`
    insert into sub_projects
      (major_project_id, project_name, equipment_group, source, category, installation, pic_id,
       planned_start, planned_end, remarks)
    values
      (${input.majorProjectId}, ${input.projectName}, ${input.equipmentGroup},
       ${input.source}, ${input.category}, ${input.installation ?? null}, ${input.picId},
       ${input.plannedStart ?? null}, ${input.plannedEnd ?? null}, ${input.remarks ?? null})
    returning *
  `) as Record<string, unknown>[];
  const sub = mapSub(rows[0]);

  await sql`
    insert into stage_schedules (sub_project_id, stage_index, stage_name)
    select ${sub.id}::uuid, idx - 1, name::stage_enum
    from unnest(${[...STAGES]}::text[]) with ordinality as t(name, idx)
    on conflict do nothing
  `;
  return sub;
}

export async function updateSubProjectAction(
  id: string,
  patch: Partial<SubProject>
): Promise<SubProject> {
  const sql = requireSql();
  const rows = (await sql`
    update sub_projects set
      project_name    = coalesce(${patch.projectName ?? null}, project_name),
      equipment_group = coalesce(${(patch.equipmentGroup as string | undefined) ?? null}, equipment_group),
      source          = coalesce(${(patch.source as string | undefined) ?? null}, source),
      category        = coalesce(${patch.category ?? null}, category),
      installation    = coalesce(${patch.installation ?? null}, installation),
      pic_id          = coalesce(${patch.picId ?? null}, pic_id),
      planned_start   = coalesce(${patch.plannedStart ?? null}, planned_start),
      planned_end     = coalesce(${patch.plannedEnd ?? null}, planned_end),
      actual_start    = coalesce(${patch.actualStart ?? null}, actual_start),
      actual_end      = coalesce(${patch.actualEnd ?? null}, actual_end),
      progress        = coalesce(${patch.progress ?? null}, progress),
      status          = coalesce(${(patch.status as string | undefined) ?? null}, status),
      remarks         = coalesce(${patch.remarks ?? null}, remarks)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('Sub project not found');
  return mapSub(rows[0]);
}

export async function deleteSubProjectAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from sub_projects where id = ${id}`;
}

// ─── Stages ───────────────────────────────────────────────────────────────

export async function listStagesAction(subProjectId: string): Promise<StageSchedule[]> {
  const sql = requireSql();
  const rows = (await sql`
    select * from stage_schedules
    where sub_project_id = ${subProjectId}
    order by stage_index
  `) as Record<string, unknown>[];
  return rows.map(mapStage);
}

/** Single-query fetch for stages across many sub-projects (collapses N+1 patterns). */
export async function listStagesForSubsAction(subProjectIds: string[]): Promise<StageSchedule[]> {
  if (subProjectIds.length === 0) return [];
  const sql = requireSql();
  const rows = (await sql`
    select * from stage_schedules
    where sub_project_id = any(${subProjectIds}::uuid[])
    order by sub_project_id, stage_index
  `) as Record<string, unknown>[];
  return rows.map(mapStage);
}

export async function updateStageAction(
  id: string,
  patch: Partial<StageSchedule>
): Promise<StageSchedule> {
  const sql = requireSql();
  const rows = (await sql`
    update stage_schedules set
      plan_start   = coalesce(${patch.planStart ?? null}, plan_start),
      plan_end     = coalesce(${patch.planEnd ?? null}, plan_end),
      actual_start = coalesce(${patch.actualStart ?? null}, actual_start),
      actual_end   = coalesce(${patch.actualEnd ?? null}, actual_end),
      status       = coalesce(${(patch.status as string | undefined) ?? null}, status),
      progress     = coalesce(${patch.progress ?? null}, progress),
      remarks      = coalesce(${patch.remarks ?? null}, remarks)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('Stage not found');
  return mapStage(rows[0]);
}

// ─── Stage checkpoints (todolist per stage) ───────────────────────────────

export async function listCheckpointsForStagesAction(stageIds: string[]): Promise<StageCheckpoint[]> {
  if (stageIds.length === 0) return [];
  const sql = requireSql();
  const rows = (await sql`
    select * from stage_checkpoints
    where stage_id = any(${stageIds}::uuid[])
    order by stage_id, sort_order, created_at
  `) as Record<string, unknown>[];
  return rows.map(mapCheckpoint);
}

export async function createCheckpointAction(input: {
  stageId: string;
  label: string;
  sortOrder?: number;
}): Promise<StageCheckpoint> {
  const sql = requireSql();
  const rows = (await sql`
    insert into stage_checkpoints (stage_id, label, sort_order)
    values (${input.stageId}, ${input.label}, ${input.sortOrder ?? 0})
    returning *
  `) as Record<string, unknown>[];
  return mapCheckpoint(rows[0]);
}

export async function updateCheckpointAction(
  id: string,
  patch: Partial<{ label: string; done: boolean; sortOrder: number }>
): Promise<StageCheckpoint> {
  const sql = requireSql();
  const rows = (await sql`
    update stage_checkpoints set
      label      = coalesce(${patch.label ?? null}, label),
      done       = coalesce(${patch.done ?? null}, done),
      sort_order = coalesce(${patch.sortOrder ?? null}, sort_order)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('Checkpoint not found');
  return mapCheckpoint(rows[0]);
}

export async function deleteCheckpointAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from stage_checkpoints where id = ${id}`;
}

// ─── Daily todos (personal, per-user) ─────────────────────────────────────

export async function listDailyTodosAction(userId: string): Promise<DailyTodo[]> {
  const sql = requireSql();
  const rows = (await sql`
    select * from daily_todos
    where user_id = ${userId}
    order by done, sort_order, created_at
  `) as Record<string, unknown>[];
  return rows.map(mapDailyTodo);
}

export async function createDailyTodoAction(input: {
  userId: string;
  label: string;
  dueDate?: string;
  sortOrder?: number;
}): Promise<DailyTodo> {
  const sql = requireSql();
  const rows = (await sql`
    insert into daily_todos (user_id, label, due_date, sort_order)
    values (${input.userId}, ${input.label}, ${input.dueDate ?? null}, ${input.sortOrder ?? 0})
    returning *
  `) as Record<string, unknown>[];
  return mapDailyTodo(rows[0]);
}

export async function updateDailyTodoAction(
  id: string,
  patch: Partial<{ label: string; done: boolean; dueDate: string | null; sortOrder: number }>
): Promise<DailyTodo> {
  const sql = requireSql();
  const rows = (await sql`
    update daily_todos set
      label      = coalesce(${patch.label ?? null}, label),
      done       = coalesce(${patch.done ?? null}, done),
      due_date   = coalesce(${patch.dueDate ?? null}, due_date),
      sort_order = coalesce(${patch.sortOrder ?? null}, sort_order)
    where id = ${id}
    returning *
  `) as Record<string, unknown>[];
  if (!rows[0]) throw new Error('Todo not found');
  return mapDailyTodo(rows[0]);
}

export async function deleteDailyTodoAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from daily_todos where id = ${id}`;
}

// ─── Attendance ───────────────────────────────────────────────────────────

export async function listAttendanceAction(
  range?: { from: string; to: string },
  userId?: string
): Promise<AttendanceRecord[]> {
  const sql = requireSql();
  const rows = (await (async () => {
    if (range && userId) {
      return sql`select * from attendance_records where user_id = ${userId} and date between ${range.from} and ${range.to}`;
    }
    if (range) {
      return sql`select * from attendance_records where date between ${range.from} and ${range.to}`;
    }
    if (userId) {
      return sql`select * from attendance_records where user_id = ${userId}`;
    }
    return sql`select * from attendance_records`;
  })()) as Record<string, unknown>[];
  return rows.map(mapAttendance);
}

export async function upsertAttendanceAction(input: {
  userId: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  recordedBy: string;
}): Promise<AttendanceRecord> {
  const sql = requireSql();
  const rows = (await sql`
    insert into attendance_records (user_id, date, status, remarks, recorded_by)
    values (${input.userId}, ${input.date}, ${input.status}, ${input.remarks ?? null}, ${input.recordedBy})
    on conflict (user_id, date) do update set
      status = excluded.status,
      remarks = excluded.remarks,
      recorded_by = excluded.recorded_by
    returning *
  `) as Record<string, unknown>[];
  return mapAttendance(rows[0]);
}

export async function deleteAttendanceAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from attendance_records where id = ${id}`;
}

// ─── Holidays ─────────────────────────────────────────────────────────────

export async function listHolidaysAction(): Promise<Holiday[]> {
  const sql = requireSql();
  const rows = (await sql`select * from holiday_calendar order by date`) as Record<string, unknown>[];
  return rows.map(mapHoliday);
}

export async function createHolidayAction(input: {
  date: string;
  name: string;
  kind: HolidayKind;
}): Promise<Holiday> {
  const sql = requireSql();
  const rows = (await sql`
    insert into holiday_calendar (date, name, kind)
    values (${input.date}, ${input.name}, ${input.kind})
    on conflict (date) do update set name = excluded.name, kind = excluded.kind
    returning *
  `) as Record<string, unknown>[];
  return mapHoliday(rows[0]);
}

export async function deleteHolidayAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from holiday_calendar where id = ${id}`;
}

// ─── Installation periods ──────────────────────────────────────────────────

export async function listInstallationPeriodsAction(): Promise<InstallationPeriod[]> {
  const sql = requireSql();
  const rows = (await sql`select * from installation_periods order by position, label`) as Record<string, unknown>[];
  return rows.map(mapInstallationPeriod);
}

export async function createInstallationPeriodAction(label: string): Promise<InstallationPeriod> {
  const sql = requireSql();
  const rows = (await sql`
    insert into installation_periods (label, position)
    values (${label}, coalesce((select max(position) + 1 from installation_periods), 1))
    on conflict (label) do update set label = excluded.label
    returning *
  `) as Record<string, unknown>[];
  return mapInstallationPeriod(rows[0]);
}

export async function deleteInstallationPeriodAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`delete from installation_periods where id = ${id}`;
}

// ─── Notifications ────────────────────────────────────────────────────────

export async function listNotificationsAction(userId: string): Promise<NotificationItem[]> {
  const sql = requireSql();
  const rows = (await sql`
    select * from notifications where user_id = ${userId} order by created_at desc limit 100
  `) as Record<string, unknown>[];
  return rows.map(mapNotification);
}

export async function createNotificationAction(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
}): Promise<NotificationItem> {
  const sql = requireSql();
  const rows = (await sql`
    insert into notifications (user_id, kind, title, body, ref_type, ref_id)
    values (${input.userId}, ${input.kind}, ${input.title}, ${input.body ?? null},
            ${input.refType ?? null}, ${input.refId ?? null})
    returning *
  `) as Record<string, unknown>[];
  return mapNotification(rows[0]);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const sql = requireSql();
  await sql`update notifications set is_read = true where id = ${id}`;
}

// ─── Activity log ─────────────────────────────────────────────────────────

export async function logActivityAction(input: {
  userId: string;
  action: string;
  refType?: string;
  refId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const sql = requireSql();
  await sql`
    insert into activity_logs (user_id, action, ref_type, ref_id, before, after)
    values (${input.userId || null}, ${input.action}, ${input.refType ?? null},
            ${input.refId ?? null}, ${JSON.stringify(input.before ?? null)}::jsonb,
            ${JSON.stringify(input.after ?? null)}::jsonb)
  `;
}

export async function listActivityAction(limit = 100): Promise<ActivityLog[]> {
  const sql = requireSql();
  const rows = (await sql`
    select * from activity_logs order by created_at desc limit ${limit}
  `) as Record<string, unknown>[];
  return rows.map(mapActivity);
}
