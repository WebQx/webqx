# Dicoogle PACS Plugins API Documentation

## Overview

The Dicoogle PACS plugins provide advanced DICOM metadata filtering and indexing capabilities for the WebQX healthcare platform. These plugins integrate seamlessly with WebQX's authentication, authorization, and audit systems.

## Features

### 1. Metadata Filtering Plugin
- **Dynamic DICOM Filtering**: Create complex queries with multiple conditions
- **Logical Operators**: Support for AND, OR, NOT operations
- **Filter Templates**: Pre-built filters for common use cases
- **Performance Optimization**: Caching and query optimization

### 2. Advanced Indexing Plugin
- **Custom Field Indexing**: Index additional DICOM metadata fields
- **Preprocessing Pipelines**: Transform and normalize data before indexing
- **Specialty-Specific Configurations**: Tailored settings for different medical specialties
- **Index Management**: Backup, restore, and optimization capabilities

### 3. WebQX Integration
- **Single Sign-On**: Uses WebQX authentication tokens
- **Role-Based Access Control**: Fine-grained permissions for different user types
- **Audit Logging**: Comprehensive logging for compliance
- **Organization Isolation**: Multi-tenant support

## API Endpoints

### Base URL
```
http://localhost:3000/api/dicoogle
```

### Authentication
All endpoints require a valid WebQX JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### System Endpoints

#### Health Check
```http
GET /health
```
Returns the health status of all plugins and services.

#### Configuration
```http
GET /config
```
*Requires: `pacs:system:monitor` permission*

Returns current system configuration (sensitive data excluded).

#### API Documentation
```http
GET /docs
```
Returns comprehensive API documentation with all available endpoints.

### Filtering Endpoints

#### Get Query Operators
```http
GET /filtering/operators
```
*Requires: `pacs:query:basic` permission*

Returns available query operators (EQUALS, CONTAINS, RANGE, etc.).

#### Get DICOM Tags
```http
GET /filtering/tags
```
*Requires: `pacs:query:basic` permission*

Returns standard DICOM tags available for filtering.

#### Execute Filter Query
```http
POST /filtering/query
```
*Requires: `pacs:query:basic` permission*

Execute a filter query with optional pagination and sorting.

**Request Body:**
```json
{
  "filter": {
    "conditions": [
      {
        "field": "00100020",
        "operator": "EQUALS",
        "value": "PAT123"
      }
    ],
    "logical": "AND"
  },
  "pagination": {
    "page": 1,
    "limit": 50
  },
  "sort": {
    "field": "studyDate",
    "direction": "DESC"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "studyInstanceUID": "1.2.3.4.5.6.7",
      "patientID": "PAT123",
      "patientName": "Doe^John",
      "studyDate": "20240115",
      "modality": "CT"
    }
  ],
  "metadata": {
    "totalCount": 150,
    "pageCount": 3,
    "currentPage": 1,
    "hasNextPage": true,
    "executionTimeMs": 45,
    "cacheHit": false
  }
}
```

#### Advanced Query
```http
POST /filtering/query/advanced
```
*Requires: `pacs:query:advanced` permission*

Execute advanced queries with complex filtering and additional options.

#### Build Simple Filter
```http
POST /filtering/build/simple
```
*Requires: `pacs:query:basic` permission*

Build a simple filter from individual components.

#### Combine Filters
```http
POST /filtering/build/combine
```
*Requires: `pacs:query:advanced` permission*

Combine multiple filters using logical operators.

### Indexing Endpoints

#### Get Indexing Fields
```http
GET /indexing/fields
```
*Requires: `pacs:index:read` permission*

Returns all configured indexing fields, optionally filtered by specialty.

**Query Parameters:**
- `specialty` (optional): Filter fields by medical specialty

#### Update Field Configuration
```http
PUT /indexing/fields/{tag}
```
*Requires: `pacs:index:configure` permission*

Create or update an indexing field configuration.

**Request Body:**
```json
{
  "name": "Protocol Name",
  "dataType": "LO",
  "indexed": true,
  "searchable": true,
  "faceted": true,
  "weight": 0.9,
  "preprocessing": [
    {
      "type": "normalize",
      "enabled": true,
      "order": 1
    }
  ]
}
```

#### Start Full Indexing
```http
POST /indexing/jobs/full
```
*Requires: `pacs:index:manage` permission*

Start a full reindexing job.

