/**
 * @fileoverview Ottehr API Routes
 * 
 * Express routes for Ottehr integration endpoints including orders,
 * notifications, POS transactions, and delivery tracking.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { OttehrService } = require('../../services/ottehrService.js');

const router = express.Router();

// Initialize Ottehr service
let ottehrService;
try {
  ottehrService = new OttehrService({
    apiBaseUrl: process.env.OTTEHR_API_BASE_URL,
    apiKey: process.env.OTTEHR_API_KEY,
    clientId: process.env.OTTEHR_CLIENT_ID,
    clientSecret: process.env.OTTEHR_CLIENT_SECRET,
    environment: process.env.OTTEHR_ENVIRONMENT || 'sandbox',
    webhookSecret: process.env.OTTEHR_WEBHOOK_SECRET,
    enableOrdering: process.env.OTTEHR_ENABLE_ORDERING === 'true',
    enableNotifications: process.env.OTTEHR_ENABLE_NOTIFICATIONS === 'true',
    enablePOSIntegration: process.env.OTTEHR_ENABLE_POS_INTEGRATION === 'true',
    enableDeliveryTracking: process.env.OTTEHR_ENABLE_DELIVERY_TRACKING === 'true'
  });
} catch (error) {
  console.warn('[Ottehr Routes] Failed to initialize Ottehr service:', error.message);
  ottehrService = null;
}

// Middleware to check if Ottehr service is available
const requireOttehrService = (req, res, next) => {
  if (!ottehrService) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Ottehr service is not configured or unavailable'
      }
    });
  }
  next();
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

// Health check endpoint
router.get('/health', requireOttehrService, async (req, res) => {
  try {
    const healthStatus = await ottehrService.getHealthStatus();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        details: error.message
      }
    });
  }
});

// Order Management Routes
router.post('/orders', requireOttehrService, [
  body('customerId').notEmpty().withMessage('Customer ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required for each item'),
  body('items.*.name').notEmpty().withMessage('Product name is required for each item'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('items.*.totalPrice').isFloat({ min: 0 }).withMessage('Total price must be a positive number'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-character code'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.createOrder(req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_CREATION_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/orders/:orderId', requireOttehrService, [
  param('orderId').notEmpty().withMessage('Order ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.getOrder(req.params.orderId);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_RETRIEVAL_FAILED',
        message: error.message
      }
    });
  }
});

router.patch('/orders/:orderId/status', requireOttehrService, [
  param('orderId').notEmpty().withMessage('Order ID is required'),
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'])
    .withMessage('Invalid order status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.updateOrderStatus(req.params.orderId, req.body.status);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_UPDATE_FAILED',
        message: error.message
      }
    });
  }
});

// Notification Routes
router.post('/notifications', requireOttehrService, [
  body('type').isIn(['order_update', 'delivery_status', 'appointment_reminder', 'payment_confirmation', 'system_alert'])
    .withMessage('Invalid notification type'),
  body('recipientId').notEmpty().withMessage('Recipient ID is required'),
  body('title').notEmpty().withMessage('Notification title is required'),
  body('message').notEmpty().withMessage('Notification message is required'),
  body('channels').isArray({ min: 1 }).withMessage('At least one delivery channel is required'),
  body('channels.*').isIn(['sms', 'email', 'push', 'in_app']).withMessage('Invalid delivery channel'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.sendNotification(req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_SEND_FAILED',
        message: error.message
      }
    });
  }
});

router.get('/notifications/:notificationId', requireOttehrService, [
  param('notificationId').notEmpty().withMessage('Notification ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.getNotificationStatus(req.params.notificationId);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_STATUS_FAILED',
        message: error.message
      }
    });
  }
});

// POS Transaction Routes
router.post('/pos/transactions', requireOttehrService, [
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-character code'),
  body('paymentMethod').isIn(['cash', 'card', 'digital_wallet', 'insurance'])
    .withMessage('Invalid payment method'),
  body('customerId').notEmpty().withMessage('Customer ID is required'),
  body('terminalId').notEmpty().withMessage('Terminal ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.processPOSTransaction(req.body);
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'POS_TRANSACTION_FAILED',
        message: error.message
      }
    });
  }
});

// Delivery Tracking Routes
router.get('/deliveries/track/:orderId', requireOttehrService, [
  param('orderId').notEmpty().withMessage('Order ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const result = await ottehrService.trackDelivery(req.params.orderId);
    res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DELIVERY_TRACKING_FAILED',
        message: error.message
      }
    });
  }
});

router.patch('/deliveries/:deliveryId/status', requireOttehrService, [
  param('deliveryId').notEmpty().withMessage('Delivery ID is required'),
  body('status').isIn(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'])
    .withMessage('Invalid delivery status'),
  body('location.latitude').optional().isFloat().withMessage('Invalid latitude'),
  body('location.longitude').optional().isFloat().withMessage('Invalid longitude'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { status, location } = req.body;
    const result = await ottehrService.updateDeliveryStatus(req.params.deliveryId, status, location);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DELIVERY_UPDATE_FAILED',
        message: error.message
      }
    });
  }
});

// Webhook endpoint
router.post('/webhooks', requireOttehrService, async (req, res) => {
  try {
    const signature = req.headers['x-ottehr-signature'] || req.headers['ottehr-signature'] || '';
    const result = await ottehrService.processWebhook(req.body, signature);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_PROCESSING_FAILED',
        message: error.message
      }
    });
  }
});

// Configuration endpoint (read-only, no sensitive data)
router.get('/config', requireOttehrService, (req, res) => {
  try {
    const config = ottehrService.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_RETRIEVAL_FAILED',
        message: error.message
      }
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('[Ottehr Routes] Error:', error);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred'
    }
  });
});

module.exports = router;