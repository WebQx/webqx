/**
 * AWS Lambda Handler for FHIR Patient Resources
 * HIPAA-compliant patient data management with DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.PATIENTS_TABLE || process.env.TABLE_NAME;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

/**
 * CORS headers for healthcare API compliance
 */
const corsHeaders = {
  'Content-Type': 'application/fhir+json',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};

/**
 * Create FHIR OperationOutcome for errors
 */
function createOperationOutcome(severity, code, diagnostics) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{
      severity,
      code,
      diagnostics
    }]
  };
}

/**
 * Validate FHIR Patient resource
 */
function validatePatient(patient) {
  if (!patient.resourceType || patient.resourceType !== 'Patient') {
    return { valid: false, error: 'Resource must be of type Patient' };
  }
  
  if (!patient.name || !Array.isArray(patient.name) || patient.name.length === 0) {
    return { valid: false, error: 'Patient must have at least one name' };
  }
  
  return { valid: true };
}

/**
 * Generate FHIR-compliant Patient ID
 */
function generatePatientId() {
  return `patient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Audit log entry for HIPAA compliance
 */
async function createAuditLog(action, resourceId, userId, details = {}) {
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: userId || 'system',
    resourceType: 'Patient',
    resourceId,
    action,
    sourceIp: details.sourceIp,
    userAgent: details.userAgent,
    details,
    ttl: Math.floor(Date.now() / 1000) + (2555 * 24 * 60 * 60) // 7 years HIPAA retention
  };

  try {
    await dynamoDB.send(new PutCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      Item: auditEntry
    }));
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    const { httpMethod, pathParameters, body, requestContext } = event;
    const userId = requestContext?.authorizer?.claims?.sub || 'anonymous';
    const sourceIp = requestContext?.identity?.sourceIp;
    const userAgent = requestContext?.identity?.userAgent;

    // Handle OPTIONS request for CORS
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ''
      };
    }

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.id) {
          return await getPatient(pathParameters.id, userId, { sourceIp, userAgent });
        } else {
          return await searchPatients(event.queryStringParameters, userId, { sourceIp, userAgent });
        }

      case 'POST':
        const createData = JSON.parse(body || '{}');
        return await createPatient(createData, userId, { sourceIp, userAgent });

      case 'PUT':
        if (!pathParameters?.id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify(createOperationOutcome('error', 'required', 'Patient ID is required for update'))
          };
        }
        const updateData = JSON.parse(body || '{}');
        return await updatePatient(pathParameters.id, updateData, userId, { sourceIp, userAgent });

      case 'DELETE':
        if (!pathParameters?.id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify(createOperationOutcome('error', 'required', 'Patient ID is required for delete'))
          };
        }
        return await deletePatient(pathParameters.id, userId, { sourceIp, userAgent });

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify(createOperationOutcome('error', 'not-supported', `Method ${httpMethod} not supported`))
        };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Internal server error'))
    };
  }
};

/**
 * Get single patient by ID
 */
async function getPatient(patientId, userId, details) {
  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: patientId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Patient not found'))
      };
    }

    // Create audit log
    await createAuditLog('read', patientId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting patient:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to retrieve patient'))
    };
  }
}

/**
 * Search patients with query parameters
 */
async function searchPatients(queryParams, userId, details) {
  try {
    let scanParams = {
      TableName: TABLE_NAME
    };

    // Add basic filters based on query parameters
    if (queryParams) {
      const { name, family, given, birthdate, _count = '10' } = queryParams;
      scanParams.Limit = Math.min(parseInt(_count), 100); // Limit to 100 for performance

      // Note: In production, implement proper FHIR search parameters
      // This is a simplified implementation
    }

    const result = await dynamoDB.send(new QueryCommand(scanParams));

    // Create audit log
    await createAuditLog('search', 'Patient', userId, { ...details, queryParams });

    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: result.Items?.length || 0,
      entry: (result.Items || []).map(item => ({
        resource: item,
        search: { mode: 'match' }
      }))
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(bundle)
    };
  } catch (error) {
    console.error('Error searching patients:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to search patients'))
    };
  }
}

/**
 * Create new patient
 */
async function createPatient(patientData, userId, details) {
  try {
    const validation = validatePatient(patientData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    const patientId = generatePatientId();
    const patient = {
      ...patientData,
      id: patientId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
      }
    };

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: patient,
      ConditionExpression: 'attribute_not_exists(id)'
    }));

    // Create audit log
    await createAuditLog('create', patientId, userId, details);

    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        'Location': `/fhir/Patient/${patientId}`
      },
      body: JSON.stringify(patient)
    };
  } catch (error) {
    console.error('Error creating patient:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to create patient'))
    };
  }
}

/**
 * Update existing patient
 */
async function updatePatient(patientId, patientData, userId, details) {
  try {
    const validation = validatePatient(patientData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    // Check if patient exists
    const existingResult = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: patientId }
    }));

    if (!existingResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Patient not found'))
      };
    }

    const currentVersion = parseInt(existingResult.Item.meta?.versionId || '0');
    const patient = {
      ...patientData,
      id: patientId,
      meta: {
        versionId: (currentVersion + 1).toString(),
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
      }
    };

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: patient
    }));

    // Create audit log
    await createAuditLog('update', patientId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(patient)
    };
  } catch (error) {
    console.error('Error updating patient:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to update patient'))
    };
  }
}

/**
 * Delete patient (soft delete for HIPAA compliance)
 */
async function deletePatient(patientId, userId, details) {
  try {
    // Check if patient exists
    const existingResult = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: patientId }
    }));

    if (!existingResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Patient not found'))
      };
    }

    // Soft delete - mark as inactive instead of actual deletion for HIPAA compliance
    const patient = {
      ...existingResult.Item,
      active: false,
      meta: {
        ...existingResult.Item.meta,
        lastUpdated: new Date().toISOString()
      }
    };

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: patient
    }));

    // Create audit log
    await createAuditLog('delete', patientId, userId, details);

    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  } catch (error) {
    console.error('Error deleting patient:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to delete patient'))
    };
  }
}