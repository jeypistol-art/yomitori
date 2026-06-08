create table if not exists custom_type_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  option_kind text not null check (
    option_kind in ('asset_type', 'counterparty_type', 'document_type')
  ),
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint custom_type_options_label_not_blank
    check (length(trim(label)) > 0)
);

create unique index if not exists custom_type_options_org_kind_label_key
  on custom_type_options (organization_id, option_kind, lower(label))
  where deleted_at is null;

insert into custom_type_options (organization_id, option_kind, label)
select source.organization_id, 'asset_type', source.label
from (
  select organization_id, min(trim(asset_type_label)) as label
  from managed_assets
  where deleted_at is null
    and nullif(trim(coalesce(asset_type_label, '')), '') is not null
  group by organization_id, lower(trim(asset_type_label))
) source
where not exists (
  select 1
  from custom_type_options existing
  where existing.organization_id = source.organization_id
    and existing.option_kind = 'asset_type'
    and existing.deleted_at is null
    and lower(existing.label) = lower(source.label)
);

insert into custom_type_options (organization_id, option_kind, label)
select source.organization_id, 'counterparty_type', source.label
from (
  select organization_id, min(trim(counterparty_type_label)) as label
  from counterparties
  where deleted_at is null
    and nullif(trim(coalesce(counterparty_type_label, '')), '') is not null
  group by organization_id, lower(trim(counterparty_type_label))
) source
where not exists (
  select 1
  from custom_type_options existing
  where existing.organization_id = source.organization_id
    and existing.option_kind = 'counterparty_type'
    and existing.deleted_at is null
    and lower(existing.label) = lower(source.label)
);

insert into custom_type_options (organization_id, option_kind, label)
select source.organization_id, 'document_type', source.label
from (
  select organization_id, min(trim((metadata->>'document_type_label'))) as label
  from documents
  where deleted_at is null
    and nullif(trim(coalesce((metadata->>'document_type_label'), '')), '') is not null
  group by organization_id, lower(trim((metadata->>'document_type_label')))
) source
where not exists (
  select 1
  from custom_type_options existing
  where existing.organization_id = source.organization_id
    and existing.option_kind = 'document_type'
    and existing.deleted_at is null
    and lower(existing.label) = lower(source.label)
);
