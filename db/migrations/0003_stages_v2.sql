-- ============================================================================
-- Project Digital Transformation - Stage model v2: 7 stages -> 11 stages.
--
-- New stage order:
--   1. Concept
--   2. Tender Spec
--   3. Capex
--   4. Design and Drawing
--   5. Fabrication
--   6. Pre Delivery
--   7. Tax Exemption
--   8. Delivery to Site
--   9. Installation
--   10. Trial
--   11. Handover
--
-- Idempotent: if stage_enum already has the v2 shape (the tender-spec stage,
-- under any label it has carried: old 'Tenders Pack' or renamed 'Tender Spec') this
-- migration is a no-op. The first run wipes sub_projects + stage_schedules +
-- major_projects because the old 7-stage shape can't be mapped 1:1.
-- ============================================================================

do $migrate$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'stage_enum' and e.enumlabel in ('Tenders Pack', 'Tender Spec')
  ) then
    raise notice '0003_stages_v2 already applied; skipping';
    return;
  end if;

  truncate table stage_schedules, sub_projects, major_projects restart identity cascade;

  execute 'alter table stage_schedules alter column stage_name type text';
  execute 'drop type stage_enum';
  execute $sql$
    create type stage_enum as enum (
      'Concept',
      'Tender Spec',
      'Capex',
      'Design and Drawing',
      'Fabrication',
      'Pre Delivery',
      'Tax Exemption',
      'Delivery to Site',
      'Installation',
      'Trial',
      'Handover'
    )
  $sql$;
  execute 'alter table stage_schedules alter column stage_name type stage_enum using stage_name::stage_enum';
end
$migrate$;
