-- YOMITORI DocuTask Neon PostgreSQL DDL
-- Target: MVP baseline schema
-- Note: Run on a fresh Neon database. Application code must still enforce organization scope.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type ydt_plan_code as enum (
  'personal',
  'business',
  'pro',
  'enterprise'
);

create type ydt_member_role as enum (
  'owner',
  'admin',
  'member',
  'viewer'
);

create type ydt_asset_type as enum (
  'property',
  'facility',
  'store',
  'tenant',
  'office',
  'other'
);

create type ydt_counterparty_type as enum (
  'municipality',
  'tenant',
  'owner',
  'vendor',
  'insurer',
  'leasing_company',
  'maintenance_company',
  'other'
);

create type ydt_document_source_type as enum (
  'pdf',
  'image',
  'text',
  'email_paste'
);

create type ydt_document_type as enum (
  'municipal_notice',
  'contract_renewal',
  'lease_renewal',
  'insurance_renewal',
  'tenant_contract_renewal',
  'legal_change_notice',
  'inspection_report',
  'other',
  'unknown'
);

create type ydt_document_status as enum (
  'draft',
  'uploaded',
  'processing',
  'needs_review',
  'approved',
  'action_required',
  'completed',
  'archived',
  'failed'
);

create type ydt_file_role as enum (
  'original',
  'processed',
  'preview'
);

create type ydt_processing_job_type as enum (
  'ocr',
  'ai_extract',
  'calendar_sync'
);

create type ydt_processing_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled'
);

create type ydt_extraction_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'superseded'
);

create type ydt_extracted_item_type as enum (
  'summary',
  'due_date',
  'required_action',
  'required_document',
  'amount',
  'counterparty',
  'contact',
  'risk',
  'task',
  'reminder',
  'contract_period',
  'cancellation_deadline',
  'other'
);

create type ydt_task_status as enum (
  'todo',
  'in_progress',
  'waiting_review',
  'done',
  'unnecessary',
  'canceled'
);

create type ydt_task_priority as enum (
  'low',
  'normal',
  'high',
  'urgent'
);

create type ydt_reminder_status as enum (
  'scheduled',
  'sent',
  'canceled',
  'failed'
);

create type ydt_notification_channel as enum (
  'in_app',
  'email',
  'google_calendar'
);

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------

create or replace function ydt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core identity / organization
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_code ydt_plan_code not null default 'personal',
  billing_email text,
  stripe_customer_id text,
  default_timezone text not null default 'Asia/Tokyo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index organizations_stripe_customer_id_key
  on organizations (stripe_customer_id)
  where stripe_customer_id is not null;

create trigger trg_organizations_updated_at
before update on organizations
for each row execute function ydt_set_updated_at();

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  name text,
  avatar_url text,
  auth_provider text not null default 'google',
  auth_provider_subject text not null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_key unique (email),
  constraint users_provider_subject_key unique (auth_provider, auth_provider_subject)
);

create trigger trg_users_updated_at
before update on users
for each row execute function ydt_set_updated_at();

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  role ydt_member_role not null default 'member',
  invited_by uuid references users (id) on delete no action,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_members_org_user_key unique (organization_id, user_id),
  constraint organization_members_org_id_key unique (organization_id, id)
);

create index organization_members_org_role_idx
  on organization_members (organization_id, role)
  where deleted_at is null;

create trigger trg_organization_members_updated_at
before update on organization_members
for each row execute function ydt_set_updated_at();

create table member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email citext not null,
  role ydt_member_role not null default 'member',
  token_hash text not null,
  invited_by uuid not null references users (id) on delete no action,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint member_invitations_token_hash_key unique (token_hash)
);

create index member_invitations_org_email_idx
  on member_invitations (organization_id, email);

-- ---------------------------------------------------------------------------
-- Management domain
-- ---------------------------------------------------------------------------

create table managed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  parent_id uuid,
  asset_type ydt_asset_type not null default 'facility',
  name text not null,
  code text,
  address text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint managed_assets_org_id_key unique (organization_id, id),
  constraint managed_assets_parent_fk
    foreign key (organization_id, parent_id)
    references managed_assets (organization_id, id)
    on delete no action
);

