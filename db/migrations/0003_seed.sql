-- ============================================================================
-- EPMS — Seed data (idempotent). Demo users only — sample projects are
-- generated client-side from src/lib/data/seed.ts on first browser load.
-- ============================================================================

insert into users (username, name, role, email) values
  ('admin',   'Administrator', 'ADMIN', 'admin@epms.local'),
  ('staff',   'Staff User',    'STAFF', 'staff@epms.local'),
  ('ahmad',   'Ahmad',         'STAFF', null),
  ('faiz',    'Faiz',          'STAFF', null),
  ('hidayat', 'Hidayat',       'STAFF', null)
on conflict (username) do nothing;
