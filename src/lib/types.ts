import type {
  Status,
  EquipmentGroup,
  SourceType,
  StageName,
  AttendanceWeekday,
  AttendanceWeekend,
} from './constants';

export type { Status, EquipmentGroup, SourceType, StageName } from './constants';

// ── Users / RBAC ──

export type Role = 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  email?: string;
  createdAt?: string;
}

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function canEditAttendance(user: User | null | undefined): boolean {
  return isAdmin(user);
}

export function canManageUsers(user: User | null | undefined): boolean {
  return isAdmin(user);
}

export function canManageHolidays(user: User | null | undefined): boolean {
  return isAdmin(user);
}

export function canDeleteProjects(user: User | null | undefined): boolean {
  return isAdmin(user);
}

// ── Project hierarchy ──

export interface MajorProject {
  id: string;
  projectName: string;
  description?: string;
  ownerId: string; // user id
  status: Status;
  overallProgress: number; // 0..100 - auto from sub-projects
  createdAt: string;
  updatedAt: string;
}

export interface SubProject {
  id: string;
  majorProjectId: string;
  projectName: string;
  equipmentGroup: EquipmentGroup;
  source: SourceType;
  category: string;
  picId: string; // user id
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number; // 0..100 - auto from stages
  status: Status;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageSchedule {
  id: string;
  subProjectId: string;
  stageIndex: number;
  stageName: StageName;
  planStart?: string;
  planEnd?: string;
  plannedDurationDays: number; // auto
  actualStart?: string;
  actualEnd?: string;
  actualDurationDays: number; // auto
  status: Status;
  remarks?: string;
  // Optional progress for partial completion
  progress?: number; // 0..100
}

export interface StageCheckpoint {
  id: string;
  stageId: string;
  label: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTodo {
  id: string;
  userId: string;
  label: string;
  done: boolean;
  dueDate?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── Attendance ──

export type AttendanceStatus = AttendanceWeekday | AttendanceWeekend;

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks?: string;
  recordedBy: string; // admin user id
  createdAt: string;
}

export type HolidayKind = 'Public Holiday' | 'Annual Leave Deduction';

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  kind: HolidayKind;
  createdAt: string;
}

// ── Notifications ──

export type NotificationKind =
  | 'stage_lead_time'   // 14/7/3/2/1 day
  | 'stage_delayed'
  | 'project_delayed'
  | 'system';

export interface NotificationItem {
  id: string;
  userId: string;       // recipient
  kind: NotificationKind;
  title: string;
  body?: string;
  refType?: 'major_project' | 'sub_project' | 'stage';
  refId?: string;
  isRead: boolean;
  createdAt: string;
}

// ── Activity log ──

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  refType?: string;
  refId?: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}

// ── Legacy single-table Project (kept temporarily for back-compat) ──

export interface Stage {
  stageIndex: number;
  stageName: string;
  planStart: string;
  planFinish: string;
  actualStart: string;
  actualFinish: string;
  checked: boolean;
}

export interface Project {
  id: string;
  pic: string;
  name: string;
  code: string;
  group: string;
  source: string;
  duration: number;
  stages: Stage[];
  createdAt: string;
  updatedAt: string;
}

export type StageStatus = 'COMPLETED' | 'IN PROGRESS' | 'DELAY' | 'UPCOMING' | 'NOT STARTED';
export type ProjectStatus = 'COMPLETED' | 'IN PROGRESS' | 'DELAY' | 'NOT STARTED';