create index managed_assets_org_type_idx
  on managed_assets (organization_id, asset_type)
  where deleted_at is null;

create index managed_assets_org_name_idx
  on managed_assets (organization_id, name)
  where deleted_at is null;

create unique index managed_assets_org_code_key
  on managed_assets (organization_id, code)
  where code is not null and deleted_at is null;

create trigger trg_managed_assets_updated_at
before update on managed_assets
for each row execute function ydt_set_updated_at();

create table counterparties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  counterparty_type ydt_counterparty_type not null default 'other',
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint counterparties_org_id_key unique (organization_id, id)
);

create index counterparties_org_type_idx
  on counterparties (organization_id, counterparty_type)
  where deleted_at is null;

create index counterparties_org_name_idx
  on counterparties (organization_id, name)
  where deleted_at is null;

create trigger trg_counterparties_updated_at
before update on counterparties
for each row execute function ydt_set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  created_by_member_id uuid not null,
  counterparty_id uuid,
  title text not null,
  suggested_title text,
  document_type ydt_document_type not null default 'unknown',
  source_type ydt_document_source_type not null,
  status ydt_document_status not null default 'draft',
  source_text text,
  document_date date,
  due_date date,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  required_actions jsonb not null default '[]'::jsonb,
  required_documents jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  approved_by_member_id uuid,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint documents_org_id_key unique (organization_id, id),
  constraint documents_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint documents_approved_by_member_fk
    foreign key (organization_id, approved_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint documents_counterparty_fk
    foreign key (organization_id, counterparty_id)
    references counterparties (organization_id, id)
    on delete no action
);

create index documents_org_status_idx
  on documents (organization_id, status)
  where deleted_at is null;

create index documents_org_type_idx
  on documents (organization_id, document_type)
  where deleted_at is null;

create index documents_org_due_date_idx
  on documents (organization_id, due_date)
  where deleted_at is null;

create index documents_org_counterparty_idx
  on documents (organization_id, counterparty_id)
  where counterparty_id is not null and deleted_at is null;

create index documents_org_created_at_idx
  on documents (organization_id, created_at desc)
  where deleted_at is null;

create trigger trg_documents_updated_at
before update on documents
for each row execute function ydt_set_updated_at();

create table document_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  managed_asset_id uuid not null,
  created_at timestamptz not null default now(),
  constraint document_assets_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint document_assets_asset_fk
    foreign key (organization_id, managed_asset_id)
    references managed_assets (organization_id, id)
    on delete cascade,
  constraint document_assets_document_asset_key unique (document_id, managed_asset_id)
);

create index document_assets_asset_idx
  on document_assets (organization_id, managed_asset_id);

create table document_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  file_role ydt_file_role not null default 'original',
  original_filename text,
  mime_type text not null,
  storage_key text not null,
  size_bytes bigint,
  page_count integer,
  sha256 text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint document_files_org_id_key unique (organization_id, id),
  constraint document_files_storage_key_key unique (storage_key),
  constraint document_files_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint document_files_size_check check (size_bytes is null or size_bytes >= 0),
  constraint document_files_page_count_check check (page_count is null or page_count >= 0)
);

create index document_files_org_document_idx
  on document_files (organization_id, document_id)
  where deleted_at is null;

create index document_files_sha256_idx
  on document_files (sha256)
  where sha256 is not null;

create table document_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_file_id uuid not null,
  document_id uuid not null,
  page_number integer not null,
  preview_storage_key text,
  width integer,
  height integer,
  rotation_degrees integer,
  ocr_text text,
  ocr_confidence numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_pages_file_fk
    foreign key (organization_id, document_file_id)
    references document_files (organization_id, id)
    on delete cascade,
  constraint document_pages_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint document_pages_file_page_key unique (document_file_id, page_number),
  constraint document_pages_page_number_check check (page_number > 0),
  constraint document_pages_ocr_confidence_check check (
    ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)
  )
);

