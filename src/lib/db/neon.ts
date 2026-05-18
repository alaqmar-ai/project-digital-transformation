import 'server-only';
import { neon } from '@neondatabase/serverless';
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
  StageName,
  AttendanceStatus,
  HolidayKind,
  NotificationKind,
  Role,
} from '@/lib/types';

const url = process.env.DATABASE_URL;
export const neonEnabled = Boolean(url);

// `neon()` is a tagged-template SQL client. Safe - it parameterizes interpolations.
export const sql = neonEnabled ? neon(url!) : null;

export function requireSql() {
  if (!sql) throw new Error('DATABASE_URL is not set');
  return sql;
}

// ─── Row mappers (snake_case → camelCase, typed) ───────────────────────────

type Row = Record<string, unknown>;

function asString(v: unknown): string {
  return v == null ? '' : String(v);
}
function asOptionalString(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}
function asNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}
function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}
function asIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return asString(v);
}
function asDateStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

export function mapUser(r: Row): User {
  return {
    id: asString(r.id),
    username: asString(r.username),
    name: asString(r.name),
    email: asOptionalString(r.email),
    role: asString(r.role) as Role,
    createdAt: asIso(r.created_at),
  };
}

export function mapMajor(r: Row): MajorProject {
  return {
    id: asString(r.id),
    projectName: asString(r.project_name),
    description: asOptionalString(r.description),
    ownerId: asString(r.owner_id),
    status: asString(r.status) as Status,
    overallProgress: asNumber(r.overall_progress),
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
  };
}

export function mapSub(r: Row): SubProject {
  return {
    id: asString(r.id),
    majorProjectId: asString(r.major_project_id),
    projectName: asString(r.project_name),
    equipmentGroup: asString(r.equipment_group) as EquipmentGroup,
    source: asString(r.source) as SourceType,
    category: asString(r.category),
    picId: asString(r.pic_id),
    plannedStart: asDateStr(r.planned_start),
    plannedEnd: asDateStr(r.planned_end),
    actualStart: asDateStr(r.actual_start),
    actualEnd: asDateStr(r.actual_end),
    progress: asNumber(r.progress),
    status: asString(r.status) as Status,
    remarks: asOptionalString(r.remarks),
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
  };
}

export function mapStage(r: Row): StageSchedule {
  return {
    id: asString(r.id),
    subProjectId: asString(r.sub_project_id),
    stageIndex: asNumber(r.stage_index),
    stageName: asString(r.stage_name) as StageName,
    planStart: asDateStr(r.plan_start),
    planEnd: asDateStr(r.plan_end),
    plannedDurationDays: asNumber(r.planned_duration_days),
    actualStart: asDateStr(r.actual_start),
    actualEnd: asDateStr(r.actual_end),
    actualDurationDays: asNumber(r.actual_duration_days),
    status: asString(r.status) as Status,
    progress: asNumber(r.progress),
    remarks: asOptionalString(r.remarks),
  };
}

export function mapAttendance(r: Row): AttendanceRecord {
  return {
    id: asString(r.id),
    userId: asString(r.user_id),
    date: asDateStr(r.date) ?? '',
    status: asString(r.status) as AttendanceStatus,
    remarks: asOptionalString(r.remarks),
    recordedBy: asString(r.recorded_by),
    createdAt: asIso(r.created_at),
  };
}

export function mapHoliday(r: Row): Holiday {
  return {
    id: asString(r.id),
    date: asDateStr(r.date) ?? '',
    name: asString(r.name),
    kind: asString(r.kind) as HolidayKind,
    createdAt: asIso(r.created_at),
  };
}

export function mapNotification(r: Row): NotificationItem {
  return {
    id: asString(r.id),
    userId: asString(r.user_id),
    kind: asString(r.kind) as NotificationKind,
    title: asString(r.title),
    body: asOptionalString(r.body),
    refType: asOptionalString(r.ref_type) as NotificationItem['refType'],
    refId: asOptionalString(r.ref_id),
    isRead: asBool(r.is_read),
    createdAt: asIso(r.created_at),
  };
}

export function mapActivity(r: Row): ActivityLog {
  return {
    id: asString(r.id),
    userId: asString(r.user_id),
    action: asString(r.action),
    refType: asOptionalString(r.ref_type),
    refId: asOptionalString(r.ref_id),
    before: r.before as unknown,
    after: r.after as unknown,
    createdAt: asIso(r.created_at),
  };
}
