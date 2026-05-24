-- ============================================================================
-- EPMS - personal daily todos. One row per task, scoped to a user.
-- Independent of the assigned-stage schedule; each user (admin or staff)
-- writes their own.
-- ============================================================================

create table if not exists daily_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_daily_todos_user on daily_todos(user_id);

do $$ begin
  create trigger trg_daily_todos_updated
    before update on daily_todos
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