create index document_pages_document_page_idx
  on document_pages (organization_id, document_id, page_number);

create trigger trg_document_pages_updated_at
before update on document_pages
for each row execute function ydt_set_updated_at();

-- ---------------------------------------------------------------------------
-- Processing / AI extraction
-- ---------------------------------------------------------------------------

create table processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  job_type ydt_processing_job_type not null,
  status ydt_processing_job_status not null default 'queued',
  attempt_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_jobs_org_id_key unique (organization_id, id),
  constraint processing_jobs_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint processing_jobs_attempt_count_check check (attempt_count >= 0)
);

create index processing_jobs_status_created_idx
  on processing_jobs (status, created_at);

create index processing_jobs_org_document_idx
  on processing_jobs (organization_id, document_id);

create trigger trg_processing_jobs_updated_at
before update on processing_jobs
for each row execute function ydt_set_updated_at();

create table ai_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  status ydt_extraction_status not null default 'pending',
  model text not null,
  prompt_version text not null,
  schema_version text not null default '1.0',
  input_text_hash text,
  raw_output jsonb,
  normalized_output jsonb,
  overall_confidence numeric(5,4),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_extractions_org_id_key unique (organization_id, id),
  constraint ai_extractions_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint ai_extractions_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint ai_extractions_confidence_check check (
    overall_confidence is null or (overall_confidence >= 0 and overall_confidence <= 1)
  )
);

create index ai_extractions_org_document_idx
  on ai_extractions (organization_id, document_id, created_at desc);

create index ai_extractions_status_idx
  on ai_extractions (organization_id, status);

create table extracted_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  extraction_id uuid not null,
  document_id uuid not null,
  item_type ydt_extracted_item_type not null,
  label text not null,
  value_text text,
  value_date date,
  value_amount numeric(14,2),
  value_json jsonb,
  confidence numeric(5,4),
  source_text text,
  page_number integer,
  bounding_box jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  user_edited boolean not null default false,
  accepted boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extracted_items_org_id_key unique (organization_id, id),
  constraint extracted_items_extraction_fk
    foreign key (organization_id, extraction_id)
    references ai_extractions (organization_id, id)
    on delete cascade,
  constraint extracted_items_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint extracted_items_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index extracted_items_document_type_idx
  on extracted_items (organization_id, document_id, item_type);

create index extracted_items_extraction_idx
  on extracted_items (organization_id, extraction_id);

create trigger trg_extracted_items_updated_at
before update on extracted_items
for each row execute function ydt_set_updated_at();

create table review_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  edited_by_member_id uuid not null,
  draft_json jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_drafts_org_id_key unique (organization_id, id),
  constraint review_drafts_document_key unique (document_id),
  constraint review_drafts_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint review_drafts_edited_by_member_fk
    foreign key (organization_id, edited_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint review_drafts_version_check check (version > 0)
);

create trigger trg_review_drafts_updated_at
before update on review_drafts
for each row execute function ydt_set_updated_at();

create table document_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null,
  extraction_id uuid,
  approved_by_member_id uuid not null,
  approval_status text not null,
  comment text,
  approved_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint document_approvals_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete cascade,
  constraint document_approvals_extraction_fk
    foreign key (organization_id, extraction_id)
    references ai_extractions (organization_id, id)
    on delete no action,
  constraint document_approvals_member_fk
    foreign key (organization_id, approved_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint document_approvals_status_check check (approval_status in ('approved', 'rejected'))
);

create index document_approvals_org_document_idx
  on document_approvals (organization_id, document_id, created_at desc);

