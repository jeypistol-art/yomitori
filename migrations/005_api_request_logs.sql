-- External API request logs for Enterprise auditability.

create table if not exists api_request_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id) on delete cascade,
  api_key_id uuid,
  method text not null,
  path text not null,
  query_string text,
  required_scope text,
  status_code integer not null,
  duration_ms integer not null,
  ip_address text,
  user_agent text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint api_request_logs_api_key_fk
    foreign key (organization_id, api_key_id)
    references api_keys (organization_id, id)
    on delete set null,
  constraint api_request_logs_status_check
    check (status_code >= 100 and status_code <= 599),
  constraint api_request_logs_duration_check
    check (duration_ms >= 0)
);

create index if not exists api_request_logs_org_created_idx
  on api_request_logs (organization_id, created_at desc);

create index if not exists api_request_logs_api_key_created_idx
  on api_request_logs (organization_id, api_key_id, created_at desc);

create index if not exists api_request_logs_status_created_idx
  on api_request_logs (organization_id, status_code, created_at desc);
