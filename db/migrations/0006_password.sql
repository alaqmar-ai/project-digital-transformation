-- Server-side authentication: store a salted scrypt hash per user.
-- Format: "<salt-hex>:<derived-hex>" (see src/lib/auth.ts).
alter table users add column if not exists password_hash text;