create index document_approvals_member_idx
  on document_approvals (organization_id, approved_by_member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Tasks / reminders / notifications
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id uuid,
  source_extracted_item_id uuid,
  title text not null,
  description text,
  assignee_member_id uuid,
  created_by_member_id uuid not null,
  due_date date,
  priority ydt_task_priority not null default 'normal',
  status ydt_task_status not null default 'todo',
  completed_at timestamptz,
  completed_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tasks_org_id_key unique (organization_id, id),
  constraint tasks_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete no action,
  constraint tasks_source_extracted_item_fk
    foreign key (organization_id, source_extracted_item_id)
    references extracted_items (organization_id, id)
    on delete no action,
  constraint tasks_assignee_member_fk
    foreign key (organization_id, assignee_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint tasks_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint tasks_completed_by_member_fk
    foreign key (organization_id, completed_by_member_id)
    references organization_members (organization_id, id)
    on delete no action
);

create index tasks_org_status_idx
  on tasks (organization_id, status)
  where deleted_at is null;

create index tasks_org_due_date_idx
  on tasks (organization_id, due_date)
  where deleted_at is null;

create index tasks_org_assignee_idx
  on tasks (organization_id, assignee_member_id)
  where deleted_at is null;

create index tasks_document_idx
  on tasks (organization_id, document_id)
  where document_id is not null and deleted_at is null;

create trigger trg_tasks_updated_at
before update on tasks
for each row execute function ydt_set_updated_at();

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  task_id uuid not null,
  member_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint task_comments_task_fk
    foreign key (organization_id, task_id)
    references tasks (organization_id, id)
    on delete cascade,
  constraint task_comments_member_fk
    foreign key (organization_id, member_id)
    references organization_members (organization_id, id)
    on delete no action
);

create index task_comments_task_created_idx
  on task_comments (organization_id, task_id, created_at);

create trigger trg_task_comments_updated_at
before update on task_comments
for each row execute function ydt_set_updated_at();

create table reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  task_id uuid not null,
  recipient_member_id uuid not null,
  channel ydt_notification_channel not null default 'in_app',
  remind_at timestamptz not null,
  status ydt_reminder_status not null default 'scheduled',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminders_org_id_key unique (organization_id, id),
  constraint reminders_task_fk
    foreign key (organization_id, task_id)
    references tasks (organization_id, id)
    on delete cascade,
  constraint reminders_recipient_member_fk
    foreign key (organization_id, recipient_member_id)
    references organization_members (organization_id, id)
    on delete cascade
);

create index reminders_status_remind_at_idx
  on reminders (status, remind_at);

create index reminders_org_task_idx
  on reminders (organization_id, task_id);

create index reminders_recipient_remind_at_idx
  on reminders (organization_id, recipient_member_id, remind_at);

create trigger trg_reminders_updated_at
before update on reminders
for each row execute function ydt_set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  recipient_member_id uuid not null,
  notification_type text not null,
  title text not null,
  body text,
  target_type text,
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_member_fk
    foreign key (organization_id, recipient_member_id)
    references organization_members (organization_id, id)
    on delete cascade
);

create index notifications_recipient_read_created_idx
  on notifications (organization_id, recipient_member_id, read_at, created_at desc);

create index notifications_org_created_idx
  on notifications (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Billing / usage
-- ---------------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  stripe_subscription_id text,
  stripe_customer_id text not null,
  stripe_price_id text,
  plan_code ydt_plan_code not null,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_org_id_key unique (organization_id, id)
);

create unique index subscriptions_stripe_subscription_id_key
  on subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index subscriptions_org_status_idx
  on subscriptions (organization_id, status);

create trigger trg_subscriptions_updated_at
before update on subscriptions
for each row execute function ydt_set_updated_at();

create table usage_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  included_count integer not null default 0,
  purchased_extra_count integer not null default 0,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_periods_org_id_key unique (organization_id, id),
  constraint usage_periods_org_period_key unique (organization_id, period_start, period_end),
  constraint usage_periods_count_check check (
    included_count >= 0 and purchased_extra_count >= 0 and used_count >= 0
  ),
  constraint usage_periods_period_check check (period_start <= period_end)
);

create trigger trg_usage_periods_updated_at
before update on usage_periods
for each row execute function ydt_set_updated_at();

