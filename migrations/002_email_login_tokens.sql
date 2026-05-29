create table if not exists email_login_tokens (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_login_tokens_email_created_idx
  on email_login_tokens (email, created_at desc);

create index if not exists email_login_tokens_active_idx
  on email_login_tokens (email, expires_at)
  where used_at is null;
