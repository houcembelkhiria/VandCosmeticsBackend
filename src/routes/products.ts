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
import { blockWhenManagedByAuditflow } from '../integrations/auditflow';

const router = Router();

// Public routes
router.get('/categories', getCategories);
router.get('/', validateProductFilters, getProducts);
router.get('/:id', validateSlugOrId, getProduct);

// Admin routes
router.post('/upload', authenticateToken, requireAdmin, blockWhenManagedByAuditflow, uploadMiddleware, handleUploadError, uploadProductImages);
router.post('/', authenticateToken, requireAdmin, blockWhenManagedByAuditflow, validateProduct, createProduct);
router.put('/:id', authenticateToken, requireAdmin, blockWhenManagedByAuditflow, validateObjectId, validateProductUpdate, updateProduct);
router.delete('/:id', authenticateToken, requireAdmin, blockWhenManagedByAuditflow, validateObjectId, deleteProduct);

export default router;
