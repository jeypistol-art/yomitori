-- Webhook endpoints and delivery queue.

create table if not exists webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  url text not null,
  secret text not null,
  event_types jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint webhook_endpoints_org_id_key unique (organization_id, id),
  constraint webhook_endpoints_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint webhook_endpoints_event_types_array_check
    check (jsonb_typeof(event_types) = 'array')
);

create index if not exists webhook_endpoints_org_enabled_idx
  on webhook_endpoints (organization_id, is_enabled)
  where deleted_at is null;

drop trigger if exists trg_webhook_endpoints_updated_at on webhook_endpoints;

create trigger trg_webhook_endpoints_updated_at
before update on webhook_endpoints
for each row execute function ydt_set_updated_at();

create table if not exists webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  endpoint_id uuid not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  response_status integer,
  response_body text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_deliveries_endpoint_fk
    foreign key (organization_id, endpoint_id)
    references webhook_endpoints (organization_id, id)
    on delete cascade,
  constraint webhook_deliveries_endpoint_event_key unique (endpoint_id, event_id),
  constraint webhook_deliveries_status_check
    check (status in ('queued', 'succeeded', 'failed', 'dead')),
  constraint webhook_deliveries_attempt_count_check
    check (attempt_count >= 0 and max_attempts > 0)
);

create index if not exists webhook_deliveries_queue_idx
  on webhook_deliveries (status, next_attempt_at)
  where status in ('queued', 'failed');

create index if not exists webhook_deliveries_org_created_idx
  on webhook_deliveries (organization_id, created_at desc);

create index if not exists webhook_deliveries_endpoint_idx
  on webhook_deliveries (organization_id, endpoint_id, created_at desc);

drop trigger if exists trg_webhook_deliveries_updated_at on webhook_deliveries;

create trigger trg_webhook_deliveries_updated_at
before update on webhook_deliveries
for each row execute function ydt_set_updated_at();
