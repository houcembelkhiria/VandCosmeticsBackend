-- Migration script to remove slug column and constraints from categories table
-- Run this in your Supabase SQL editor

-- First, drop the unique constraint on slug if it exists
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;

-- Drop the index on slug if it exists
DROP INDEX IF EXISTS idx_categories_slug;

-- Remove the NOT NULL constraint from slug column
ALTER TABLE categories ALTER COLUMN slug DROP NOT NULL;

-- Now remove the slug column entirely
ALTER TABLE categories DROP COLUMN IF EXISTS slug;

-- Ensure the name column has a unique constraint
ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
