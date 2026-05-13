'use server';

import {
  requireSql,
  mapMajor,
  mapSub,
  mapStage,
  mapAttendance,
  mapHoliday,
  mapNotification,
  mapActivity,
  mapUser,
  neonEnabled,
} from '@/lib/db/neon';
import type {
  MajorProject,
  SubProject,
  StageSchedule,
  AttendanceRecord,
  Holiday,
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

export async function dbAvailableAction(): Promise<boolean> {
  return neonEnabled;
}

// ─── Users ────────────────────────────────────────────────────────────────

export async function listUsersAction(): Promise<User[]> {
  const sql = requireSql();
  const rows = (await sql`select * from users order by name`) as Record<string, unknown>[];
  return rows.map(mapUser);
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
  picId: string;
  plannedStart?: string;
  plannedEnd?: string;
  remarks?: string;
}): Promise<SubProject> {
  const sql = requireSql();
  const rows = (await sql`
    insert into sub_projects
      (major_project_id, project_name, equipment_group, source, category, pic_id,
       planned_start, planned_end, remarks)
    values
      (${input.majorProjectId}, ${input.projectName}, ${input.equipmentGroup},
       ${input.source}, ${input.category}, ${input.picId},
       ${input.plannedStart ?? null}, ${input.plannedEnd ?? null}, ${input.remarks ?? null})
    returning *
  `) as Record<string, unknown>[];
  const sub = mapSub(rows[0]);

  // Auto-seed empty stage rows
  const STAGE_NAMES = ['Concept', 'Design', 'Fabrication', 'Installation', 'Trial', 'Validation', 'Completion'];
  for (let i = 0; i < STAGE_NAMES.length; i++) {
    await sql`
      insert into stage_schedules (sub_project_id, stage_index, stage_name)
      values (${sub.id}, ${i}, ${STAGE_NAMES[i]})
      on conflict do nothing
    `;
  }
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
