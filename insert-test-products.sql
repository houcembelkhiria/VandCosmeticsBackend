-- Insert test products for Vanda Cosmetics
-- Run this in your Supabase SQL editor after running the main schema

-- First, let's get the category IDs (assuming categories exist)
-- If categories don't exist, they will be created by the main schema

-- Insert test products
INSERT INTO products (title, slug, description, price, images, category_id, stock, featured) VALUES

-- Skincare Products
('Sérum Anti-Âge Premium', 'serum-anti-age-premium', 
 'Sérum concentré avec acide hyaluronique et vitamine C pour réduire les signes de l''âge et hydrater la peau.', 
 89.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500', 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500'], 
 (SELECT id FROM categories WHERE name = 'Skincare' LIMIT 1), 
 25, true),

('Crème Hydratante Nuit', 'creme-hydratante-nuit', 
 'Crème riche pour la nuit qui nourrit et répare la peau pendant le sommeil.', 
 45.99, 
 ARRAY['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500'], 
 (SELECT id FROM categories WHERE name = 'Skincare' LIMIT 1), 
 30, false),

('Masque Purifiant Argile', 'masque-purifiant-argile', 
 'Masque à l''argile verte pour purifier et détoxifier les pores.', 
 32.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500'], 
 (SELECT id FROM categories WHERE name = 'Skincare' LIMIT 1), 
 18, false),

-- Makeup Products
('Rouge à Lèvres Rouge Classique', 'rouge-levres-rouge-classique', 
 'Rouge à lèvres rouge intense, longue tenue, formule hydratante.', 
 24.99, 
 ARRAY['https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500'], 
 (SELECT id FROM categories WHERE name = 'Makeup' LIMIT 1), 
 40, true),

('Palette Fard à Paupières', 'palette-fard-paupieres', 
 'Palette de 12 couleurs neutres et smokey pour tous les looks.', 
 39.99, 
 ARRAY['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500'], 
 (SELECT id FROM categories WHERE name = 'Makeup' LIMIT 1), 
 22, false),

('Fond de Teint Liquide', 'fond-teint-liquide', 
 'Fond de teint liquide, couvrance moyenne, fini naturel.', 
 29.99, 
 ARRAY['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500'], 
 (SELECT id FROM categories WHERE name = 'Makeup' LIMIT 1), 
 35, false),

('Mascara Volume Intense', 'mascara-volume-intense', 
 'Mascara noir pour des cils volumineux et allongés.', 
 18.99, 
 ARRAY['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500'], 
 (SELECT id FROM categories WHERE name = 'Makeup' LIMIT 1), 
 28, false),

-- Fragrance Products
('Parfum Oriental Mystique', 'parfum-oriental-mystique', 
 'Parfum oriental avec notes de vanille, ambre et musc.', 
 79.99, 
 ARRAY['https://images.unsplash.com/photo-1541643600914-78b084683601?w=500'], 
 (SELECT id FROM categories WHERE name = 'Fragrance' LIMIT 1), 
 15, true),

('Eau de Toilette Fraîche', 'eau-toilette-fraiche', 
 'Eau de toilette légère avec notes d''agrumes et fleurs blanches.', 
 45.99, 
 ARRAY['https://images.unsplash.com/photo-1541643600914-78b084683601?w=500'], 
 (SELECT id FROM categories WHERE name = 'Fragrance' LIMIT 1), 
 20, false),

-- Hair Care Products
('Shampoing Hydratant', 'shampoing-hydratant', 
 'Shampoing pour cheveux secs et abîmés, formule nourrissante.', 
 19.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500'], 
 (SELECT id FROM categories WHERE name = 'Hair Care' LIMIT 1), 
 50, false),

('Masque Capillaire Réparateur', 'masque-capillaire-reparateur', 
 'Masque profond pour réparer les cheveux abîmés et colorés.', 
 34.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500'], 
 (SELECT id FROM categories WHERE name = 'Hair Care' LIMIT 1), 
 25, false),

('Huile Capillaire Argan', 'huile-capillaire-argan', 
 'Huile d''argan pure pour nourrir et faire briller les cheveux.', 
 27.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500'], 
 (SELECT id FROM categories WHERE name = 'Hair Care' LIMIT 1), 
 30, false),

-- Bath & Body Products
('Gel Douche Relaxant', 'gel-douche-relaxant', 
 'Gel douche avec huiles essentielles pour un moment de détente.', 
 15.99, 
 ARRAY['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500'], 
 (SELECT id FROM categories WHERE name = 'Bath & Body' LIMIT 1), 
 40, false),

('Lotion Corporelle Hydratante', 'lotion-corporelle-hydratante', 
 'Lotion corporelle légère qui hydrate sans laisser de film gras.', 
 22.99, 
 ARRAY['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500'], 
 (SELECT id FROM categories WHERE name = 'Bath & Body' LIMIT 1), 
 35, false),

('Savon Artisanal Naturel', 'savon-artisanal-naturel', 
 'Savon artisanal à l''huile d''olive et miel, 100% naturel.', 
 12.99, 
 ARRAY['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=500'], 
 (SELECT id FROM categories WHERE name = 'Bath & Body' LIMIT 1), 
 60, false),

-- Additional Featured Products
('Kit Soins Complet', 'kit-soins-complet', 
 'Kit complet avec sérum, crème et masque pour une routine complète.', 
 129.99, 
 ARRAY['https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=500'], 
 (SELECT id FROM categories WHERE name = 'Skincare' LIMIT 1), 
 10, true),

('Parfum Signature', 'parfum-signature', 
 'Notre parfum signature avec des notes uniques et envoûtantes.', 
 95.99, 
 ARRAY['https://images.unsplash.com/photo-1541643600914-78b084683601?w=500'], 
 (SELECT id FROM categories WHERE name = 'Fragrance' LIMIT 1), 
 12, true)

ON CONFLICT (slug) DO NOTHING;

-- Update timestamps
UPDATE products SET 
    created_at = NOW() - (random() * interval '30 days'),
    updated_at = NOW() - (random() * interval '7 days')
WHERE created_at = NOW();

-- Display inserted products count
SELECT 
    COUNT(*) as total_products,
    COUNT(CASE WHEN featured = true THEN 1 END) as featured_products,
    AVG(price) as average_price,
    SUM(stock) as total_stock
FROM products;
