-- Injektionstracker Pro: enriched 3D injection logs

alter table injection_logs
  add column if not exists peptide_id uuid references peptides on delete set null,
  add column if not exists cycle_id uuid references cycles on delete set null,
  add column if not exists dose numeric(10,3),
  add column if not exists unit text,
  add column if not exists method text,
  add column if not exists body_region text,
  add column if not exists body_side text,
  add column if not exists model_version text,
  add column if not exists position jsonb,
  add column if not exists normal jsonb,
  add column if not exists uv jsonb,
  add column if not exists camera_state jsonb,
  add column if not exists warning_state text,
  add column if not exists substance_label text;

create index if not exists injection_logs_user_logged_at_idx
  on injection_logs (user_id, logged_at desc);

create index if not exists injection_logs_user_cycle_idx
  on injection_logs (user_id, cycle_id, logged_at desc);

create index if not exists injection_logs_user_region_idx
  on injection_logs (user_id, body_region, body_side, logged_at desc);
