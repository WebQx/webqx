# WebQX™ Modules Directory

This directory serves as the home for specialty-specific clinical modules and transcription services in the WebQX healthcare platform. It provides a modular architecture that enables scalable addition of new medical specialties and transcription capabilities.

## 🎯 Purpose

The `modules/` directory is designed to:

- **Modularize specialty care**: Each medical specialty has its own self-contained module with dedicated services, types, and components
- **Enable transcription services**: Provide specialized transcription modules tailored to different medical contexts
- **Ensure scalability**: Support easy addition of new specialties and services without affecting existing modules
- **Maintain consistency**: Follow standardized patterns for module structure and integration
- **Support interoperability**: Integrate seamlessly with the core WebQX platform and other modules

## 📁 Directory Structure

Each module follows a consistent structure to ensure maintainability and ease of development:

```
modules/
├── README.md                           # This file - module directory overview
├── {specialty-name}/                   # Specialty-specific module directory
│   ├── README.md                       # Module-specific documentation
│   ├── index.ts                        # Main module export file
│   ├── config/                         # Configuration files
│   │   └── {specialty}.config.ts       # Module configuration
│   ├── services/                       # Business logic and API services
│   │   ├── {specialty}Service.ts       # Main service class
│   │   └── {additional}Service.ts      # Additional services as needed
│   ├── types/                          # TypeScript type definitions
│   │   └── index.ts                    # Type exports
│   ├── components/                     # React components (if applicable)
│   │   ├── {Component}.tsx             # Specialty-specific UI components
│   │   └── {AnotherComponent}.tsx      # Additional components
│   ├── routes/                         # API routes (if applicable)
│   │   └── {specialty}.ts              # REST API endpoints
│   ├── utils/                          # Utility functions
│   │   └── {specialty}Validation.ts    # Validation helpers
│   └── __tests__/                      # Test files
│       ├── services/                   # Service tests
│       ├── components/                 # Component tests
│       └── utils/                      # Utility tests
└── transcription-{service}/            # Transcription service modules
    ├── README.md                       # Transcription module documentation
    ├── index.ts                        # Main transcription export
    ├── services/                       # Transcription services
    ├── types/                          # Transcription-specific types
    └── __tests__/                      # Transcription tests
```

## 🏥 Current Modules

### Specialty Modules

#### `postdicom/` - Medical Imaging Integration
- **Purpose**: PostDICOM integration for advanced medical imaging capabilities
- **Features**: Cloud storage, API-driven imaging access, RBAC, performance optimization
- **Integration**: WebQX dashboard integration with patient portal and admin console
- **Documentation**: [PostDICOM Module README](./postdicom/README.md)

#### `specialty-primary-care/` - Primary Care Services
- **Purpose**: Comprehensive primary care management system
- **Features**: Patient management, appointment scheduling, chronic disease management, preventive care
- **Integration**: EHR integration, care gap identification, quality metrics
- **Documentation**: See module files for implementation details

### Transcription Services

*Currently no dedicated transcription modules - this is an area for future expansion*

## 🚀 Creating New Modules

### 1. Specialty Module Creation

To create a new specialty module (e.g., cardiology):

1. **Create directory structure**:
   ```bash
   mkdir -p modules/specialty-cardiology/{config,services,types,components,routes,utils,__tests__}
   mkdir -p modules/specialty-cardiology/__tests__/{services,components,utils}
   ```

2. **Create main index.ts**:
   ```typescript
   /**
    * Cardiology Specialty Module
    * 
    * Comprehensive cardiology module providing interfaces for cardiac care,
    * cardiovascular assessments, and specialized cardiac workflows.
    * 
    * @author WebQX Health
    * @version 1.0.0
    */
   
   export * from './types';
   export * from './services/cardiologyService';
   export { CardiologyService as default } from './services/cardiologyService';
   ```

3. **Define types** in `types/index.ts`:
   ```typescript
   // Define specialty-specific interfaces
   export interface CardiologyPatient extends BasePatient {
     cardiacHistory?: CardiacHistory;
     riskFactors?: CardiovascularRiskFactor[];
   }
   
   export interface EchocardiogramResult {
     // Specialty-specific types
   }
   ```

4. **Implement main service** in `services/cardiologyService.ts`:
   ```typescript
   export class CardiologyService {
     // Follow the pattern established by PrimaryCareService
     // Include proper error handling, logging, and event emission
   }
   ```

5. **Add configuration** in `config/cardiology.config.ts`:
   ```typescript
   export interface CardiologyConfig {
     // Module-specific configuration options
   }
   ```

