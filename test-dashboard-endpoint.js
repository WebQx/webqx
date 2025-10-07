#!/usr/bin/env node
/**
 * Manual verification script for provider dashboard
 * Demonstrates the dashboard endpoint without requiring full server deployment
 */

const express = require('express');
const app = express();

app.use(express.json());

// Mock authentication middleware for testing
app.use((req, res, next) => {
  req.user = {
    id: 'test-provider-123',
    roles: ['provider'],
    email: 'provider@test.com'
  };
  next();
});

// Mount dashboard routes
const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);

// Start server
const PORT = 3999;
const server = app.listen(PORT, () => {
  console.log(`\n✅ Test server running on http://localhost:${PORT}`);
  console.log(`\n📊 Provider Dashboard Endpoint:`);
  console.log(`   GET http://localhost:${PORT}/api/dashboard/provider\n`);
  console.log(`Test with curl:`);
  console.log(`   curl http://localhost:${PORT}/api/dashboard/provider\n`);
  console.log(`Press Ctrl+C to stop\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Server stopped\n');
    process.exit(0);
  });
});
