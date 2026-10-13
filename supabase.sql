-- Ejecuta este archivo completo en Supabase > SQL Editor > New query > Run

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz default now()
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references households(id),
  display_name text
);

create table if not exists records (
  id uuid primary key,
  household_id uuid not null references households(id),
  owner_id uuid,                     -- null = compartido de la casa
  kind text not null,                -- account | txn | plan | goal
  data jsonb not null default '{}',
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp()
);
create index if not exists records_sync_idx on records (household_id, updated_at);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
drop trigger if exists records_touch on records;
create trigger records_touch before insert or update on records
  for each row execute function touch_updated_at();

create or replace function my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where user_id = auth.uid()
$$;

create or replace function create_household(h_name text, my_name text) returns json
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  insert into households(name) values (h_name) returning * into h;
  insert into profiles(user_id, household_id, display_name) values (auth.uid(), h.id, my_name)
    on conflict (user_id) do update set household_id = h.id, display_name = my_name;
  return json_build_object('household_id', h.id, 'invite_code', h.invite_code);
end $$;

create or replace function join_household(code text, my_name text) returns json
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  select * into h from households where invite_code = lower(trim(code));
  if h.id is null then raise exception 'Codigo invalido'; end if;
  insert into profiles(user_id, household_id, display_name) values (auth.uid(), h.id, my_name)
    on conflict (user_id) do update set household_id = h.id, display_name = my_name;
  return json_build_object('household_id', h.id, 'invite_code', h.invite_code);
end $$;

alter table households enable row level security;
alter table profiles  enable row level security;
alter table records   enable row level security;

drop policy if exists hh_select on households;
create policy hh_select on households for select using (id = my_household());

drop policy if exists prof_select on profiles;
create policy prof_select on profiles for select using (user_id = auth.uid() or household_id = my_household());

-- Cada quien ve lo suyo (owner_id = yo) + lo compartido (owner_id null)
drop policy if exists rec_select on records;
create policy rec_select on records for select
  using (household_id = my_household() and (owner_id is null or owner_id = auth.uid()));
drop policy if exists rec_insert on records;
create policy rec_insert on records for insert
  with check (household_id = my_household() and (owner_id is null or owner_id = auth.uid()));
drop policy if exists rec_update on records;
create policy rec_update on records for update
  using (household_id = my_household() and (owner_id is null or owner_id = auth.uid()))
  with check (household_id = my_household() and (owner_id is null or owner_id = auth.uid()));

grant execute on function create_household(text, text), join_household(text, text), my_household() to authenticated;
