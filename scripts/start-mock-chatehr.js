#!/usr/bin/env node

/**
 * Development Script: Start Mock ChatEHR Server
 * Starts the mock ChatEHR server for local development and testing
 */

const MockChatEHRServer = require('../services/mockChatEHRServer');

const port = process.env.MOCK_CHATEHR_PORT || 4000;
const mockServer = new MockChatEHRServer(port);

console.log('🚀 Starting Mock ChatEHR Server...');
console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${port}`);

mockServer.start().then(() => {
    console.log(`✅ Mock ChatEHR Server is running on port ${port}`);
    console.log(`🌐 Health check: http://localhost:${port}/v1/health`);
    console.log(`📚 API Documentation:`);
    console.log(`   - GET  /v1/health                 - Health check`);
    console.log(`   - POST /v1/consultations          - Create consultation`);
    console.log(`   - GET  /v1/consultations          - List consultations`);
    console.log(`   - PUT  /v1/consultations/:id      - Update consultation`);
    console.log(`   - GET  /v1/appointments           - List appointments`);
    console.log(`   - POST /v1/appointments           - Create appointment`);
    console.log(`   - POST /v1/messages               - Send message`);
    console.log(`   - GET  /v1/messages               - Get messages`);
    console.log('');
    console.log('📊 Test Data Available:');
    console.log('   - 2 sample consultations');
    console.log('   - 2 sample appointments');
    console.log('   - Sample messages for consultation-1');
    console.log('');
    console.log('🔧 To configure WebQx to use this mock server:');
    console.log(`   Set CHATEHR_API_URL=http://localhost:${port}/v1`);
    console.log('   Set MOCK_CHATEHR_ENABLED=true');
    console.log('');
    console.log('⏹️  Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Mock ChatEHR Server...');
    await mockServer.stop();
    console.log('✅ Mock ChatEHR Server stopped');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Mock ChatEHR Server...');
    await mockServer.stop();
    console.log('✅ Mock ChatEHR Server stopped');
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    await mockServer.stop();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    await mockServer.stop();
    process.exit(1);
});