#!/usr/bin/env bash
# Applies Vanda's schema files to the local stack. Errors from statements that need the real
# Supabase auth/storage services are expected and ignored (as on a first run in production,
# the schema file needs two passes because `parametres` is referenced before it is created).
set -u
cd "$(dirname "$0")/../.."
DB=$(docker ps --filter name=vanda-local-db --format '{{.Names}}' | head -1)
psql_() { docker exec -i "$DB" psql -U postgres -d postgres -q "$@"; }
psql_ <<'SQL' >/dev/null 2>&1
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), email text, raw_user_meta_data jsonb DEFAULT '{}');
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid DEFAULT uuid_generate_v4(), bucket_id text, name text);
SQL
for pass in 1 2; do psql_ < supabase-schema.sql >/dev/null 2>&1; done
psql_ < migrate-to-categories.sql >/dev/null 2>&1
# The controllers read/write a text `category` column that the repo's schema file does not declare.
psql_ -c "ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT" >/dev/null 2>&1
psql_ < add-auditflow-columns.sql
psql_ -c "NOTIFY pgrst, 'reload schema'" >/dev/null 2>&1
psql_ -tAc "select string_agg(table_name, ',' order by table_name) from information_schema.tables where table_schema='public'"
