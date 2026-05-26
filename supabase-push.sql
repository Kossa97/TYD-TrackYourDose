-- Web Push Subscriptions
-- In Supabase SQL-Editor ausführen

create table if not exists push_subscriptions (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users on delete cascade not null,
  endpoint     text        not null,
  subscription jsonb       not null,
  timezone     text        not null default 'UTC',
  created_at   timestamptz default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "Own push subscriptions" on push_subscriptions
  for all
  using     (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);
