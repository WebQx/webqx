/**
 * WebQX Healthcare Platform - Patient API Lambda Function
 * Handles patient portal API requests
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const PATIENTS_TABLE = process.env.PATIENTS_TABLE;
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;
const MEDICAL_RECORDS_TABLE = process.env.MEDICAL_RECORDS_TABLE;
const AUDIT_LOGS_TABLE = process.env.AUDIT_LOGS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        // CORS headers
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        };

        // Handle preflight OPTIONS request
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'CORS preflight successful' })
            };
        }

        // Extract path and method
        const { httpMethod, path, pathParameters, queryStringParameters, body } = event;
        const requestId = context.awsRequestId;
        
        // Log audit event
        await logAuditEvent(requestId, 'API_REQUEST', {
            method: httpMethod,
            path: path,
            timestamp: new Date().toISOString()
        });

        // Route requests
        let response;
        switch (httpMethod) {
            case 'GET':
                response = await handleGetRequest(pathParameters, queryStringParameters);
                break;
            case 'POST':
                response = await handlePostRequest(JSON.parse(body || '{}'));
                break;
            case 'PUT':
                response = await handlePutRequest(pathParameters, JSON.parse(body || '{}'));
                break;
            case 'DELETE':
                response = await handleDeleteRequest(pathParameters);
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${httpMethod}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Error:', error);
        
        // Log error to audit
        await logAuditEvent(context.awsRequestId, 'API_ERROR', {
            error: error.message,
            timestamp: new Date().toISOString()
        });

        return {
            statusCode: error.statusCode || 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: error.message || 'Internal server error',
                requestId: context.awsRequestId
            })
        };
    }
};

/**
 * Handle GET requests
 */
async function handleGetRequest(pathParameters, queryStringParameters) {
    const { proxy } = pathParameters || {};
    
    if (!proxy) {
        return {
            message: 'WebQX Healthcare Platform - Patient API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            endpoints: [
                'GET /patient/profile/{patient_id}',
                'GET /patient/appointments/{patient_id}',
                'GET /patient/records/{patient_id}',
                'POST /patient/appointment',
                'PUT /patient/profile/{patient_id}'
            ]
        };
    }

    const pathSegments = proxy.split('/');
    const [resource, patientId, subResource] = pathSegments;

    switch (resource) {
        case 'profile':
            return await getPatientProfile(patientId);
        case 'appointments':
            return await getPatientAppointments(patientId);
        case 'records':
            return await getPatientRecords(patientId, queryStringParameters);
        default:
            throw new Error(`Unknown resource: ${resource}`);
    }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(requestBody) {
    // Implement POST logic here
    return {
        message: 'POST request processed',
        data: requestBody,
        timestamp: new Date().toISOString()
    };
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(pathParameters, requestBody) {
    // Implement PUT logic here
    return {
        message: 'PUT request processed',
        pathParameters,
        data: requestBody,
        timestamp: new Date().toISOString()
    };
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(pathParameters) {
    // Implement DELETE logic here
    return {
        message: 'DELETE request processed',
        pathParameters,
        timestamp: new Date().toISOString()
    };
}

/**
 * Get patient profile
 */
async function getPatientProfile(patientId) {
    if (!patientId) {
        throw new Error('Patient ID is required');
    }

    const params = {
        TableName: PATIENTS_TABLE,
        Key: { patient_id: patientId }
    };

    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
        const error = new Error('Patient not found');
        error.statusCode = 404;
        throw error;
    }

    // Remove sensitive fields before returning
    const { ssn, ...patientData } = result.Item;
    
    return {
        patient: patientData,
        timestamp: new Date().toISOString()
    };
}

/**
 * Get patient appointments
 */
async function getPatientAppointments(patientId) {
    if (!patientId) {
        throw new Error('Patient ID is required');
    }

    const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'PatientAppointments-Index',
        KeyConditionExpression: 'patient_id = :patient_id',
        ExpressionAttributeValues: {
            ':patient_id': patientId
        },
        ScanIndexForward: false  // Sort by date descending
    };

    const result = await dynamodb.query(params).promise();
    
    return {
        appointments: result.Items || [],
        count: result.Count,
        timestamp: new Date().toISOString()
    };
}

/**
 * Get patient medical records
 */
async function getPatientRecords(patientId, queryParams) {
    if (!patientId) {
        throw new Error('Patient ID is required');
    }

    const params = {
        TableName: MEDICAL_RECORDS_TABLE,
        IndexName: 'PatientRecords-Index',
        KeyConditionExpression: 'patient_id = :patient_id',
        ExpressionAttributeValues: {
            ':patient_id': patientId
        },
        ScanIndexForward: false  // Sort by date descending
    };

    // Add filters based on query parameters
    if (queryParams?.record_type) {
        params.FilterExpression = 'resource_type = :record_type';
        params.ExpressionAttributeValues[':record_type'] = queryParams.record_type;
    }

    if (queryParams?.limit) {
        params.Limit = parseInt(queryParams.limit);
    }

    const result = await dynamodb.query(params).promise();
    
    return {
        records: result.Items || [],
        count: result.Count,
        lastEvaluatedKey: result.LastEvaluatedKey,
        timestamp: new Date().toISOString()
    };
}

/**
 * Log audit event for HIPAA compliance
 */
async function logAuditEvent(requestId, action, details) {
    try {
        const auditEvent = {
            log_id: uuidv4(),
            timestamp: new Date().toISOString(),
            request_id: requestId,
            action_type: action,
            service: 'patient-api',
            details: details,
            ttl: Math.floor(Date.now() / 1000) + (2555 * 24 * 60 * 60)  // 7 years
        };

        const params = {
            TableName: AUDIT_LOGS_TABLE,
            Item: auditEvent
        };

        await dynamodb.put(params).promise();
    } catch (error) {
        console.error('Failed to log audit event:', error);
        // Don't throw here to avoid breaking the main request
    }
}