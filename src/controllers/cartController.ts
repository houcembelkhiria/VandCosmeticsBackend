import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../config/supabase';

export const getCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: cart, error } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id,
        quantity,
        product_id,
        variant_id,
        products (
          id,
          title,
          price,
          images,
          stock
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    res.json({ items: cart || [] });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

export const addToCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, variantId, quantity = 1 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if item already exists in cart
    const { data: existingItem } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .eq('variant_id', variantId || null)
      .single();

    if (existingItem) {
      // Update quantity
      const { data: updatedItem, error } = await supabaseAdmin
        .from('cart_items')
        .update({ quantity: existingItem.quantity + quantity })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (error) throw error;
      return res.json(updatedItem);
    } else {
      // Add new item
      const { data: newItem, error } = await supabaseAdmin
        .from('cart_items')
        .insert({
          user_id: userId,
          product_id: productId,
          variant_id: variantId,
          quantity
        })
        .select()
        .single();

      if (error) throw error;
      return res.json(newItem);
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (quantity <= 0) {
      // Remove item
      const { error } = await supabaseAdmin
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) throw error;
      return res.status(204).send();
    }

    // Update quantity
    const { data: updatedItem, error } = await supabaseAdmin
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json(updatedItem);
  } catch (error) {
    console.error('Update cart item error:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
};

export const removeFromCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
};

export const clearCart = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { error } = await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};
