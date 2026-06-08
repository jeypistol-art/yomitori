alter table managed_assets
  add column if not exists asset_type_label text;

alter table counterparties
  add column if not exists counterparty_type_label text;
