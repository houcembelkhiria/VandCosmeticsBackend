import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { includeInactive = false } = req.query;

    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    // Filter out inactive categories unless specifically requested
    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    const { data: categories, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ categories: categories || [] });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, image_url, parent_id, sort_order, is_active = true } = req.body;

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert({
        name,
        description,
        image_url,
        parent_id,
        sort_order: sort_order || 0,
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    updates.updated_at = new Date().toISOString();

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Category not found' });
      }
      throw error;
    }

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category has products
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (productsError) {
      throw productsError;
    }

    if (products && products.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that has products. Please move or delete the products first.' 
      });
    }

    // Check if category has subcategories
    const { data: subcategories, error: subcategoriesError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('parent_id', id)
      .limit(1);

    if (subcategoriesError) {
      throw subcategoriesError;
    }

    if (subcategories && subcategories.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete category that has subcategories. Please move or delete the subcategories first.' 
      });
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

export const getCategoryProducts = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // First verify the category exists
    const { data: category, error: categoryError } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('id', id)
      .single();

    if (categoryError || !category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Get products in this category
    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .eq('category_id', category.id)
      .order('created_at', { ascending: false });

    // Apply pagination
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      category,
      products: products || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get category products error:', error);
    res.status(500).json({ error: 'Failed to fetch category products' });
  }
};
