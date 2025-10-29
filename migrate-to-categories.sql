-- Migration script to add categories table and update products table
-- Run this in your Supabase SQL editor

-- Step 1: Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add category_id column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Step 4: Add trigger for updated_at
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Set up Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for categories
CREATE POLICY "Categories are viewable by everyone" ON categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Only admins can insert categories" ON categories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update categories" ON categories
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete categories" ON categories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Step 7: Insert sample categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
('Skincare', 'skincare', 'Face and body skincare products', 1),
('Makeup', 'makeup', 'Cosmetic makeup products', 2),
('Fragrance', 'fragrance', 'Perfumes and body sprays', 3),
('Hair Care', 'hair-care', 'Shampoo, conditioner, and styling products', 4),
('Bath & Body', 'bath-body', 'Soaps, lotions, and bath products', 5)
ON CONFLICT (slug) DO NOTHING;

-- Step 8: Migrate existing category data (if any)
-- This will map existing string categories to the new category table
-- You may need to adjust this based on your existing data

-- Example: If you have products with category = 'Skincare', this will set category_id
UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'skincare')
WHERE category = 'Skincare' AND category_id IS NULL;

UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'makeup')
WHERE category = 'Makeup' AND category_id IS NULL;

UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'fragrance')
WHERE category = 'Fragrance' AND category_id IS NULL;

UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'hair-care')
WHERE category = 'Hair Care' AND category_id IS NULL;

UPDATE products 
SET category_id = (SELECT id FROM categories WHERE slug = 'bath-body')
WHERE category = 'Bath & Body' AND category_id IS NULL;

-- Step 9: After migration is complete and tested, you can drop the old category column
-- ALTER TABLE products DROP COLUMN category;
