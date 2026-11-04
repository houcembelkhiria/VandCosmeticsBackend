// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import orderRoutes from './routes/orders';
import cartRoutes from './routes/cart';
import parameterRoutes from './routes/parameters';
import auditflowRoutes from './routes/auditflow';
import { getAuditflow, startReconcile } from './integrations/auditflow';
import { createWebhookHandler } from './integrations/auditflow/webhook';

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration - MUST be before other middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false // Allow CORS
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  // AuditFlow webhooks come from one address in bursts and are authenticated by signature.
  skip: (req) => req.path === '/api/webhooks/auditflow'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// AuditFlow webhook: needs the raw body (the signature covers the exact bytes), so it is mounted
// before the JSON parser. Inactive (503) unless AUDITFLOW_WEBHOOK_SECRET is set.
const af = getAuditflow();
if (af) {
  app.post('/api/webhooks/auditflow', express.raw({ type: 'application/json', limit: '1mb' }), createWebhookHandler({ client: af.client, store: af.store, secret: af.config.webhookSecret }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/parameters', parameterRoutes);
app.use('/api/admin/auditflow', auditflowRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Vanda backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🔄 AuditFlow: ${af ? af.config.baseUrl : 'disabled'}`);
  startReconcile();
});
