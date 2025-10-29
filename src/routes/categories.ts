import { Router } from 'express';
import { 
  getCategories, 
  getCategory, 
  createCategory, 
  updateCategory, 
  deleteCategory,
  getCategoryProducts
} from '../controllers/categoryController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateCategory, validateCategoryUpdate, validateObjectId } from '../middleware/validation';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', validateObjectId, getCategory);
router.get('/:id/products', validateObjectId, getCategoryProducts);

// Admin routes
router.post('/', authenticateToken, requireAdmin, validateCategory, createCategory);
router.put('/:id', authenticateToken, requireAdmin, validateObjectId, validateCategoryUpdate, updateCategory);
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId, deleteCategory);

export default router;
