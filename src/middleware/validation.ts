import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Product validation
export const validateProduct = [
  body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title is required and must be less than 255 characters'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').trim().isLength({ min: 1 }).withMessage('Category is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('images').isArray().withMessage('Images must be an array'),
  body('images.*').isURL().withMessage('Each image must be a valid URL'),
  handleValidationErrors
];

export const validateProductUpdate = [
  body('title').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Title must be less than 255 characters'),
  body('description').optional().trim().isLength({ min: 1, max: 2000 }).withMessage('Description must be less than 2000 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('category').optional().trim().isLength({ min: 1 }).withMessage('Category is required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*').optional().isURL().withMessage('Each image must be a valid URL'),
  handleValidationErrors
];

// Order validation
export const validateOrder = [
  body('customerEmail').isEmail().withMessage('Valid email is required'),
  body('customerName').trim().isLength({ min: 1, max: 255 }).withMessage('Customer name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').trim().isLength({ min: 1 }).withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be positive'),
  body('items.*.title').trim().isLength({ min: 1 }).withMessage('Item title is required'),
  body('shipping.fullName').trim().isLength({ min: 1, max: 255 }).withMessage('Full name is required'),
  body('shipping.email').isEmail().withMessage('Valid shipping email is required'),
  body('shipping.phone').trim().isLength({ min: 1 }).withMessage('Phone number is required'),
  body('shipping.address').trim().isLength({ min: 1, max: 500 }).withMessage('Address is required'),
  body('shipping.city').trim().isLength({ min: 1, max: 100 }).withMessage('City is required'),
  body('shipping.state').trim().isLength({ min: 1, max: 100 }).withMessage('State is required'),
  body('shipping.zipCode').trim().isLength({ min: 1, max: 20 }).withMessage('ZIP code is required'),
  body('shipping.country').trim().isLength({ min: 1, max: 100 }).withMessage('Country is required'),
  body('subtotal').isFloat({ min: 0 }).withMessage('Subtotal must be positive'),
  body('total').isFloat({ min: 0 }).withMessage('Total must be positive'),
  handleValidationErrors
];

// Auth validation
export const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

export const validateRegister = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Name is required'),
  body('phone').optional().isMobilePhone('ar-TN').withMessage('Valid Tunisian phone number is required'),
  handleValidationErrors
];

// Parameter validation
export const validateObjectId = [
  param('id').trim().isLength({ min: 1 }).withMessage('ID parameter is required'),
  handleValidationErrors
];

export const validateSlugOrId = [
  param('id').trim().isLength({ min: 1 }).withMessage('ID or slug parameter is required'),
  handleValidationErrors
];

// Category validation
export const validateCategory = [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('parent_id').optional().isUUID().withMessage('Parent ID must be a valid UUID'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('is_active').optional().isBoolean().withMessage('Is active must be a boolean'),
  handleValidationErrors
];

export const validateCategoryUpdate = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be less than 100 characters'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('image_url').optional().isURL().withMessage('Image URL must be a valid URL'),
  body('parent_id').optional().isUUID().withMessage('Parent ID must be a valid UUID'),
  body('sort_order').optional().isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  body('is_active').optional().isBoolean().withMessage('Is active must be a boolean'),
  handleValidationErrors
];

// Query validation
export const validateProductFilters = [
  query('category').optional().trim().isLength({ min: 1 }),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('search').optional().trim().isLength({ min: 1 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
