-- Migration: 016_create_department_school.sql
-- Purpose: Create minimal department_school table with only department_name and school
-- Date: 2026-04-11

create table if not exists public.department_school (
  department_name text not null,
  school text not null,
  constraint department_school_pk primary key (department_name, school),
  constraint department_school_department_name_not_blank check (length(trim(department_name)) > 0),
  constraint department_school_school_not_blank check (length(trim(school)) > 0)
);

create index if not exists idx_department_school_school
  on public.department_school (lower(school));
