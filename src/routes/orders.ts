import { Router } from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrder, 
  updateOrderStatus,
  getOrderAnalytics,
  deleteOrder
} from '../controllers/orderController';
import { authenticateToken, requireAdmin, optionalAuth } from '../middleware/auth';
import { validateOrder, validateObjectId } from '../middleware/validation';

const router = Router();

// Create order (public, but can be authenticated)
router.post('/', optionalAuth, validateOrder, createOrder);

// Get orders (requires auth)
router.get('/', authenticateToken, getOrders);

// Get specific order (requires auth)
router.get('/:id', authenticateToken, validateObjectId, getOrder);

// Admin routes
router.put('/:id/status', authenticateToken, requireAdmin, validateObjectId, updateOrderStatus);
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId, deleteOrder);
router.get('/admin/analytics', authenticateToken, requireAdmin, getOrderAnalytics);

export default router;
