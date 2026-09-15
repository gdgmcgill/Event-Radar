-- Add is_admin column to users table (required by 009_user_roles.sql)
-- Safe to run idempotently: 009 migrates is_admin -> roles and drops this column
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