create table usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  usage_period_id uuid not null,
  document_id uuid,
  event_type text not null,
  quantity integer not null,
  reason text,
  stripe_payment_intent_id text,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  constraint usage_events_period_fk
    foreign key (organization_id, usage_period_id)
    references usage_periods (organization_id, id)
    on delete cascade,
  constraint usage_events_document_fk
    foreign key (organization_id, document_id)
    references documents (organization_id, id)
    on delete no action,
  constraint usage_events_created_by_member_fk
    foreign key (organization_id, created_by_member_id)
    references organization_members (organization_id, id)
    on delete no action,
  constraint usage_events_type_check check (event_type in ('consume', 'refund', 'purchase_extra')),
  constraint usage_events_quantity_check check (quantity > 0)
);

create index usage_events_org_created_idx
  on usage_events (organization_id, created_at desc);

create index usage_events_period_idx
  on usage_events (organization_id, usage_period_id);

create index usage_events_document_idx
  on usage_events (organization_id, document_id)
  where document_id is not null;

create table extra_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  usage_period_id uuid not null,
  pack_code text not null,
  purchased_count integer not null,
  price_yen integer not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  purchased_at timestamptz not null default now(),
  constraint extra_packs_period_fk
    foreign key (organization_id, usage_period_id)
    references usage_periods (organization_id, id)
    on delete cascade,
  constraint extra_packs_pack_code_check check (pack_code in ('extra_10', 'extra_30')),
  constraint extra_packs_count_check check (purchased_count in (10, 30)),
  constraint extra_packs_price_check check (price_yen > 0)
);

create unique index extra_packs_checkout_session_key
  on extra_packs (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index extra_packs_org_purchased_idx
  on extra_packs (organization_id, purchased_at desc);

create table stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint stripe_events_event_id_key unique (stripe_event_id)
);

-- ---------------------------------------------------------------------------
-- Calendar
-- ---------------------------------------------------------------------------

create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  member_id uuid not null,
  provider text not null default 'google',
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  calendar_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint calendar_connections_org_id_key unique (organization_id, id),
  constraint calendar_connections_member_fk
    foreign key (organization_id, member_id)
    references organization_members (organization_id, id)
    on delete cascade,
  constraint calendar_connections_member_provider_key unique (member_id, provider)
);

create trigger trg_calendar_connections_updated_at
before update on calendar_connections
for each row execute function ydt_set_updated_at();

create table task_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  task_id uuid not null,
  calendar_connection_id uuid not null,
  provider_event_id text not null,
  event_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_calendar_events_task_fk
    foreign key (organization_id, task_id)
    references tasks (organization_id, id)
    on delete cascade,
  constraint task_calendar_events_connection_fk
    foreign key (organization_id, calendar_connection_id)
    references calendar_connections (organization_id, id)
    on delete cascade,
  constraint task_calendar_events_provider_event_key unique (calendar_connection_id, provider_event_id)
);

create index task_calendar_events_task_idx
  on task_calendar_events (organization_id, task_id);

create trigger trg_task_calendar_events_updated_at
before update on task_calendar_events
for each row execute function ydt_set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  actor_member_id uuid,
  action text not null,
  target_type text not null,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_member_fk
    foreign key (organization_id, actor_member_id)
    references organization_members (organization_id, id)
    on delete no action
);

create index audit_logs_org_created_idx
  on audit_logs (organization_id, created_at desc);

create index audit_logs_target_idx
  on audit_logs (organization_id, target_type, target_id);

create index audit_logs_actor_idx
  on audit_logs (organization_id, actor_member_id, created_at desc)
  where actor_member_id is not null;

-- ---------------------------------------------------------------------------
-- Helpful views
-- ---------------------------------------------------------------------------

create view current_usage_periods as
select
  up.*,
  (up.included_count + up.purchased_extra_count - up.used_count) as remaining_count
from usage_periods up
where current_date between up.period_start and up.period_end;

create view open_tasks as
select *
from tasks
where deleted_at is null
  and status in ('todo', 'in_progress', 'waiting_review');

create view review_required_documents as
select *
from documents
where deleted_at is null
  and status in ('needs_review', 'failed');

