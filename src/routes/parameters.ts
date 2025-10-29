import { Router } from 'express';
import { 
  getParameters, 
  getParameter, 
  createParameter, 
  updateParameter, 
  deleteParameter,
  getParameterByKey
} from '../controllers/parameterController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { validateObjectId } from '../middleware/validation';

const router = Router();

// Public route to get parameters
router.get('/', getParameters);

// Public route to get a specific parameter by key (useful for getting delivery fee, etc.)
router.get('/key/:key', getParameterByKey);

// Public route to get a parameter by ID
router.get('/:id', validateObjectId, getParameter);

// Admin routes
router.post('/', authenticateToken, requireAdmin, createParameter);
router.put('/:id', authenticateToken, requireAdmin, validateObjectId, updateParameter);
router.delete('/:id', authenticateToken, requireAdmin, validateObjectId, deleteParameter);

export default router;

