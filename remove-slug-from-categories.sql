-- Migration script to remove slug field from categories table
-- Run this in your Supabase SQL editor

-- First, drop the unique constraint on slug
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_slug_key;

-- Drop the index on slug
DROP INDEX IF EXISTS idx_categories_slug;

-- Remove the slug column
ALTER TABLE categories DROP COLUMN IF EXISTS slug;

-- Update the unique constraint to be on name instead of slug
ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);

-- Update sample data to remove slug references
UPDATE categories SET name = 'Skincare' WHERE name = 'Skincare';
UPDATE categories SET name = 'Makeup' WHERE name = 'Makeup';
UPDATE categories SET name = 'Fragrance' WHERE name = 'Fragrance';
UPDATE categories SET name = 'Hair Care' WHERE name = 'Hair Care';
UPDATE categories SET name = 'Bath & Body' WHERE name = 'Bath & Body';
