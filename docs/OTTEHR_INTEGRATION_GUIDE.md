# Ottehr Integration Documentation

## Overview

This document provides comprehensive information about the Ottehr modules integration in the WebQX platform. The integration provides API connectivity for online ordering channels, POS platforms, delivery service providers, and notifications.

## Table of Contents

1. [Features](#features)
2. [Configuration](#configuration)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Service Layer](#service-layer)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

## Features

The Ottehr integration provides the following modules:

- **Order Management**: Create, retrieve, and update orders
- **Notification System**: Send notifications via multiple channels (SMS, email, push, in-app)
- **POS Integration**: Process point-of-sale transactions
- **Delivery Tracking**: Track delivery status and location updates
- **Webhook Support**: Receive real-time updates from Ottehr
- **Health Monitoring**: Service health checks and status monitoring

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# Ottehr Integration
OTTEHR_API_BASE_URL=https://api.ottehr.com
OTTEHR_API_KEY=your_ottehr_api_key
OTTEHR_CLIENT_ID=your_ottehr_client_id
OTTEHR_CLIENT_SECRET=your_ottehr_client_secret
OTTEHR_ENVIRONMENT=sandbox
OTTEHR_WEBHOOK_SECRET=your_ottehr_webhook_secret
OTTEHR_TIMEOUT=30000
OTTEHR_ENABLE_NOTIFICATIONS=true
OTTEHR_ENABLE_ORDERING=true
OTTEHR_ENABLE_POS_INTEGRATION=true
OTTEHR_ENABLE_DELIVERY_TRACKING=true
```

### Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `OTTEHR_API_BASE_URL` | Base URL for Ottehr API | `https://api.ottehr.com` | Yes |
| `OTTEHR_API_KEY` | API key for authentication | - | Yes* |
| `OTTEHR_CLIENT_ID` | OAuth2 client ID | - | Yes* |
| `OTTEHR_CLIENT_SECRET` | OAuth2 client secret | - | Yes* |
| `OTTEHR_ENVIRONMENT` | Environment (sandbox/production) | `sandbox` | No |
| `OTTEHR_WEBHOOK_SECRET` | Secret for webhook validation | - | No |
| `OTTEHR_TIMEOUT` | Request timeout in milliseconds | `30000` | No |
| `OTTEHR_ENABLE_NOTIFICATIONS` | Enable notifications module | `false` | No |
| `OTTEHR_ENABLE_ORDERING` | Enable ordering module | `false` | No |
| `OTTEHR_ENABLE_POS_INTEGRATION` | Enable POS integration | `false` | No |
| `OTTEHR_ENABLE_DELIVERY_TRACKING` | Enable delivery tracking | `false` | No |

*Either API key OR OAuth2 credentials are required.

## Authentication

The integration supports two authentication methods:

### API Key Authentication

Simple and direct authentication using an API key:

```javascript
import { OttehrService } from './services/ottehrService';

const ottehrService = new OttehrService({
  apiKey: 'your_api_key'
});
```

### OAuth2 Client Credentials

For more advanced scenarios requiring scope-based access:

```javascript
import { OttehrService } from './services/ottehrService';

const ottehrService = new OttehrService({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret'
});
```

### Authentication Manager

For advanced token management:

```javascript
import { createOttehrAuthManager } from './auth/ottehr';

const authManager = createOttehrAuthManager({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  autoRefresh: true
});

// Authenticate
const result = await authManager.authenticateWithClientCredentials(['ordering', 'notifications']);

// Get valid token
const token = await authManager.getValidToken();
```

## API Endpoints

The integration exposes the following REST API endpoints:

### Health Check
- `GET /api/ottehr/health` - Check service health status

### Order Management
- `POST /api/ottehr/orders` - Create a new order
- `GET /api/ottehr/orders/:orderId` - Get order by ID
- `PATCH /api/ottehr/orders/:orderId/status` - Update order status

### Notifications
- `POST /api/ottehr/notifications` - Send notification
- `GET /api/ottehr/notifications/:notificationId` - Get notification status

### POS Transactions
- `POST /api/ottehr/pos/transactions` - Process POS transaction

### Delivery Tracking
- `GET /api/ottehr/deliveries/track/:orderId` - Track delivery by order ID
- `PATCH /api/ottehr/deliveries/:deliveryId/status` - Update delivery status

### Webhooks
- `POST /api/ottehr/webhooks` - Webhook endpoint for Ottehr events

### Configuration
- `GET /api/ottehr/config` - Get service configuration (read-only)

## Service Layer

### OttehrService Class

The main service class provides all integration functionality:

```javascript
import { OttehrService } from './services/ottehrService';

const ottehrService = new OttehrService({
  apiBaseUrl: 'https://api.ottehr.com',
  apiKey: 'your_api_key',
  enableOrdering: true,
  enableNotifications: true
});

// Authenticate
await ottehrService.authenticate();

// Create an order
const order = await ottehrService.createOrder({
  customerId: 'customer_123',
  items: [
    {
      productId: 'product_1',
      name: 'Test Product',
      quantity: 2,
      unitPrice: 10.00,
      totalPrice: 20.00
    }
  ],
  totalAmount: 20.00,
  currency: 'USD'
});
```

### Event Handling

The service emits events for various operations:

```javascript
ottehrService.on('orderCreated', (order) => {
  console.log('Order created:', order.id);
});

ottehrService.on('notificationSent', (notification) => {
  console.log('Notification sent:', notification.id);
});

ottehrService.on('deliveryStatusUpdated', ({ deliveryId, status }) => {
  console.log(`Delivery ${deliveryId} status updated to ${status}`);
});
```

## Usage Examples

### Creating an Order

```javascript
const orderData = {
  customerId: 'customer_123',
  items: [
    {
      productId: 'medication_1',
      name: 'Prescription Medicine',
      quantity: 1,
      unitPrice: 25.99,
      totalPrice: 25.99
    }
  ],
  totalAmount: 25.99,
  currency: 'USD',
  deliveryAddress: {
    street1: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    postalCode: '12345',
    country: 'US'
  }
};

const result = await ottehrService.createOrder(orderData);
if (result.success) {
  console.log('Order created:', result.data.id);
} else {
  console.error('Order creation failed:', result.error.message);
}
```

### Sending a Notification

```javascript
const notification = {
  type: 'order_update',
  recipientId: 'customer_123',
  title: 'Order Ready for Pickup',
  message: 'Your prescription is ready for pickup at the pharmacy.',
  channels: ['email', 'sms'],
  data: {
    orderId: 'order_123',
    pickupLocation: 'Main Pharmacy'
  }
};

const result = await ottehrService.sendNotification(notification);
if (result.success) {
  console.log('Notification sent:', result.data.id);
}
```

### Processing a POS Transaction

```javascript
const transaction = {
  amount: 25.99,
  currency: 'USD',
  paymentMethod: 'card',
  customerId: 'customer_123',
  terminalId: 'terminal_001',
  orderId: 'order_123'
};

const result = await ottehrService.processPOSTransaction(transaction);
if (result.success) {
  console.log('Transaction processed:', result.data.id);
}
```

### Tracking a Delivery

```javascript
const deliveryInfo = await ottehrService.trackDelivery('order_123');
if (deliveryInfo.success) {
  console.log('Delivery status:', deliveryInfo.data.status);
  console.log('ETA:', deliveryInfo.data.estimatedDeliveryTime);
}
```

### Handling Webhooks

```javascript
app.post('/api/ottehr/webhooks', async (req, res) => {
  const signature = req.headers['x-ottehr-signature'];
  const result = await ottehrService.processWebhook(req.body, signature);
  
  if (result.success) {
    res.status(200).json({ received: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Listen for webhook events
ottehrService.on('orderWebhook', ({ eventType, data }) => {
  switch (eventType) {
    case 'order.created':
      console.log('New order received:', data.id);
      break;
    case 'order.updated':
      console.log('Order updated:', data.id);
      break;
  }
});
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTH_ERROR` | Authentication failed | Check API key or OAuth credentials |
| `VALIDATION_ERROR` | Request validation failed | Verify request parameters |
| `HTTP_ERROR` | HTTP request failed | Check network connectivity and API status |
| `TIMEOUT_ERROR` | Request timed out | Increase timeout or retry |
| `NETWORK_ERROR` | Network connectivity issue | Check internet connection |
| `CONFIG_ERROR` | Configuration error | Verify environment variables |

### Error Handling Example

```javascript
try {
  const result = await ottehrService.createOrder(orderData);
  if (!result.success) {
    switch (result.error.code) {
      case 'VALIDATION_ERROR':
        console.error('Invalid order data:', result.error.details);
        break;
      case 'AUTH_ERROR':
        console.error('Authentication failed, refreshing token...');
        await ottehrService.authenticate();
        // Retry the operation
        break;
      default:
        console.error('Operation failed:', result.error.message);
    }
  }
} catch (error) {
  console.error('Unexpected error:', error.message);
}
```

## Testing

### Running Tests

```bash
# Run all Ottehr tests
npm test services/__tests__/ottehrService.test.ts
npm test auth/ottehr/__tests__/authManager.test.ts

# Run with coverage
npm run test:coverage
```

### Test Configuration

The tests use mocked HTTP requests and don't require actual Ottehr API credentials:

```javascript
// Test setup example
const ottehrService = new OttehrService({
  apiBaseUrl: 'https://api.ottehr.test',
  apiKey: 'test_api_key',
  enableOrdering: true,
  enableNotifications: true
});
```

### Integration Testing

For integration testing with real Ottehr services:

1. Set up a sandbox account with Ottehr
2. Configure test environment variables
3. Use test data that won't affect production

```javascript
// Integration test configuration
const testConfig = {
  apiBaseUrl: process.env.OTTEHR_TEST_API_BASE_URL,
  apiKey: process.env.OTTEHR_TEST_API_KEY,
  environment: 'sandbox'
};
```

## Troubleshooting

### Common Issues

#### Service Not Available (503)
- **Cause**: Ottehr service not configured
- **Solution**: Check environment variables and ensure at least one authentication method is configured

#### Authentication Failures
- **Cause**: Invalid credentials or expired tokens
- **Solution**: Verify API key or OAuth credentials, check token expiration

#### Module Disabled Errors
- **Cause**: Required module not enabled in configuration
- **Solution**: Set the appropriate `OTTEHR_ENABLE_*` environment variable to `true`

#### Webhook Signature Validation Failures
- **Cause**: Incorrect webhook secret or payload tampering
- **Solution**: Verify `OTTEHR_WEBHOOK_SECRET` matches Ottehr dashboard configuration

### Debug Mode

Enable debug logging by setting the log level:

```javascript
const ottehrService = new OttehrService({
  apiKey: 'your_api_key',
  // Enable verbose logging
});

// Listen for service events
ottehrService.on('error', (error) => {
  console.error('Ottehr service error:', error);
});
```

### Health Monitoring

Monitor service health regularly:

```javascript
const healthCheck = async () => {
  try {
    const health = await ottehrService.getHealthStatus();
    if (health.success) {
      console.log('Service healthy:', health.data.status);
    } else {
      console.error('Service unhealthy:', health.error);
    }
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
};

// Run health check every 5 minutes
setInterval(healthCheck, 5 * 60 * 1000);
```

## Support

For additional support:

1. Check the Ottehr API documentation
2. Review the WebQX platform logs
3. Verify network connectivity to Ottehr services
4. Contact the WebQX development team

## License

This integration is part of the WebQX Healthcare Platform and is licensed under the Apache 2.0 License.