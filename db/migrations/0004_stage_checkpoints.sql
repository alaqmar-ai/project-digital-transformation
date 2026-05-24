-- ============================================================================
-- EPMS - per-stage checkpoints (todolist).
-- Each stage_schedule row can have zero-or-more checkpoints; cascade-deleted
-- when the stage is removed.
-- ============================================================================

create table if not exists stage_checkpoints (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references stage_schedules(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_checkpoints_stage on stage_checkpoints(stage_id);

do $$ begin
  create trigger trg_checkpoints_updated
    before update on stage_checkpoints
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
