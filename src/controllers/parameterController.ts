import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

export const getParameters = async (req: Request, res: Response) => {
  try {
    const { includeInactive = false } = req.query;

    let query = supabaseAdmin
      .from('parametres')
      .select('*')
      .order('key', { ascending: true });

    // Filter out inactive parameters unless specifically requested
    if (includeInactive !== 'true') {
      query = query.eq('is_active', true);
    }

    const { data: parameters, error } = await query;

    if (error) {
      throw error;
    }

    res.json({ parameters: parameters || [] });
  } catch (error) {
    console.error('Get parameters error:', error);
    res.status(500).json({ error: 'Failed to fetch parameters' });
  }
};

export const getParameter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: parameter, error } = await supabaseAdmin
      .from('parametres')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !parameter) {
      return res.status(404).json({ error: 'Parameter not found' });
    }

    res.json(parameter);
  } catch (error) {
    console.error('Get parameter error:', error);
    res.status(500).json({ error: 'Failed to fetch parameter' });
  }
};

export const createParameter = async (req: Request, res: Response) => {
  try {
    const { key, value, description, type = 'text', is_active = true } = req.body;

    // Validate type
    const validTypes = ['text', 'decimal', 'integer', 'boolean', 'json'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const { data: parameter, error } = await supabaseAdmin
      .from('parametres')
      .insert({
        key,
        value,
        description,
        type,
        is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate key error
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Parameter with this key already exists' });
      }
      throw error;
    }

    res.status(201).json(parameter);
  } catch (error) {
    console.error('Create parameter error:', error);
    res.status(500).json({ error: 'Failed to create parameter' });
  }
};

export const updateParameter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If type is being updated, validate it
    if (updates.type) {
      const validTypes = ['text', 'decimal', 'integer', 'boolean', 'json'];
      if (!validTypes.includes(updates.type)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: parameter, error } = await supabaseAdmin
      .from('parametres')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Parameter not found' });
      }
      // Check for duplicate key error
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Parameter with this key already exists' });
      }
      throw error;
    }

    res.json(parameter);
  } catch (error) {
    console.error('Update parameter error:', error);
    res.status(500).json({ error: 'Failed to update parameter' });
  }
};

export const deleteParameter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('parametres')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete parameter error:', error);
    res.status(500).json({ error: 'Failed to delete parameter' });
  }
};

export const getParameterByKey = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const { data: parameter, error } = await supabaseAdmin
      .from('parametres')
      .select('*')
      .eq('key', key)
      .eq('is_active', true)
      .single();

    if (error || !parameter) {
      return res.status(404).json({ error: 'Parameter not found' });
    }

    res.json(parameter);
  } catch (error) {
    console.error('Get parameter by key error:', error);
    res.status(500).json({ error: 'Failed to fetch parameter' });
  }
};

