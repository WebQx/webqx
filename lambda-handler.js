const serverlessExpress = require('aws-serverless-express');
const app = require('./server-lambda');

// Create the serverless express server
const server = serverlessExpress.createServer(app);

// Lambda handler function
exports.handler = (event, context) => {
  // Set context to not wait for empty event loop
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Log the incoming event for debugging
  console.log('Incoming event:', JSON.stringify(event, null, 2));
  
  return serverlessExpress.proxy(server, event, context);
};