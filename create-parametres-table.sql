-- Create parametres table for storing system parameters like delivery fees
CREATE TABLE IF NOT EXISTS parametres (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'decimal', 'integer', 'boolean', 'json')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_parametres_key ON parametres(key);
CREATE INDEX IF NOT EXISTS idx_parametres_is_active ON parametres(is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_parametres_updated_at BEFORE UPDATE ON parametres
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;

-- Public read access for parameters
CREATE POLICY "Parameters are viewable by everyone" ON parametres
    FOR SELECT USING (is_active = true);

-- Only admins can insert parameters
CREATE POLICY "Only admins can insert parameters" ON parametres
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can update parameters
CREATE POLICY "Only admins can update parameters" ON parametres
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Only admins can delete parameters
CREATE POLICY "Only admins can delete parameters" ON parametres
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Insert initial delivery fee parameter
INSERT INTO parametres (key, value, description, type) VALUES
('delivery_fee', '5.00', 'Frais de livraison standard en euros', 'decimal'),
('free_delivery_threshold', '50.00', 'Montant minimum pour la livraison gratuite en euros', 'decimal')
ON CONFLICT (key) DO NOTHING;

