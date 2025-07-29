# API Documentation

This directory contains comprehensive API documentation for the WebQx EHR system.

## Purpose

Provides complete documentation for all API endpoints, including specifications, examples, authentication requirements, and integration guides for developers.

## Documentation Standards

- **OpenAPI 3.0** - Machine-readable API specifications
- **Interactive Documentation** - Swagger UI for testing endpoints
- **Code Examples** - Sample requests and responses in multiple languages
- **Authentication Guides** - Detailed authentication and authorization instructions
- **SDKs and Libraries** - Client libraries for popular programming languages

## Documentation Structure

### API Specifications
- **openapi.yaml** - Complete OpenAPI 3.0 specification
- **endpoints/** - Individual endpoint documentation
- **schemas/** - Data model definitions and examples
- **responses/** - Standard response formats and error codes

### Integration Guides
- **getting-started.md** - Quick start guide for new developers
- **authentication.md** - Authentication and authorization guide
- **rate-limiting.md** - Rate limiting policies and best practices
- **webhooks.md** - Webhook configuration and event handling
- **pagination.md** - Data pagination and filtering guidelines

### Code Examples
- **javascript/** - JavaScript/Node.js examples
- **python/** - Python integration examples
- **java/** - Java SDK examples
- **curl/** - cURL command examples
- **postman/** - Postman collection for testing

## API Documentation Features

### Interactive Testing
- **Swagger UI** - Live API testing interface
- **Try It Out** - Execute API calls directly from documentation
- **Authentication Testing** - Test with real API credentials
- **Response Validation** - Verify API responses against schemas

### Developer Resources
- **Changelog** - API version history and breaking changes
- **Migration Guides** - Version upgrade instructions
- **Error Handling** - Comprehensive error code documentation
- **Best Practices** - Recommended integration patterns

## Accessing Documentation

### Online Documentation
- **Production API Docs**: https://api.webqx.health/docs
- **Staging API Docs**: https://staging-api.webqx.health/docs
- **Development API Docs**: http://localhost:3000/api/docs

### Local Development
```bash
# Start documentation server
npm run docs:serve

# Generate documentation
npm run docs:build

# Validate OpenAPI spec
npm run docs:validate
```

## Contribution Guidelines

- Update documentation when adding new endpoints
- Include comprehensive examples for all operations
- Validate OpenAPI specifications before committing
- Test all code examples for accuracy
- Follow consistent documentation formatting