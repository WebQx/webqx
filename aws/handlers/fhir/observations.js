/**
 * AWS Lambda Handler for FHIR Observation Resources
 * HIPAA-compliant lab results and clinical observations with DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.OBSERVATIONS_TABLE || process.env.TABLE_NAME;

/**
 * CORS headers for healthcare API compliance
 */
const corsHeaders = {
  'Content-Type': 'application/fhir+json',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Accept',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Cache-Control': 'no-cache, no-store, must-revalidate'
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
 * Validate FHIR Observation resource
 */
function validateObservation(observation) {
  if (!observation.resourceType || observation.resourceType !== 'Observation') {
    return { valid: false, error: 'Resource must be of type Observation' };
  }
  
  if (!observation.status) {
    return { valid: false, error: 'Observation must have a status' };
  }
  
  if (!observation.code || !observation.code.coding) {
    return { valid: false, error: 'Observation must have a code' };
  }
  
  if (!observation.subject || !observation.subject.reference) {
    return { valid: false, error: 'Observation must have a subject reference' };
  }
  
  return { valid: true };
}

/**
 * Generate FHIR-compliant Observation ID
 */
function generateObservationId() {
  return `observation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create audit log entry
 */
async function createAuditLog(action, resourceId, userId, details = {}) {
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: userId || 'system',
    resourceType: 'Observation',
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
    const { httpMethod, pathParameters, body, queryStringParameters, requestContext } = event;
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
          return await getObservation(pathParameters.id, userId, { sourceIp, userAgent });
        } else {
          return await searchObservations(queryStringParameters, userId, { sourceIp, userAgent });
        }

      case 'POST':
        const createData = JSON.parse(body || '{}');
        return await createObservation(createData, userId, { sourceIp, userAgent });

      case 'PUT':
        if (!pathParameters?.id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify(createOperationOutcome('error', 'required', 'Observation ID is required for update'))
          };
        }
        const updateData = JSON.parse(body || '{}');
        return await updateObservation(pathParameters.id, updateData, userId, { sourceIp, userAgent });

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
 * Get single observation by ID
 */
async function getObservation(observationId, userId, details) {
  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: observationId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Observation not found'))
      };
    }

    // Create audit log
    await createAuditLog('read', observationId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting observation:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to retrieve observation'))
    };
  }
}

/**
 * Search observations with query parameters
 */
async function searchObservations(queryParams, userId, details) {
  try {
    let params = {
      TableName: TABLE_NAME
    };

    // Handle FHIR search parameters
    if (queryParams) {
      const { 
        subject, 
        patient, 
        category, 
        code, 
        date, 
        status, 
        _count = '20',
        _sort,
        _include 
      } = queryParams;

      params.Limit = Math.min(parseInt(_count), 100);

      // Search by patient
      if (subject || patient) {
        const patientRef = subject || patient;
        params = {
          ...params,
          IndexName: 'patientId-effectiveDateTime-index',
          KeyConditionExpression: 'patientId = :patientId',
          ExpressionAttributeValues: {
            ':patientId': patientRef.replace('Patient/', '')
          }
        };

        // Add date range filter if provided
        if (date) {
          const dateCondition = parseDate(date);
          if (dateCondition) {
            params.KeyConditionExpression += ' AND effectiveDateTime BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeValues[':startDate'] = dateCondition.start;
            params.ExpressionAttributeValues[':endDate'] = dateCondition.end;
          }
        }

        const result = await dynamoDB.send(new QueryCommand(params));
        return createSearchBundle(result.Items || [], userId, details, queryParams);
      }

      // Search by category
      if (category) {
        params = {
          ...params,
          IndexName: 'category-effectiveDateTime-index',
          KeyConditionExpression: 'category = :category',
          ExpressionAttributeValues: {
            ':category': category
          }
        };

        const result = await dynamoDB.send(new QueryCommand(params));
        return createSearchBundle(result.Items || [], userId, details, queryParams);
      }
    }

    // Default scan for all observations (limited)
    const result = await dynamoDB.send(new ScanCommand(params));
    return createSearchBundle(result.Items || [], userId, details, queryParams);

  } catch (error) {
    console.error('Error searching observations:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to search observations'))
    };
  }
}

/**
 * Create FHIR search bundle
 */
async function createSearchBundle(items, userId, details, queryParams) {
  // Apply client-side filters for complex searches
  let filteredItems = items;

  if (queryParams?.status) {
    filteredItems = filteredItems.filter(item => item.status === queryParams.status);
  }

  if (queryParams?.category) {
    filteredItems = filteredItems.filter(item => 
      item.category?.some(cat => 
        cat.coding?.some(coding => coding.code === queryParams.category)
      )
    );
  }

  // Sort results
  if (queryParams?._sort) {
    const sortField = queryParams._sort.replace('-', '');
    const sortDesc = queryParams._sort.startsWith('-');
    
    filteredItems.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (sortField === 'date' || sortField === 'effectiveDateTime') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortDesc) {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });
  }

  // Create audit log
  await createAuditLog('search', 'Observation', userId, { ...details, queryParams });

  const bundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    total: filteredItems.length,
    entry: filteredItems.map(item => ({
      resource: item,
      search: { mode: 'match' }
    }))
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(bundle)
  };
}

/**
 * Create new observation
 */
async function createObservation(observationData, userId, details) {
  try {
    const validation = validateObservation(observationData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    const observationId = generateObservationId();
    const observation = {
      ...observationData,
      id: observationId,
      patientId: observationData.subject?.reference?.replace('Patient/', ''),
      category: observationData.category?.[0]?.coding?.[0]?.code || 'laboratory',
      effectiveDateTime: observationData.effectiveDateTime || new Date().toISOString(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
      }
    };

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: observation,
      ConditionExpression: 'attribute_not_exists(id)'
    }));

    // Create audit log
    await createAuditLog('create', observationId, userId, details);

    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        'Location': `/fhir/Observation/${observationId}`
      },
      body: JSON.stringify(observation)
    };
  } catch (error) {
    console.error('Error creating observation:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to create observation'))
    };
  }
}

/**
 * Update existing observation
 */
async function updateObservation(observationId, observationData, userId, details) {
  try {
    const validation = validateObservation(observationData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    // Check if observation exists
    const existingResult = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: observationId }
    }));

    if (!existingResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Observation not found'))
      };
    }

    const currentVersion = parseInt(existingResult.Item.meta?.versionId || '0');
    const observation = {
      ...observationData,
      id: observationId,
      patientId: observationData.subject?.reference?.replace('Patient/', ''),
      category: observationData.category?.[0]?.coding?.[0]?.code || 'laboratory',
      effectiveDateTime: observationData.effectiveDateTime || existingResult.Item.effectiveDateTime,
      meta: {
        versionId: (currentVersion + 1).toString(),
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Observation']
      }
    };

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: observation
    }));

    // Create audit log
    await createAuditLog('update', observationId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(observation)
    };
  } catch (error) {
    console.error('Error updating observation:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to update observation'))
    };
  }
}

/**
 * Parse FHIR date parameter
 */
function parseDate(dateParam) {
  try {
    // Handle different date formats: eq2024-01-01, ge2024-01-01, le2024-12-31
    if (dateParam.startsWith('eq')) {
      const date = dateParam.substring(2);
      return {
        start: `${date}T00:00:00Z`,
        end: `${date}T23:59:59Z`
      };
    } else if (dateParam.startsWith('ge')) {
      const date = dateParam.substring(2);
      return {
        start: `${date}T00:00:00Z`,
        end: '2099-12-31T23:59:59Z'
      };
    } else if (dateParam.startsWith('le')) {
      const date = dateParam.substring(2);
      return {
        start: '1900-01-01T00:00:00Z',
        end: `${date}T23:59:59Z`
      };
    } else {
      // Default to exact date match
      return {
        start: `${dateParam}T00:00:00Z`,
        end: `${dateParam}T23:59:59Z`
      };
    }
  } catch (error) {
    console.error('Error parsing date parameter:', error);
    return null;
  }
}