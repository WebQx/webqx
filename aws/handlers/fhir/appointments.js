/**
 * AWS Lambda Handler for FHIR Appointment Resources
 * HIPAA-compliant appointment scheduling and management with DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.APPOINTMENTS_TABLE || process.env.TABLE_NAME;

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
 * Validate FHIR Appointment resource
 */
function validateAppointment(appointment) {
  if (!appointment.resourceType || appointment.resourceType !== 'Appointment') {
    return { valid: false, error: 'Resource must be of type Appointment' };
  }
  
  if (!appointment.status) {
    return { valid: false, error: 'Appointment must have a status' };
  }
  
  if (!appointment.start) {
    return { valid: false, error: 'Appointment must have a start time' };
  }
  
  if (!appointment.participant || appointment.participant.length === 0) {
    return { valid: false, error: 'Appointment must have at least one participant' };
  }
  
  return { valid: true };
}

/**
 * Generate FHIR-compliant Appointment ID
 */
function generateAppointmentId() {
  return `appointment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract patient and provider IDs from participants
 */
function extractParticipantIds(participants) {
  let patientId = null;
  let providerId = null;
  
  for (const participant of participants) {
    if (participant.actor?.reference) {
      const ref = participant.actor.reference;
      if (ref.startsWith('Patient/')) {
        patientId = ref.replace('Patient/', '');
      } else if (ref.startsWith('Practitioner/')) {
        providerId = ref.replace('Practitioner/', '');
      }
    }
  }
  
  return { patientId, providerId };
}

/**
 * Create audit log entry
 */
async function createAuditLog(action, resourceId, userId, details = {}) {
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: userId || 'system',
    resourceType: 'Appointment',
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
          return await getAppointment(pathParameters.id, userId, { sourceIp, userAgent });
        } else {
          return await searchAppointments(queryStringParameters, userId, { sourceIp, userAgent });
        }

      case 'POST':
        const createData = JSON.parse(body || '{}');
        return await createAppointment(createData, userId, { sourceIp, userAgent });

      case 'PUT':
        if (!pathParameters?.id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify(createOperationOutcome('error', 'required', 'Appointment ID is required for update'))
          };
        }
        const updateData = JSON.parse(body || '{}');
        return await updateAppointment(pathParameters.id, updateData, userId, { sourceIp, userAgent });

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
 * Get single appointment by ID
 */
async function getAppointment(appointmentId, userId, details) {
  try {
    const result = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: appointmentId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Appointment not found'))
      };
    }

    // Create audit log
    await createAuditLog('read', appointmentId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Item)
    };
  } catch (error) {
    console.error('Error getting appointment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to retrieve appointment'))
    };
  }
}

/**
 * Search appointments with query parameters
 */
async function searchAppointments(queryParams, userId, details) {
  try {
    let params = {
      TableName: TABLE_NAME
    };

    // Handle FHIR search parameters
    if (queryParams) {
      const { 
        patient, 
        practitioner,
        date, 
        status, 
        service_type,
        _count = '20',
        _sort 
      } = queryParams;

      params.Limit = Math.min(parseInt(_count), 100);

      // Search by patient
      if (patient) {
        const patientId = patient.replace('Patient/', '');
        params = {
          ...params,
          IndexName: 'patientId-appointmentDateTime-index',
          KeyConditionExpression: 'patientId = :patientId',
          ExpressionAttributeValues: {
            ':patientId': patientId
          }
        };

        // Add date range filter if provided
        if (date) {
          const dateCondition = parseDate(date);
          if (dateCondition) {
            params.KeyConditionExpression += ' AND appointmentDateTime BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeValues[':startDate'] = dateCondition.start;
            params.ExpressionAttributeValues[':endDate'] = dateCondition.end;
          }
        }

        const result = await dynamoDB.send(new QueryCommand(params));
        return createSearchBundle(result.Items || [], userId, details, queryParams);
      }

      // Search by practitioner
      if (practitioner) {
        const providerId = practitioner.replace('Practitioner/', '');
        params = {
          ...params,
          IndexName: 'providerId-appointmentDateTime-index',
          KeyConditionExpression: 'providerId = :providerId',
          ExpressionAttributeValues: {
            ':providerId': providerId
          }
        };

        // Add date range filter if provided
        if (date) {
          const dateCondition = parseDate(date);
          if (dateCondition) {
            params.KeyConditionExpression += ' AND appointmentDateTime BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeValues[':startDate'] = dateCondition.start;
            params.ExpressionAttributeValues[':endDate'] = dateCondition.end;
          }
        }

        const result = await dynamoDB.send(new QueryCommand(params));
        return createSearchBundle(result.Items || [], userId, details, queryParams);
      }
    }

    // Default scan for all appointments (limited)
    const result = await dynamoDB.send(new ScanCommand(params));
    return createSearchBundle(result.Items || [], userId, details, queryParams);

  } catch (error) {
    console.error('Error searching appointments:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to search appointments'))
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

  if (queryParams?.service_type) {
    filteredItems = filteredItems.filter(item => 
      item.serviceType?.some(st => 
        st.coding?.some(coding => coding.code === queryParams.service_type)
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
      
      if (sortField === 'date' || sortField === 'start' || sortField === 'appointmentDateTime') {
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
  await createAuditLog('search', 'Appointment', userId, { ...details, queryParams });

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
 * Create new appointment
 */
async function createAppointment(appointmentData, userId, details) {
  try {
    const validation = validateAppointment(appointmentData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    const appointmentId = generateAppointmentId();
    const { patientId, providerId } = extractParticipantIds(appointmentData.participant);
    
    const appointment = {
      ...appointmentData,
      id: appointmentId,
      patientId,
      providerId,
      appointmentDateTime: appointmentData.start,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Appointment']
      }
    };

    // Check for scheduling conflicts
    const conflictCheck = await checkSchedulingConflicts(appointment);
    if (conflictCheck.hasConflict) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'conflict', conflictCheck.message))
      };
    }

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: appointment,
      ConditionExpression: 'attribute_not_exists(id)'
    }));

    // Create audit log
    await createAuditLog('create', appointmentId, userId, details);

    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        'Location': `/fhir/Appointment/${appointmentId}`
      },
      body: JSON.stringify(appointment)
    };
  } catch (error) {
    console.error('Error creating appointment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to create appointment'))
    };
  }
}

/**
 * Update existing appointment
 */
async function updateAppointment(appointmentId, appointmentData, userId, details) {
  try {
    const validation = validateAppointment(appointmentData);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'invalid', validation.error))
      };
    }

    // Check if appointment exists
    const existingResult = await dynamoDB.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: appointmentId }
    }));

    if (!existingResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'not-found', 'Appointment not found'))
      };
    }

    const { patientId, providerId } = extractParticipantIds(appointmentData.participant);
    const currentVersion = parseInt(existingResult.Item.meta?.versionId || '0');
    
    const appointment = {
      ...appointmentData,
      id: appointmentId,
      patientId,
      providerId,
      appointmentDateTime: appointmentData.start,
      meta: {
        versionId: (currentVersion + 1).toString(),
        lastUpdated: new Date().toISOString(),
        profile: ['http://hl7.org/fhir/StructureDefinition/Appointment']
      }
    };

    // Check for scheduling conflicts (exclude current appointment)
    const conflictCheck = await checkSchedulingConflicts(appointment, appointmentId);
    if (conflictCheck.hasConflict) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify(createOperationOutcome('error', 'conflict', conflictCheck.message))
      };
    }

    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: appointment
    }));

    // Create audit log
    await createAuditLog('update', appointmentId, userId, details);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(appointment)
    };
  } catch (error) {
    console.error('Error updating appointment:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify(createOperationOutcome('error', 'exception', 'Failed to update appointment'))
    };
  }
}

/**
 * Check for scheduling conflicts
 */
async function checkSchedulingConflicts(appointment, excludeId = null) {
  try {
    const { providerId, appointmentDateTime, end } = appointment;
    const startTime = new Date(appointmentDateTime);
    const endTime = new Date(end || new Date(startTime.getTime() + 30 * 60000)); // Default 30 min

    // Check provider availability
    if (providerId) {
      const providerParams = {
        TableName: TABLE_NAME,
        IndexName: 'providerId-appointmentDateTime-index',
        KeyConditionExpression: 'providerId = :providerId',
        ExpressionAttributeValues: {
          ':providerId': providerId
        }
      };

      const providerAppointments = await dynamoDB.send(new QueryCommand(providerParams));
      
      for (const existing of providerAppointments.Items || []) {
        if (excludeId && existing.id === excludeId) continue;
        if (existing.status === 'cancelled') continue;

        const existingStart = new Date(existing.start || existing.appointmentDateTime);
        const existingEnd = new Date(existing.end || new Date(existingStart.getTime() + 30 * 60000));

        // Check for time overlap
        if (startTime < existingEnd && endTime > existingStart) {
          return {
            hasConflict: true,
            message: `Provider is not available at the requested time. Conflict with appointment ${existing.id}`
          };
        }
      }
    }

    return { hasConflict: false };
  } catch (error) {
    console.error('Error checking scheduling conflicts:', error);
    return { hasConflict: false }; // Allow appointment creation if conflict check fails
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