import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, search, featured, page = 1, limit = 20 } = req.query;

    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (minPrice) {
      query = query.gte('price', parseFloat(minPrice as string));
    }

    if (maxPrice) {
      query = query.lte('price', parseFloat(maxPrice as string));
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    // Apply pagination
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      products: products || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

export const getProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Try to find by slug first
    let { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('slug', id)
      .single();

    // If not found by slug, try by ID
    if (error && error.code === 'PGRST116') {
      const result = await supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      product = result.data;
      error = result.error;
    }

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: any, res: Response) => {
  try {
    const { title, description, price, category, stock, images, variants, attributes, featured = false } = req.body;

    // Generate slug from title
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        title,
        slug,
        description,
        price,
        category,
        stock,
        images: images || [],
        variants: variants || [],
        attributes: attributes || {},
        featured,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Generate new slug if title is being updated
    if (updates.title) {
      updates.slug = updates.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    updates.updated_at = new Date().toISOString();

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Product not found' });
      }
      throw error;
    }

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

export const getCategories = async (req: Request, res: Response) => {
  try {
    // Temporary fallback until categories table is created
    const { data: categories, error } = await supabaseAdmin
      .from('products')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      throw error;
    }

    // Get unique categories and sort them
    const uniqueCategories = [...new Set(categories.map(c => c.category))].sort();
    
    res.json({ categories: uniqueCategories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const uploadProductImages = async (req: any, res: Response) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedUrls: string[] = [];

    for (const file of req.files) {
      const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
      
      const { data, error } = await supabaseAdmin.storage
        .from(process.env.SUPABASE_BUCKET!)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600'
        });

      if (error) {
        console.error('Upload error:', error);
        continue;
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from(process.env.SUPABASE_BUCKET!)
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    res.json({ urls: uploadedUrls });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
};
