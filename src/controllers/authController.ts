import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabaseClient } from '../config/supabase';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;

    // Create user in Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        phone,
        role: 'user'
      },
      email_confirm: true // Auto-confirm for demo
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: data.user.id,
        email: data.user.email,
        role: 'user'
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        phone: data.user.user_metadata?.phone,
        role: data.user.user_metadata?.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Supabase
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || 'user'
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name,
        phone: data.user.user_metadata?.phone,
        role: data.user.user_metadata?.role || 'user'
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(req.user.id);

    if (error || !user.user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.user.id,
      email: user.user.email,
      name: user.user.user_metadata?.name,
      role: user.user.user_metadata?.role || 'user',
      createdAt: user.user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const { name } = req.body;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      user_metadata: {
        name,
        role: req.user.role
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      role: data.user.user_metadata?.role
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
