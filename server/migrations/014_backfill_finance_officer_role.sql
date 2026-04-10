-- Migration: 014_backfill_finance_officer_role.sql
-- Purpose: Ensure finance users are mapped to university_role = 'finance_officer'
--          and keep a boolean helper flag in sync.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users
      add column if not exists university_role text,
      add column if not exists is_finance_officer boolean not null default false;

    -- Backfill finance role from legacy CFO markers.
    update public.users
    set university_role = 'finance_officer'
    where lower(coalesce(university_role, '')) = 'cfo'
       or coalesce(is_cfo, false) = true;

    -- Keep helper flag synchronized with university_role.
    update public.users
    set is_finance_officer = (lower(coalesce(university_role, '')) = 'finance_officer');

    create index if not exists idx_users_university_role on public.users(university_role);
    create index if not exists idx_users_is_finance_officer on public.users(is_finance_officer);
  end if;
end $$;

-- If RBAC foundation tables are present, ensure FINANCE_OFFICER role exists and assignments are populated.
do $$
begin
  if to_regclass('public.role_catalog') is not null then
    insert into public.role_catalog (role_code, role_name, description, is_service_role, is_active)
    values ('FINANCE_OFFICER', 'Finance Officer', 'L4 accounts approvals, advances, and settlements.', false, true)
    on conflict (role_code)
    do update set
      role_name = excluded.role_name,
      description = excluded.description,
      is_service_role = excluded.is_service_role,
      is_active = true,
      updated_at = now();
  end if;

  if to_regclass('public.role_capabilities') is not null then
    insert into public.role_capabilities (role_code, capability)
    values
      ('FINANCE_OFFICER', 'approval:decision_l4_accounts'),
      ('FINANCE_OFFICER', 'finance:record_advance_paid'),
      ('FINANCE_OFFICER', 'finance:verify_documents'),
      ('FINANCE_OFFICER', 'finance:close_settlement')
    on conflict (role_code, capability) do nothing;
  end if;

  if to_regclass('public.user_role_assignments') is not null and to_regclass('public.users') is not null then
    insert into public.user_role_assignments (
      user_id,
      role_code,
      valid_from,
      assigned_by,
      assigned_reason,
      is_active
    )
    select
      u.id,
      'FINANCE_OFFICER',
      now(),
      'system:migration_014',
      'Backfilled from users.university_role = finance_officer',
      true
    from public.users u
    where lower(coalesce(u.university_role, '')) = 'finance_officer'
      and not exists (
        select 1
        from public.user_role_assignments ura
        where ura.user_id = u.id
          and ura.role_code = 'FINANCE_OFFICER'
          and ura.is_active = true
      );
  end if;
end $$;
