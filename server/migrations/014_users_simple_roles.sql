-- Migration: 014_users_simple_roles.sql
-- Purpose: Keep leadership roles simple and explicit on users table,
--          while preventing duplicate active assignment rows in legacy RBAC tables.
-- Safe to run multiple times.

alter table if exists public.users
  add column if not exists university_role text,
  add column if not exists is_hod boolean not null default false,
  add column if not exists is_dean boolean not null default false,
  add column if not exists is_cfo boolean not null default false,
  add column if not exists is_finance_officer boolean not null default false;

update public.users
set is_hod = false
where is_hod is null;

update public.users
set is_dean = false
where is_dean is null;

update public.users
set is_cfo = false
where is_cfo is null;

update public.users
set is_finance_officer = false
where is_finance_officer is null;

alter table if exists public.users
  alter column is_hod set default false,
  alter column is_hod set not null,
  alter column is_dean set default false,
  alter column is_dean set not null,
  alter column is_cfo set default false,
  alter column is_cfo set not null,
  alter column is_finance_officer set default false,
  alter column is_finance_officer set not null;

-- Normalize legacy+new role fields into one consistent, single leadership role state.
with normalized_roles as (
  select
    id,
    case
      when lower(coalesce(university_role, '')) = 'hod' then 'hod'
      when lower(coalesce(university_role, '')) = 'dean' then 'dean'
      when lower(coalesce(university_role, '')) = 'cfo' then 'cfo'
      when lower(coalesce(university_role, '')) = 'finance_officer' then 'finance_officer'
      when coalesce(is_hod, false) then 'hod'
      when coalesce(is_dean, false) then 'dean'
      when coalesce(is_cfo, false) then 'cfo'
      when coalesce(is_finance_officer, false) then 'finance_officer'
      else null
    end as normalized_role
  from public.users
)
update public.users as u
set
  is_hod = coalesce(n.normalized_role = 'hod', false),
  is_dean = coalesce(n.normalized_role = 'dean', false),
  is_cfo = coalesce(n.normalized_role = 'cfo', false),
  is_finance_officer = coalesce(n.normalized_role = 'finance_officer', false),
  university_role = n.normalized_role
from normalized_roles as n
where u.id = n.id;

-- Enforce single leadership role at a time.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_single_leadership_role_chk'
  ) then
    alter table public.users
      add constraint users_single_leadership_role_chk
      check ((is_hod::int + is_dean::int + is_cfo::int + is_finance_officer::int) <= 1);
  end if;
end $$;

create index if not exists idx_users_is_cfo on public.users(is_cfo);
create index if not exists idx_users_is_finance_officer on public.users(is_finance_officer);
create index if not exists idx_users_university_role on public.users(university_role);

-- Dedupe legacy assignment rows so there is only one active row per user and role.
do $$
begin
  if to_regclass('public.user_role_assignments') is not null then
    with ranked_assignments as (
      select
        id,
        row_number() over (
          partition by user_id, role_code
          order by created_at desc, id desc
        ) as rn
      from public.user_role_assignments
      where is_active = true
    )
    update public.user_role_assignments as ura
    set
      is_active = false,
      valid_until = coalesce(ura.valid_until, now()),
      updated_at = now(),
      assigned_reason = case
        when coalesce(ura.assigned_reason, '') = '' then 'Deduped by migration 014'
        else ura.assigned_reason || ' | Deduped by migration 014'
      end
    from ranked_assignments as ra
    where ura.id = ra.id
      and ra.rn > 1;

    create unique index if not exists user_role_assignments_unique_active_user_role_idx
      on public.user_role_assignments(user_id, role_code)
      where is_active = true;
  end if;
end $$;
