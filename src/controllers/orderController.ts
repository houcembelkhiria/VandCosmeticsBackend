import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

const generateOrderId = () => {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `VANDA-${date}-${random}`;
};

export const createOrder = async (req: any, res: Response) => {
  try {
    const orderData = req.body;
    const orderId = generateOrderId();

    // Create order in database
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        user_id: req.user?.id || null,
        customer_email: orderData.customerEmail,
        customer_name: orderData.customerName,
        items: orderData.items,
        shipping: orderData.shipping,
        subtotal: orderData.subtotal,
        discount: orderData.discount || 0,
        total: orderData.total,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update product stock
    // First, validate all items have sufficient stock
    const stockIssues = [];
    
    for (const item of orderData.items) {
      // Get the current stock
      const { data: product, error: fetchError } = await supabaseAdmin
        .from('products')
        .select('stock, title')
        .eq('id', item.productId)
        .single();

      if (fetchError) {
        stockIssues.push(`Product ${item.productId} not found`);
        continue;
      }

      // Check if sufficient stock
      if (product.stock < item.quantity) {
        stockIssues.push(`Insufficient stock for "${product.title}". Available: ${product.stock}, Required: ${item.quantity}`);
      }
    }

    // If there are stock issues, delete the order and return error
    if (stockIssues.length > 0) {
      await supabaseAdmin
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      return res.status(400).json({ 
        error: 'Insufficient stock', 
        details: stockIssues 
      });
    }

    // All items have sufficient stock, proceed with reduction
    for (const item of orderData.items) {
      // Get current stock again to update
      const { data: product, error: fetchError } = await supabaseAdmin
        .from('products')
        .select('stock')
        .eq('id', item.productId)
        .single();

      if (fetchError) {
        console.error('Error fetching product stock for update:', fetchError);
        continue;
      }

      // Update stock
      const { error: stockError } = await supabaseAdmin
        .from('products')
        .update({ 
          stock: product.stock - item.quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.productId);

      if (stockError) {
        console.error('Stock update error:', stockError);
        // This shouldn't happen after validation, but log it
      }
    }

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const getOrders = async (req: any, res: Response) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // If user is not admin, only show their orders
    if (req.user?.role !== 'admin') {
      query = query.eq('user_id', req.user?.id);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      orders: orders || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getOrder = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id);

    // If user is not admin, ensure they can only access their own orders
    if (req.user?.role !== 'admin') {
      query = query.eq('user_id', req.user?.id);
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the current order to check previous status
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      throw fetchError;
    }

    // Update the order status
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Handle stock adjustments based on status change
    const previousStatus = currentOrder.status;
    
    // If status changed to 'cancelled' and was not previously cancelled, restore stock
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      console.log(`Restoring stock for cancelled order ${id}`);
      
      for (const item of currentOrder.items) {
        // Get current stock
        const { data: product, error: fetchError } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single();

        if (fetchError) {
          console.error('Error fetching product stock:', fetchError);
          continue;
        }

        // Restore stock
        const { error: stockError } = await supabaseAdmin
          .from('products')
          .update({ 
            stock: product.stock + item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId);

        if (stockError) {
          console.error('Stock restoration error:', stockError);
        } else {
          console.log(`Restored ${item.quantity} units of product ${item.productId}`);
        }
      }
    }
    // If status changed from 'cancelled' to another status, reduce stock again
    else if (previousStatus === 'cancelled' && status !== 'cancelled') {
      console.log(`Reducing stock for order ${id} reactivated from cancelled status`);
      
      for (const item of currentOrder.items) {
        // Get current stock
        const { data: product, error: fetchError } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single();

        if (fetchError) {
          console.error('Error fetching product stock:', fetchError);
          continue;
        }

        // Check if sufficient stock
        if (product.stock < item.quantity) {
          console.error(`Insufficient stock for product ${item.productId}. Available: ${product.stock}, Required: ${item.quantity}`);
          continue;
        }

        // Reduce stock
        const { error: stockError } = await supabaseAdmin
          .from('products')
          .update({ 
            stock: product.stock - item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId);

        if (stockError) {
          console.error('Stock reduction error:', stockError);
        } else {
          console.log(`Reduced ${item.quantity} units of product ${item.productId}`);
        }
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const getOrderAnalytics = async (req: Request, res: Response) => {
  try {
    // Get total orders count
    const { count: totalOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Get total revenue
    const { data: revenueData } = await supabaseAdmin
      .from('orders')
      .select('total')
      .neq('status', 'cancelled');

    const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total, 0) || 0;

    // Get orders by status
    const { data: statusData } = await supabaseAdmin
      .from('orders')
      .select('status');

    // Get recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    res.json({
      totalOrders: totalOrders || 0,
      totalRevenue,
      recentOrders: recentOrders || 0,
      ordersByStatus: statusData || []
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the order first to check if we need to restore stock
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Order not found' });
      }
      throw fetchError;
    }

    // If order was not cancelled, restore stock before deleting
    if (order.status !== 'cancelled') {
      console.log(`Restoring stock for deleted order ${id}`);
      
      for (const item of order.items) {
        // Get current stock
        const { data: product, error: fetchError } = await supabaseAdmin
          .from('products')
          .select('stock')
          .eq('id', item.productId)
          .single();

        if (fetchError) {
          console.error('Error fetching product stock:', fetchError);
          continue;
        }

        // Restore stock
        const { error: stockError } = await supabaseAdmin
          .from('products')
          .update({ 
            stock: product.stock + item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId);

        if (stockError) {
          console.error('Stock restoration error:', stockError);
        } else {
          console.log(`Restored ${item.quantity} units of product ${item.productId}`);
        }
      }
    }

    // Delete the order
    const { error } = await supabaseAdmin
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
};