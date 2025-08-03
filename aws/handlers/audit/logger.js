/**
 * AWS Lambda Handler for Audit Logging
 * HIPAA-compliant audit trail processing and storage
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * Process DynamoDB stream events for audit logging
 */
exports.handler = async (event) => {
  console.log('Audit logging event:', JSON.stringify(event, null, 2));

  try {
    const promises = event.Records.map(record => processRecord(record));
    await Promise.all(promises);
    
    return {
      statusCode: 200,
      processedRecords: event.Records.length
    };
  } catch (error) {
    console.error('Error processing audit logs:', error);
    throw error;
  }
};

/**
 * Process individual DynamoDB stream record
 */
async function processRecord(record) {
  try {
    const { eventName, dynamodb } = record;
    
    // Create audit entry for data changes
    const auditEntry = createAuditEntry(record);
    
    // Store in audit logs table
    await storeAuditLog(auditEntry);
    
    // Store in S3 for long-term retention
    await storeAuditLogInS3(auditEntry);
    
    // Check for security alerts
    await checkSecurityAlerts(auditEntry);
    
    console.log(`Processed audit log for ${eventName} on ${auditEntry.tableName}`);
    
  } catch (error) {
    console.error('Error processing record:', error);
    // Don't throw error to avoid stopping the entire batch
  }
}

/**
 * Create audit entry from DynamoDB stream record
 */
function createAuditEntry(record) {
  const { eventName, eventSourceARN, dynamodb, awsRegion } = record;
  const tableName = eventSourceARN.split('/')[1];
  
  const auditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventName,
    tableName,
    region: awsRegion,
    keys: dynamodb.Keys || {},
    ttl: Math.floor(Date.now() / 1000) + (2555 * 24 * 60 * 60) // 7 years HIPAA retention
  };

  // Add old and new images for INSERT/MODIFY/REMOVE events
  if (dynamodb.OldImage) {
    auditEntry.oldImage = unmarshallDynamoDBData(dynamodb.OldImage);
  }
  
  if (dynamodb.NewImage) {
    auditEntry.newImage = unmarshallDynamoDBData(dynamodb.NewImage);
  }

  // Determine resource type and user from the data
  if (auditEntry.newImage || auditEntry.oldImage) {
    const resourceData = auditEntry.newImage || auditEntry.oldImage;
    
    // Extract resource type
    if (resourceData.resourceType) {
      auditEntry.resourceType = resourceData.resourceType;
    } else if (tableName.includes('patient')) {
      auditEntry.resourceType = 'Patient';
    } else if (tableName.includes('appointment')) {
      auditEntry.resourceType = 'Appointment';
    } else if (tableName.includes('observation')) {
      auditEntry.resourceType = 'Observation';
    } else if (tableName.includes('telehealth')) {
      auditEntry.resourceType = 'TelehealthSession';
    }
    
    // Extract user information
    if (resourceData.userId) {
      auditEntry.userId = resourceData.userId;
    } else if (resourceData.metadata?.createdBy) {
      auditEntry.userId = resourceData.metadata.createdBy;
    } else if (resourceData.meta?.author) {
      auditEntry.userId = resourceData.meta.author;
    }
    
    // Extract patient ID for PHI tracking
    if (resourceData.patientId) {
      auditEntry.patientId = resourceData.patientId;
    } else if (resourceData.subject?.reference) {
      auditEntry.patientId = resourceData.subject.reference.replace('Patient/', '');
    }
  }

  // Add change summary
  auditEntry.changeSummary = createChangeSummary(eventName, auditEntry.oldImage, auditEntry.newImage);

  return auditEntry;
}

/**
 * Create human-readable change summary
 */
function createChangeSummary(eventName, oldImage, newImage) {
  const changes = [];
  
  switch (eventName) {
    case 'INSERT':
      changes.push('Record created');
      if (newImage?.status) {
        changes.push(`Status: ${newImage.status}`);
      }
      break;
      
    case 'MODIFY':
      if (oldImage && newImage) {
        // Compare key fields
        const keyFields = ['status', 'active', 'name', 'birthDate', 'start', 'end'];
        
        for (const field of keyFields) {
          if (oldImage[field] !== newImage[field]) {
            changes.push(`${field}: ${oldImage[field]} → ${newImage[field]}`);
          }
        }
        
        // Check for version changes
        if (oldImage.meta?.versionId !== newImage.meta?.versionId) {
          changes.push(`Version: ${oldImage.meta?.versionId} → ${newImage.meta?.versionId}`);
        }
      }
      break;
      
    case 'REMOVE':
      changes.push('Record deleted');
      if (oldImage?.status) {
        changes.push(`Final status: ${oldImage.status}`);
      }
      break;
  }
  
  return changes.length > 0 ? changes.join(', ') : 'No significant changes detected';
}

/**
 * Store audit log in DynamoDB audit table
 */
async function storeAuditLog(auditEntry) {
  try {
    await dynamoDB.send(new PutCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      Item: auditEntry
    }));
  } catch (error) {
    console.error('Failed to store audit log in DynamoDB:', error);
    throw error;
  }
}

/**
 * Store audit log in S3 for long-term retention
 */
async function storeAuditLogInS3(auditEntry) {
  try {
    const date = new Date(auditEntry.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const s3Key = `audit-logs/${year}/${month}/${day}/${auditEntry.id}.json`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AUDIT_LOGS_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(auditEntry, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: process.env.KMS_KEY_ID,
      Metadata: {
        'resource-type': auditEntry.resourceType || 'unknown',
        'event-name': auditEntry.eventName,
        'table-name': auditEntry.tableName,
        'timestamp': auditEntry.timestamp
      }
    }));
    
    console.log(`Audit log stored in S3: ${s3Key}`);
  } catch (error) {
    console.error('Failed to store audit log in S3:', error);
    // Don't throw error - S3 storage is secondary to DynamoDB
  }
}

