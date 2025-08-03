/**
 * AWS Lambda Handler for Health Check
 * Monitors system health for WebQX Healthcare Platform
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const cloudWatch = new CloudWatchClient({ region: process.env.AWS_REGION });

/**
 * CORS headers
 */
const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Cache-Control': 'no-cache'
};

/**
 * Check DynamoDB table health
 */
async function checkDynamoDBHealth(tableName) {
  try {
    const startTime = Date.now();
    
    // Try to get a non-existent item to test connectivity
    await dynamoDB.send(new GetCommand({
      TableName: tableName,
      Key: { id: 'health-check-probe' }
    }));
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      table: tableName
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      table: tableName
    };
  }
}

/**
 * Send metrics to CloudWatch
 */
async function sendMetrics(healthData) {
  const metrics = [];
  
  // Overall health status
  metrics.push({
    MetricName: 'HealthStatus',
    Value: healthData.status === 'healthy' ? 1 : 0,
    Unit: 'Count',
    Dimensions: [
      {
        Name: 'Service',
        Value: 'WebQX-Healthcare'
      }
    ]
  });

  // Response time
  if (healthData.responseTime) {
    metrics.push({
      MetricName: 'ResponseTime',
      Value: healthData.responseTime,
      Unit: 'Milliseconds',
      Dimensions: [
        {
          Name: 'Service',
          Value: 'WebQX-Healthcare'
        }
      ]
    });
  }

  // Database health for each table
  if (healthData.databases) {
    for (const db of healthData.databases) {
      metrics.push({
        MetricName: 'DatabaseHealth',
        Value: db.status === 'healthy' ? 1 : 0,
        Unit: 'Count',
        Dimensions: [
          {
            Name: 'DatabaseTable',
            Value: db.table
          }
        ]
      });
    }
  }

  try {
    await cloudWatch.send(new PutMetricDataCommand({
      Namespace: 'WebQX/Healthcare',
      MetricData: metrics
    }));
  } catch (error) {
    console.error('Failed to send metrics to CloudWatch:', error);
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Health check event:', JSON.stringify(event, null, 2));
  
  const startTime = Date.now();
  const isScheduledEvent = event.source === 'aws.events';
  
  try {
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    const healthChecks = [];
    
    // Check DynamoDB tables
    const tables = [
      process.env.PATIENTS_TABLE,
      process.env.APPOINTMENTS_TABLE,
      process.env.OBSERVATIONS_TABLE,
      process.env.AUDIT_LOGS_TABLE
    ].filter(Boolean);

    for (const table of tables) {
      const dbHealth = await checkDynamoDBHealth(table);
      healthChecks.push(dbHealth);
    }

    const totalResponseTime = Date.now() - startTime;
    const allHealthy = healthChecks.every(check => check.status === 'healthy');
    
    const healthData = {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      service: 'WebQX Healthcare Platform',
      version: '1.0.0',
      environment: process.env.STAGE || 'dev',
      region: process.env.AWS_REGION,
      databases: healthChecks,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      features: {
        fhir: 'R4',
        telehealth: true,
        aiTranscription: true,
        hipaaCompliant: true,
        auditLogging: true
      }
    };

    // Send metrics to CloudWatch for monitoring
    await sendMetrics(healthData);

    // For scheduled events, log the health check but don't return HTTP response
    if (isScheduledEvent) {
      console.log('Scheduled health check completed:', JSON.stringify(healthData, null, 2));
      return healthData;
    }

    // Return HTTP response for API calls
    const statusCode = allHealthy ? 200 : 503;
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify(healthData, null, 2)
    };

  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      service: 'WebQX Healthcare Platform',
      environment: process.env.STAGE || 'dev'
    };

    // Send error metrics
    await sendMetrics(errorResponse);

    // For scheduled events, return error data
    if (isScheduledEvent) {
      return errorResponse;
    }

    // Return HTTP error response
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify(errorResponse, null, 2)
    };
  }
};