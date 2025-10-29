import { Router } from 'express';
import { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart 
} from '../controllers/cartController';
import { authenticateToken } from '../middleware/auth';
import { validateObjectId } from '../middleware/validation';

const router = Router();

// All cart routes require authentication
router.use(authenticateToken);

router.get('/', getCart);
router.post('/', addToCart);
router.put('/:itemId', validateObjectId, updateCartItem);
router.delete('/:itemId', validateObjectId, removeFromCart);
router.delete('/', clearCart);

export default router;
