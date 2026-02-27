-- ============================================================
-- DOKA POS - Supabase Schema
-- Run this entire file in your Supabase SQL Editor once.
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- SETTINGS (owner credentials, config)
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ADMINS
create table if not exists admins (
  id bigint primary key,
  name text not null,
  username text not null unique,
  password text not null,
  created_at timestamptz default now()
);

-- CATEGORIES
create table if not exists categories (
  id bigint primary key,
  name text not null,
  size_options jsonb not null default '[]',
  created_at timestamptz default now()
);

-- PRODUCTS
create table if not exists products (
  id bigint primary key,
  model text not null,
  color text not null default '-',
  type text not null default 'Përgjithshëm',
  category_id bigint references categories(id) on delete set null,
  code text not null,
  price integer not null default 0,
  cost integer not null default 0,
  sizes jsonb not null default '[]',
  stock jsonb not null default '{"main":0,"shop1":0,"shop2":0}',
  photo text,
  created_at timestamptz default now()
);

-- WORKERS
create table if not exists workers (
  id bigint primary key,
  name text not null,
  username text not null unique,
  password text not null,
  active boolean not null default true,
  current_shift jsonb,
  shifts jsonb not null default '[]',
  created_at timestamptz default now()
);

-- SALES
create table if not exists sales (
  id bigint primary key,
  date timestamptz not null default now(),
  items jsonb not null default '[]',
  subtotal integer not null default 0,
  discount integer not null default 0,
  total integer not null default 0,
  location text not null default 'main',
  username text not null default 'Unknown'
);

-- TRANSFERS
create table if not exists transfers (
  id bigint primary key,
  from_location text not null,
  to_location text not null,
  items jsonb not null default '[]',
  date timestamptz not null default now()
);

-- Enable Row Level Security but allow all for anon (single-tenant app)
alter table settings enable row level security;
alter table admins enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table workers enable row level security;
alter table sales enable row level security;
alter table transfers enable row level security;

-- Allow full access to anon key (your app uses anon key)
create policy "allow all" on settings for all using (true) with check (true);
create policy "allow all" on admins for all using (true) with check (true);
create policy "allow all" on categories for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on workers for all using (true) with check (true);
create policy "allow all" on sales for all using (true) with check (true);
create policy "allow all" on transfers for all using (true) with check (true);

-- Enable realtime for live sync across devices
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table workers;
alter publication supabase_realtime add table admins;
alter publication supabase_realtime add table settings;
alter publication supabase_realtime add table transfers;

-- Insert default owner credentials
insert into settings (key, value) 
values ('owner_credentials', '{"username":"admin","password":"admin123"}')
on conflict (key) do nothing;

-- Insert default theme and location names (run these too)
insert into settings (key, value)
values ('theme_id', '"violet"')
on conflict (key) do nothing;

insert into settings (key, value)
values ('location_names', '{"main":"Magazina","shop1":"Dyqani 1","shop2":"Dyqani 2"}')
on conflict (key) do nothing;

-- Default locations config
insert into settings (key, value)
values ('locations', '[{"id":"main","name":"Magazina","type":"warehouse","order":0},{"id":"shop1","name":"Dyqani 1","type":"shop","order":1},{"id":"shop2","name":"Dyqani 2","type":"shop","order":2}]')
on conflict (key) do nothing;
