-- ============================================================================
-- Project Digital Transformation - rename stage_enum labels.
--   'CapEx'        -> 'Capex'
--   'Tenders Pack' -> 'Tender Spec'
--
-- Data-preserving: ALTER TYPE ... RENAME VALUE renames the label in place, so
-- every existing stage_schedules row follows automatically (no row rewrite).
--
-- Idempotent: each rename only fires when the old label still exists, so the
-- re-run-everything migrate runner is safe. No-op on fresh databases (0003
-- already creates the enum with the new labels) and on re-runs.
-- ============================================================================

do $rename$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'stage_enum' and e.enumlabel = 'CapEx'
  ) then
    alter type stage_enum rename value 'CapEx' to 'Capex';
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'stage_enum' and e.enumlabel = 'Tenders Pack'
  ) then
    alter type stage_enum rename value 'Tenders Pack' to 'Tender Spec';
  end if;
end
$rename$;
