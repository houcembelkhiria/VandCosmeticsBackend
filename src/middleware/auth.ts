import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get user from Supabase
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(decoded.sub);
    
    if (error || !user.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = {
      id: user.user.id,
      email: user.user.email!,
      role: user.user.user_metadata?.role || 'user'
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(decoded.sub);
      
      if (!error && user.user) {
        req.user = {
          id: user.user.id,
          email: user.user.email!,
          role: user.user.user_metadata?.role || 'user'
        };
      }
    }
  } catch (error) {
    // Continue without authentication for optional auth
  }
  
  next();
};
