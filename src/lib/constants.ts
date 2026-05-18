export const CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  TEAM_TOKEN: 'toyota2024',
};

// 7 stages per spec
export const STAGES = [
  'Concept',
  'Design',
  'Fabrication',
  'Installation',
  'Trial',
  'Validation',
  'Completion',
] as const;
export type StageName = (typeof STAGES)[number];

// 6 equipment groups - fixed dropdown only
export const EQUIPMENT_GROUPS = [
  'Chassis',
  'Trim',
  'Final',
  'Inspection',
  'General',
  'Pilot',
] as const;
export type EquipmentGroup = (typeof EQUIPMENT_GROUPS)[number];

// 3 sources - fixed dropdown only
export const SOURCES = ['Local', 'Overseas', 'TMA'] as const;
export type SourceType = (typeof SOURCES)[number];

// Project categories (free reference list - admin-extendable later)
export const CATEGORIES = [
  'New Model',
  'Replacement',
  'Upgrade',
  'Kaizen',
  'Safety',
  'Cost-down',
] as const;

// Stage / project status set per spec
export const STATUSES = [
  'Pending',
  'In Progress',
  'Completed',
  'Cancelled',
  'Not Completed',
  'Delayed',
] as const;
export type Status = (typeof STATUSES)[number];

// Wide index signature - legacy callers also pass uppercase keys
export const STATUS_COLORS: Record<string, string> = {
  Pending: '#94A3B8',
  'In Progress': '#2563EB',
  Completed: '#10B981',
  Cancelled: '#6B7280',
  'Not Completed': '#F59E0B',
  Delayed: '#EF4444',
  // legacy uppercase forms (kept until Phase 3 replaces old pages)
  COMPLETED: '#10B981',
  'IN PROGRESS': '#2563EB',
  DELAY: '#EF4444',
  UPCOMING: '#94A3B8',
  'NOT STARTED': '#64748B',
};

// Back-compat alias for components still importing the old name
export const EQUIPMENT_SOURCES = SOURCES;

// Traffic-light bucket
export type Traffic = 'green' | 'yellow' | 'red';
export const TRAFFIC_COLORS: Record<Traffic, string> = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
};

// Attendance options
export const ATTENDANCE_WEEKDAY = [
  'Present',
  'Annual Leave',
  'Half-day (AM)',
  'Half-day (PM)',
  'Emergency Leave',
  'Medical Leave',
  'Hospitalization Leave',
  'Training',
  'Business Trip',
  'Unpaid Leave',
  'Compassionate Leave',
  'Holiday Job',
] as const;
export type AttendanceWeekday = (typeof ATTENDANCE_WEEKDAY)[number];

export const ATTENDANCE_WEEKEND = ['Weekend Job'] as const;
export type AttendanceWeekend = (typeof ATTENDANCE_WEEKEND)[number];

export const ATTENDANCE_COLORS: Record<string, string> = {
  Present: '#D1FAE5',
  'Annual Leave': '#DBEAFE',
  'Half-day (AM)': '#E0E7FF',
  'Half-day (PM)': '#E0E7FF',
  'Emergency Leave': '#FED7AA',
  'Medical Leave': '#FEE2E2',
  'Hospitalization Leave': '#FCA5A5',
  Training: '#EDE9FE',
  'Business Trip': '#CFFAFE',
  'Unpaid Leave': '#F3F4F6',
  'Compassionate Leave': '#FCE7F3',
  'Holiday Job': '#FEF9C3',
  'Weekend Job': '#FEF3C7',
};

// Notification lead-time schedule (days before plan_end)
export const NOTIFICATION_LEAD_DAYS = [14, 7, 3, 2, 1] as const;
