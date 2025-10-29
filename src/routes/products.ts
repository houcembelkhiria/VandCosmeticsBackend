import { Router } from 'express';
import { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  uploadProductImages,
  getCategories
} from '../controllers/productController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateProduct, validateProductUpdate, validateProductFilters, validateObjectId, validateSlugOrId } from '../middleware/validation';
import { uploadProductImages as uploadMiddleware, handleUploadError } from '../middleware/upload';

const router = Router();

// Public routes
router.get('/categories', getCategories);
router.get('/', validateProductFilters, getProducts);
router.get('/:id', validateSlugOrId, getProduct);

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, uploadMiddleware, handleUploadError, uploadProductImages);
router.post('/', authenticateToken, requireAdmin, validateProduct, createProduct);
router.put('/:id', authenticateToken, requireAdmin, validateObjectId, validateProductUpdate, updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId, deleteProduct);

export default router;
