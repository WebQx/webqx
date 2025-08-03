const serverlessExpress = require('@codegenie/serverless-express');
const app = require('./server-lambda');

// Lambda handler
exports.handler = serverlessExpress({ app });