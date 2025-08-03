const serverlessExpress = require('@vendia/serverless-express');
const app = require('./server');

// Create the serverless express handler
const handler = serverlessExpress({ app });

module.exports = { handler };