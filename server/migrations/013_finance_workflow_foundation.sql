-- Migration: 013_finance_workflow_foundation.sql
-- Purpose: Add finance workflow support for L4 accounts operations,
--          vendor advances, settlement verification, and audit logging.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table if exists public.event_budgets
  add column if not exists advance_paid numeric not null default 0,
  add column if not exists settlement_status text not null default 'draft',
  add column if not exists finance_status text not null default 'pending',
  add column if not exists settlement_submitted_at timestamptz,
  add column if not exists settlement_closed_at timestamptz,
  add column if not exists settlement_closed_by text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.expense_documents (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  budget_id text,
  file_name text not null,
  file_url text not null,
  document_type text not null default 'invoice',
  amount numeric,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  finance_verified boolean not null default false,
  finance_verified_by text,
  finance_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.expense_documents
  add column if not exists budget_id text,
  add column if not exists file_name text,
  add column if not exists file_url text,
  add column if not exists document_type text,
  add column if not exists amount numeric,
  add column if not exists uploaded_by text,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists finance_verified boolean not null default false,
  add column if not exists finance_verified_by text,
  add column if not exists finance_verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.expense_documents
set finance_verified = false
where finance_verified is null;

alter table if exists public.expense_documents
  alter column finance_verified set default false,
  alter column finance_verified set not null;

create table if not exists public.finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  budget_id text,
  action text not null,
  amount numeric,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  acted_by_email text,
  acted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.event_budgets') is not null then
    create index if not exists idx_event_budgets_settlement_status
      on public.event_budgets(settlement_status);

    create index if not exists idx_event_budgets_finance_status
      on public.event_budgets(finance_status);
  end if;
end $$;

create index if not exists idx_expense_documents_event_id
  on public.expense_documents(event_id);

create index if not exists idx_expense_documents_budget_id
  on public.expense_documents(budget_id);

create index if not exists idx_expense_documents_finance_verified
  on public.expense_documents(finance_verified);

create index if not exists idx_finance_audit_log_event_id
  on public.finance_audit_log(event_id);

create index if not exists idx_finance_audit_log_budget_id
  on public.finance_audit_log(budget_id);

create index if not exists idx_finance_audit_log_action
  on public.finance_audit_log(action);
