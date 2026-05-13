-- ============================================================================
-- EPMS — Enterprise Project Monitoring System — initial schema (Neon Postgres)
--
-- Authorization is enforced at the application layer (TypeScript role checks).
-- No RLS — Neon doesn't ship auth.uid(); all access goes through Server Actions
-- with the server-only DATABASE_URL.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type role_enum as enum ('ADMIN', 'STAFF');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_enum as enum (
    'Pending','In Progress','Completed','Cancelled','Not Completed','Delayed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type equipment_group_enum as enum (
    'Chassis','Trim','Final','Inspection','General','Pilot'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_enum as enum ('Local','Overseas','TMA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stage_enum as enum (
    'Concept','Design','Fabrication','Installation','Trial','Validation','Completion'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status_enum as enum (
    'Present','Annual Leave','Half-day (AM)','Half-day (PM)','Emergency Leave',
    'Medical Leave','Hospitalization Leave','Training','Business Trip',
    'Unpaid Leave','Compassionate Leave','Holiday Job','Weekend Job'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type holiday_kind_enum as enum ('Public Holiday','Annual Leave Deduction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind_enum as enum (
    'stage_lead_time','stage_delayed','project_delayed','system'
  );
exception when duplicate_object then null; end $$;

-- ─── users ──────────────────────────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  email text,
  role role_enum not null default 'STAFF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── major_projects ─────────────────────────────────────────────────────────
create table if not exists major_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  description text,
  owner_id uuid references users(id) on delete set null,
  status status_enum not null default 'Pending',
  overall_progress numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_major_projects_owner on major_projects(owner_id);

-- ─── sub_projects ───────────────────────────────────────────────────────────
create table if not exists sub_projects (
  id uuid primary key default gen_random_uuid(),
  major_project_id uuid not null references major_projects(id) on delete cascade,
  project_name text not null,
  equipment_group equipment_group_enum not null,
  source source_enum not null,
  category text not null,
  pic_id uuid references users(id) on delete set null,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  progress numeric(5,2) not null default 0,
  status status_enum not null default 'Pending',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sub_projects_major on sub_projects(major_project_id);
create index if not exists idx_sub_projects_pic on sub_projects(pic_id);

-- ─── stage_schedules ────────────────────────────────────────────────────────
create table if not exists stage_schedules (
  id uuid primary key default gen_random_uuid(),
  sub_project_id uuid not null references sub_projects(id) on delete cascade,
  stage_index int not null,
  stage_name stage_enum not null,
  plan_start date,
  plan_end date,
  planned_duration_days int generated always as (
    case when plan_start is not null and plan_end is not null
      then greatest((plan_end - plan_start) + 1, 0)
      else 0 end
  ) stored,
  actual_start date,
  actual_end date,
  actual_duration_days int generated always as (
    case when actual_start is not null and actual_end is not null
      then greatest((actual_end - actual_start) + 1, 0)
      else 0 end
  ) stored,
  status status_enum not null default 'Pending',
  progress numeric(5,2) not null default 0,
  remarks text,
  unique (sub_project_id, stage_index)
);
create index if not exists idx_stage_sub on stage_schedules(sub_project_id);

-- ─── attendance_records ─────────────────────────────────────────────────────
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  status attendance_status_enum not null,
  remarks text,
  recorded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists idx_attendance_user_date on attendance_records(user_id, date);

-- ─── holiday_calendar ───────────────────────────────────────────────────────
create table if not exists holiday_calendar (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  kind holiday_kind_enum not null default 'Public Holiday',
  created_at timestamptz not null default now()
);

-- ─── notifications ──────────────────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind notification_kind_enum not null,
  title text not null,
  body text,
  ref_type text,
  ref_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user_unread on notifications(user_id, is_read);

-- ─── activity_logs ──────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  ref_type text,
  ref_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_user on activity_logs(user_id);
create index if not exists idx_activity_ref on activity_logs(ref_type, ref_id);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

do $$ begin
  create trigger trg_users_updated     before update on users          for each row execute function set_updated_at();
  create trigger trg_majors_updated    before update on major_projects for each row execute function set_updated_at();
  create trigger trg_subs_updated      before update on sub_projects   for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
