# Paramètres Implementation

## Overview
This document describes the implementation of the parameters table and admin interface for managing system parameters, including delivery fees.

## Database Schema

### Table: `parametres`
Created in `supabase-schema.sql` with the following structure:

```sql
CREATE TABLE IF NOT EXISTS parametres (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'decimal', 'integer', 'boolean', 'json')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Initial Data
Two initial parameters are created:
- `delivery_fee`: Standard delivery fee (5.00 TND)
- `free_delivery_threshold`: Minimum amount for free delivery (50.00 TND)

### Security (Row Level Security)
- **Public Read**: Anyone can view active parameters
- **Admin Write**: Only admins can create, update, or delete parameters

## Backend Implementation

### Files Created/Modified:

1. **`backend/src/controllers/parameterController.ts`**
   - `getParameters()`: Get all parameters (with optional filtering)
   - `getParameter(id)`: Get a specific parameter by ID
   - `getParameterByKey(key)`: Get a parameter by its key (public endpoint)
   - `createParameter()`: Create a new parameter (admin only)
   - `updateParameter()`: Update an existing parameter (admin only)
   - `deleteParameter()`: Delete a parameter (admin only)

2. **`backend/src/routes/parameters.ts`**
   - Public GET routes for reading parameters
   - Admin POST, PUT, DELETE routes with authentication middleware

3. **`backend/src/server.ts`**
   - Added parameter routes: `app.use('/api/parameters', parameterRoutes)`

### API Endpoints:

```
GET    /api/parameters           - Get all parameters (public)
GET    /api/parameters/:id       - Get parameter by ID (public)
GET    /api/parameters/key/:key  - Get parameter by key (public)
POST   /api/parameters           - Create parameter (admin)
PUT    /api/parameters/:id       - Update parameter (admin)
DELETE /api/parameters/:id       - Delete parameter (admin)
```

## Frontend Implementation

### Files Created/Modified:

1. **`vanda-cosmetic/src/api/parameters.ts`**
   - TypeScript interfaces for Parameter data
   - API functions matching backend endpoints

2. **`vanda-cosmetic/src/pages/Admin.tsx`**
   - Added "Paramètres" tab to admin dashboard
   - Table view of all parameters with inline editing
   - Edit/Delete functionality for each parameter
   - Real-time updates using React Query

### Admin Features:

- **View Parameters**: Table showing all system parameters
- **Edit Inline**: Click edit icon to modify value, description, and active status
- **Save Changes**: Save button to persist changes
- **Delete**: Remove parameters with confirmation
- **Type Display**: Shows parameter type (text, decimal, integer, boolean, json)

## Usage Example

### Getting Delivery Fee in Frontend:

```typescript
import { getParameterByKey } from '@/api/parameters';

const deliveryFeeParam = await getParameterByKey('delivery_fee');
const deliveryFee = parseFloat(deliveryFeeParam.value); // 5.00
```

### Getting Free Delivery Threshold:

```typescript
const thresholdParam = await getParameterByKey('free_delivery_threshold');
const threshold = parseFloat(thresholdParam.value); // 50.00
```

## Migration Instructions

1. Run the SQL migration in Supabase:
   ```bash
   # Execute backend/create-parametres-table.sql in Supabase SQL Editor
   ```

2. Restart the backend server (if running):
   ```bash
   cd backend
   npm run dev
   ```

3. Access the admin panel:
   - Navigate to Admin dashboard
   - Click on "Paramètres" tab
   - Manage delivery fees and other system parameters

## Future Enhancements

- Add form to create new parameters from admin interface
- Add validation for parameter values based on type
- Add parameter history/audit logging
- Add import/export functionality for parameters
- Add parameter categories for better organization