/**
 * Check for security alerts and suspicious activities
 */
async function checkSecurityAlerts(auditEntry) {
  try {
    const alerts = [];
    
    // Check for suspicious patterns
    if (await checkRapidFireAccess(auditEntry)) {
      alerts.push('Rapid-fire access pattern detected');
    }
    
    if (await checkUnusualAccessTime(auditEntry)) {
      alerts.push('Access outside normal business hours');
    }
    
    if (await checkMassDataAccess(auditEntry)) {
      alerts.push('Mass data access pattern detected');
    }
    
    if (checkSensitiveDataChange(auditEntry)) {
      alerts.push('Sensitive healthcare data modified');
    }
    
    // Store security alerts
    if (alerts.length > 0) {
      await storeSecurityAlert(auditEntry, alerts);
    }
    
  } catch (error) {
    console.error('Error checking security alerts:', error);
    // Don't throw error - security checking is best-effort
  }
}

/**
 * Check for rapid-fire access patterns (potential bot/script activity)
 */
async function checkRapidFireAccess(auditEntry) {
  if (!auditEntry.userId) return false;
  
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const result = await dynamoDB.send(new QueryCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      IndexName: 'userId-timestamp-index',
      KeyConditionExpression: 'userId = :userId AND #timestamp > :timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': auditEntry.userId,
        ':timestamp': fiveMinutesAgo
      }
    }));
    
    // Alert if more than 50 actions in 5 minutes
    return (result.Items?.length || 0) > 50;
  } catch (error) {
    console.error('Error checking rapid-fire access:', error);
    return false;
  }
}

/**
 * Check for unusual access times (outside business hours)
 */
async function checkUnusualAccessTime(auditEntry) {
  const accessTime = new Date(auditEntry.timestamp);
  const hour = accessTime.getHours();
  const dayOfWeek = accessTime.getDay();
  
  // Consider access unusual if:
  // - Between 10 PM and 6 AM (22:00 - 06:00)
  // - Weekends (Saturday=6, Sunday=0)
  return hour >= 22 || hour < 6 || dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Check for mass data access patterns
 */
async function checkMassDataAccess(auditEntry) {
  if (!auditEntry.userId || auditEntry.eventName !== 'INSERT') return false;
  
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const result = await dynamoDB.send(new QueryCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      IndexName: 'userId-timestamp-index',
      KeyConditionExpression: 'userId = :userId AND #timestamp > :timestamp',
      FilterExpression: 'eventName = :eventName',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':userId': auditEntry.userId,
        ':timestamp': oneHourAgo,
        ':eventName': 'INSERT'
      }
    }));
    
    // Alert if more than 100 records accessed in 1 hour
    return (result.Items?.length || 0) > 100;
  } catch (error) {
    console.error('Error checking mass data access:', error);
    return false;
  }
}

/**
 * Check for sensitive healthcare data changes
 */
function checkSensitiveDataChange(auditEntry) {
  const sensitiveFields = [
    'birthDate', 'ssn', 'medicalRecordNumber', 'telecom',
    'address', 'diagnosis', 'medication', 'valueQuantity'
  ];
  
  if (auditEntry.eventName === 'MODIFY' && auditEntry.oldImage && auditEntry.newImage) {
    return sensitiveFields.some(field => {
      return hasFieldChanged(auditEntry.oldImage, auditEntry.newImage, field);
    });
  }
  
  return false;
}

/**
 * Check if a specific field has changed between old and new images
 */
function hasFieldChanged(oldImage, newImage, fieldPath) {
  const oldValue = getNestedValue(oldImage, fieldPath);
  const newValue = getNestedValue(newImage, fieldPath);
  return JSON.stringify(oldValue) !== JSON.stringify(newValue);
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Store security alert
 */
async function storeSecurityAlert(auditEntry, alerts) {
  const alertEntry = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    alertType: 'SECURITY_AUDIT',
    severity: 'HIGH',
    userId: auditEntry.userId,
    resourceType: auditEntry.resourceType,
    tableName: auditEntry.tableName,
    alerts,
    relatedAuditId: auditEntry.id,
    status: 'OPEN',
    ttl: Math.floor(Date.now() / 1000) + (2555 * 24 * 60 * 60) // 7 years retention
  };
  
  try {
    await dynamoDB.send(new PutCommand({
      TableName: process.env.AUDIT_LOGS_TABLE,
      Item: alertEntry
    }));
    
    console.log(`Security alert created: ${alertEntry.id}`, alerts);
  } catch (error) {
    console.error('Failed to store security alert:', error);
  }
}

/**
 * Unmarshall DynamoDB attribute values to JavaScript objects
 */
function unmarshallDynamoDBData(data) {
  if (!data) return null;
  
  const result = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value.S !== undefined) {
      result[key] = value.S;
    } else if (value.N !== undefined) {
      result[key] = Number(value.N);
    } else if (value.BOOL !== undefined) {
      result[key] = value.BOOL;
    } else if (value.NULL !== undefined) {
      result[key] = null;
    } else if (value.L !== undefined) {
      result[key] = value.L.map(item => unmarshallDynamoDBData({ temp: item }).temp);
    } else if (value.M !== undefined) {
      result[key] = unmarshallDynamoDBData(value.M);
    } else if (value.SS !== undefined) {
      result[key] = value.SS;
    } else if (value.NS !== undefined) {
      result[key] = value.NS.map(Number);
    } else if (value.BS !== undefined) {
      result[key] = value.BS;
    }
  }
  
  return result;
}