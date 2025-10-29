# Category System Implementation

This document explains the new category system that has been implemented for the Vanda Cosmetics eCommerce platform.

## Overview

The category system has been upgraded from a simple string field to a full-featured category table with the following capabilities:

- **Hierarchical categories** (parent-child relationships)
- **Category metadata** (description, image, sort order)
- **Active/inactive status** for category management
- **Full CRUD operations** for admin users
- **Proper database relationships** with foreign keys

## Database Schema

### Categories Table
```sql
CREATE TABLE categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Products Table Update
The products table now references categories via a foreign key:
```sql
ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
```

## API Endpoints

### Categories API (`/api/categories`)

#### Public Endpoints
- `GET /api/categories` - Get all active categories
- `GET /api/categories/:id` - Get a specific category by ID or slug
- `GET /api/categories/:id/products` - Get products in a specific category

#### Admin Endpoints (require authentication)
- `POST /api/categories` - Create a new category
- `PUT /api/categories/:id` - Update a category
- `DELETE /api/categories/:id` - Delete a category

### Products API Updates
- Products now include category information in responses
- Filtering by category supports both category ID and slug
- Product creation/updates now use `category_id` instead of `category` string

## Migration Instructions

### Step 1: Apply Database Migration
Run the migration script in your Supabase SQL editor:
```bash
# Copy the contents of migrate-to-categories.sql and run in Supabase
```

### Step 2: Update Frontend Code
Update your frontend to use the new category system:

1. **API calls**: Update to use `/api/categories` endpoint
2. **Product forms**: Change `category` field to `category_id`
3. **Category display**: Use the new category object structure

### Step 3: Test the Implementation
1. Test category CRUD operations
2. Test product filtering by category
3. Verify category-product relationships

## Sample Category Data

The migration includes these default categories:
- Skincare
- Makeup  
- Fragrance
- Hair Care
- Bath & Body

## Features

### Category Management
- **Create categories** with name, description, and optional image
- **Hierarchical structure** with parent-child relationships
- **Sort ordering** for custom category display order
- **Active/inactive status** for category management
- **Automatic slug generation** from category names

### Product Integration
- **Foreign key relationships** ensure data integrity
- **Cascade delete protection** prevents orphaned products
- **Flexible filtering** by category ID or slug
- **Rich category data** included in product responses

### Security
- **Row Level Security (RLS)** enabled on categories table
- **Public read access** for active categories
- **Admin-only write access** for category management
- **Proper validation** for all category operations

## Usage Examples

### Get All Categories
```javascript
const response = await fetch('/api/categories');
const { categories } = await response.json();
```

### Get Products in a Category
```javascript
const response = await fetch('/api/categories/skincare/products');
const { category, products, pagination } = await response.json();
```

### Create a New Category (Admin)
```javascript
const response = await fetch('/api/categories', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'New Category',
    description: 'Category description',
    sort_order: 10
  })
});
```

### Create a Product with Category
```javascript
const response = await fetch('/api/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: 'Product Name',
    description: 'Product description',
    price: 29.99,
    category_id: 'category-uuid-here',
    stock: 100
  })
});
```

## Backward Compatibility

The system maintains backward compatibility during the transition:
- Old `category` string field is preserved during migration
- Products API continues to work with existing data
- Gradual migration path from string categories to category table

## Next Steps

1. **Apply the migration** to your Supabase database
2. **Update frontend code** to use the new category system
3. **Test thoroughly** in development environment
4. **Deploy to production** when ready
5. **Remove old category column** after migration is complete

## Troubleshooting

### Common Issues
1. **Foreign key errors**: Ensure categories exist before creating products
2. **RLS policy errors**: Verify user has admin role for write operations
3. **Slug conflicts**: Category names must be unique (slugs are auto-generated)

### Support
For issues or questions about the category implementation, refer to the API documentation or contact the development team.