6. **Create README.md** documenting the module's purpose, features, and usage

### 2. Transcription Module Creation

To create a transcription service module (e.g., radiology transcription):

1. **Create directory structure**:
   ```bash
   mkdir -p modules/transcription-radiology/{services,types,__tests__}
   ```

2. **Define transcription types**:
   ```typescript
   export interface RadiologicalTranscriptionRequest {
     audioFile: File;
     studyType: 'CT' | 'MRI' | 'X-RAY' | 'ULTRASOUND';
     priority: 'STAT' | 'URGENT' | 'ROUTINE';
   }
   ```

3. **Implement transcription service**:
   ```typescript
   export class RadiologicalTranscriptionService {
     async transcribeStudy(request: RadiologicalTranscriptionRequest): Promise<TranscriptionResult> {
       // Specialty-specific transcription logic
     }
   }
   ```

## 🔧 Integration Guidelines

### Platform Integration

1. **Import in main application**:
   ```typescript
   // In main app
   import { PrimaryCareService } from '../modules/specialty-primary-care';
   import { PostDICOMService } from '../modules/postdicom';
   ```

2. **Register in service registry**:
   ```typescript
   // Services should be registered in the main application
   serviceRegistry.register('primaryCare', new PrimaryCareService(config));
   ```

3. **Add to Jest configuration**: The Jest config already includes the modules directory in test roots and coverage collection.

### Module Communication

- **Event-driven architecture**: Modules should emit events for cross-module communication
- **Shared types**: Common types should be defined in the main platform
- **Service dependencies**: Use dependency injection for service communication

### API Integration

- **Route registration**: Module routes should be registered in the main server
- **Middleware**: Use platform-wide middleware for authentication and validation
- **Error handling**: Follow platform error handling patterns

## 📋 Development Standards

### Code Quality

- **TypeScript**: All modules must be written in TypeScript with proper type definitions
- **Testing**: Minimum 80% test coverage for all services and components
- **Documentation**: Each module must include comprehensive README and inline documentation
- **Linting**: Follow the project's ESLint configuration

### Architecture Patterns

- **Service-oriented**: Each module should have a main service class as the primary interface
- **Event-driven**: Use events for communication between modules and platform
- **Configuration-driven**: Support configurable behavior through config files
- **Error handling**: Implement comprehensive error handling with proper logging

### Performance Considerations

- **Lazy loading**: Modules should support lazy loading when possible
- **Caching**: Implement appropriate caching strategies for data-intensive operations
- **Async operations**: Use async/await for all I/O operations
- **Resource cleanup**: Properly clean up resources and event listeners

## 🏗️ Scalability Considerations

### Adding New Specialties

The modular architecture supports unlimited specialty additions:

- **Independent development**: New specialties can be developed independently
- **Specialty-specific workflows**: Each module can implement unique medical workflows
- **Gradual rollout**: New modules can be deployed and enabled progressively
- **Legacy support**: Existing modules remain unaffected by new additions

### Transcription Service Expansion

Future transcription services can include:

- **Specialty-specific vocabularies**: Medical terminology specific to each specialty
- **Multi-language support**: Transcription in multiple languages
- **Real-time transcription**: Live transcription during patient encounters
- **Quality assurance**: Automated and manual review processes

### Integration Scalability

- **Microservice compatibility**: Modules can be extracted to microservices if needed
- **Load balancing**: Services support horizontal scaling
- **Database isolation**: Each module can have its own data persistence strategy
- **API versioning**: Support for API versioning to maintain backward compatibility

## 🔍 Module Discovery

Modules are automatically discovered through:

1. **Directory scanning**: The platform scans the modules directory
2. **Index exports**: Modules export their capabilities through index.ts
3. **Configuration**: Module registration in platform configuration
4. **Runtime registration**: Dynamic service registration during application startup

## 📚 Resources

- **WebQX Main Documentation**: [README.md](../README.md)
- **FHIR Integration**: [FHIR Documentation](../fhir/)
- **Patient Portal**: [Patient Portal Documentation](../patient-portal/)
- **EHR Integrations**: [EHR Integration Guide](../ehr-integrations/)
- **Testing Guidelines**: [Jest Configuration](../jest.config.js)

## 🤝 Contributing

When contributing new modules:

1. Follow the established directory structure and naming conventions
2. Include comprehensive tests for all functionality
3. Document all public APIs and configuration options
4. Ensure integration with existing platform services
5. Add examples and usage documentation
6. Consider backward compatibility and migration paths

## 📄 License

All modules in this directory are subject to the same license as the main WebQX platform. See [LICENSE.md](../LICENSE.md) for details.