**Request Body:**
```json
{
  "batchSize": 100,
  "maxConcurrency": 3,
  "enablePreprocessing": true,
  "forceReindex": false
}
```

#### Get Job Status
```http
GET /indexing/jobs/{jobId}
```
*Requires: `pacs:index:read` permission*

Get the status of an indexing job.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "job_1705123456789_abc123",
    "status": "running",
    "type": "full",
    "progress": {
      "processed": 2500,
      "total": 10000,
      "percentage": 25
    },
    "startTime": "2024-01-15T10:30:00Z",
    "errors": []
  }
}
```

#### Get Index Statistics
```http
GET /indexing/statistics
```
*Requires: `pacs:index:read` permission*

Returns comprehensive index statistics.

## User Roles and Permissions

### Available Roles

- **viewer**: Basic read access to DICOM data
- **technologist**: Upload and manage DICOM files
- **provider**: Clinical access to DICOM data
- **radiologist**: Advanced imaging analysis capabilities
- **admin**: Full system administration

### Permission Matrix

| Permission | Viewer | Technologist | Provider | Radiologist | Admin |
|------------|--------|--------------|----------|-------------|-------|
| `pacs:query:basic` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `pacs:query:advanced` | ✗ | ✓ | ✓ | ✓ | ✓ |
| `pacs:data:upload` | ✗ | ✓ | ✗ | ✗ | ✓ |
| `pacs:index:configure` | ✗ | ✗ | ✗ | ✗ | ✓ |
| `pacs:system:admin` | ✗ | ✗ | ✗ | ✗ | ✓ |

## Error Handling

All API responses follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "requestId": "req_1705123456789_xyz456"
}
```

### Common Error Codes

- `AUTH_TOKEN_MISSING`: No authorization token provided
- `AUTH_TOKEN_INVALID`: Invalid or expired token
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `VALIDATION_ERROR`: Request validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `FILTER_VALIDATION_ERROR`: Invalid filter configuration
- `JOB_NOT_FOUND`: Indexing job not found

## Rate Limiting

API endpoints are rate-limited to ensure system stability:

- **Query endpoints**: 100 requests per 15 minutes
- **Advanced queries**: 50 requests per 15 minutes  
- **Indexing operations**: 5 requests per hour
- **System operations**: 10 requests per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Reset time for rate limit window

## Examples

### Basic Patient Query
```javascript
const response = await fetch('/api/dicoogle/filtering/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filter: {
      conditions: [{
        field: '00100020', // Patient ID
        operator: 'EQUALS',
        value: 'PAT123'
      }],
      logical: 'AND'
    }
  })
});

const data = await response.json();
console.log(data.data); // DICOM study results
```

### Advanced Multi-Condition Query
```javascript
const complexFilter = {
  conditions: [
    {
      field: '00080060', // Modality
      operator: 'IN',
      value: ['CT', 'MR']
    },
    {
      field: '00080020', // Study Date
      operator: 'RANGE',
      value: { start: '20240101', end: '20240131' }
    }
  ],
  logical: 'AND'
};

const response = await fetch('/api/dicoogle/filtering/query/advanced', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    filter: complexFilter,
    pagination: { page: 1, limit: 25 },
    sort: { field: 'studyDate', direction: 'DESC' }
  })
});
```

### Start Custom Indexing Job
```javascript
const response = await fetch('/api/dicoogle/indexing/jobs/full', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    batchSize: 50,
    maxConcurrency: 2,
    enablePreprocessing: true
  })
});

const { data } = await response.json();
console.log('Job ID:', data.jobId);
```

## Configuration

### Environment Variables

The Dicoogle plugins can be configured using environment variables:

```bash
# Server Configuration
DICOOGLE_HOST=localhost
DICOOGLE_PORT=8080
DICOOGLE_PROTOCOL=http

# Authentication
DICOOGLE_AUTH_ENABLED=true
DICOOGLE_AUTH_PROVIDER=webqx

# Performance
DICOOGLE_CACHE_ENABLED=true
DICOOGLE_CACHE_PROVIDER=memory
DICOOGLE_MAX_CONCURRENT_QUERIES=10

# Security
DICOOGLE_RBAC_ENABLED=true
DICOOGLE_AUDIT_LOGGING=true
DICOOGLE_RATE_LIMITING=true

# Integration
WEBQX_API_ENDPOINT=http://localhost:3000/api
```

## Support

For technical support and documentation updates, contact the WebQX development team or visit the project repository.