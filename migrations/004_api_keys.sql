-- API keys for Enterprise external API access.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint api_keys_org_id_key unique (organization_id, id),
  constraint api_keys_key_hash_key unique (key_hash),
  constraint api_keys_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint api_keys_scopes_array_check
    check (jsonb_typeof(scopes) = 'array')
);

create index if not exists api_keys_org_active_idx
  on api_keys (organization_id, is_enabled)
  where revoked_at is null;

create index if not exists api_keys_org_created_idx
  on api_keys (organization_id, created_at desc);

drop trigger if exists trg_api_keys_updated_at on api_keys;

create trigger trg_api_keys_updated_at
before update on api_keys
for each row execute function ydt_set_updated_at();
