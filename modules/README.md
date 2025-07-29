# Medical Specialty Modules

This directory contains specialized medical intake modules for the WebQX healthcare platform. Each module implements comprehensive enhancements for error handling, loading states, TypeScript types, accessibility, logging, and maintainability.

## 🏗️ Architecture Overview

All specialty modules follow a consistent architecture pattern:

```
modules/specialty-{name}/
├── components/           # React components (intake forms, widgets)
├── types/               # TypeScript interfaces and types
├── services/            # Business logic and API calls
├── hooks/               # React hooks for state management
├── utils/               # Utility functions and helpers
└── __tests__/           # Test files
```

## 📋 Available Specialties

| Specialty | Icon | Component | Description |
|-----------|------|-----------|-------------|
| **Cardiology** | 💗 | `CardiologyIntake` | Heart and cardiovascular system care |
| **Primary Care** | 🏥 | `PrimaryCareIntake` | Comprehensive primary healthcare services |
| **Neurology** | 🧠 | `NeurologyIntake` | Brain and nervous system conditions |
| **Orthopedics** | 🦴 | `OrthopedicsIntake` | Bone, joint, and muscle care |
| **Pediatrics** | 👶 | `PediatricsIntake` | Children and adolescent healthcare |
| **Radiology** | 📷 | `RadiologyIntake` | Medical imaging and diagnostics |
| **Pulmonology** | 🫁 | `PulmonologyIntake` | Lung and respiratory system care |
| **Endocrinology** | ⚗️ | `EndocrinologyIntake` | Hormones and metabolic disorders |
| **Gastroenterology** | 🫃 | `GastroenterologyIntake` | Digestive system disorders |
| **Dermatology** | 🧴 | `DermatologyIntake` | Skin, hair, and nail conditions |

## ✨ Implementation Standards

All specialty modules implement the following enhancements:

### 1. 🚨 Error Handling
- **Comprehensive Error Management**: Uses standardized `EHRError` interface
- **User-Friendly Messages**: Translates technical errors to patient-friendly language
- **Retry Logic**: Automatic retry for failed network operations
- **Graceful Degradation**: Application continues working even when some features fail

```typescript
// Example error handling
try {
  await submitForm(intakeForm);
  logInteraction('form_submitted_successfully');
} catch (error) {
  logInteraction('form_submission_failed', { error: error.message });
  if (onError) onError(error);
}
```

### 2. ⏳ Loading States
- **Visual Indicators**: Loading overlays and progress bars
- **User Feedback**: Clear messages about what's happening
- **Interaction Management**: Disabled form elements during loading
- **Progress Tracking**: Multi-step form progress indicators

```typescript
// Example loading state management
{loading.isLoading && (
  <div className="loading-overlay" role="status" aria-live="polite">
    <div className="loading-spinner">⏳</div>
    <span>{loading.message || 'Processing...'}</span>
  </div>
)}
```

### 3. 📝 TypeScript Types
- **Explicit Typing**: All functions, props, and state variables have explicit types
- **Specialty-Specific Interfaces**: Custom data structures for each medical specialty
- **Generic Components**: Reusable components with type parameters
- **Strict Type Checking**: No `any` types or implicit type coercion

```typescript
// Example TypeScript interface
export interface CardiologyIntakeData extends IntakeFormData {
  specialtyData: CardiologySpecialtyData;
}

export interface CardiologySpecialtyData {
  cardiovascularSymptoms: CardiovascularSymptoms;
  riskFactors: CardiacRiskFactors;
  vitalSigns: VitalSigns;
}
```

### 4. ♿ Accessibility
- **ARIA Attributes**: Comprehensive labeling and descriptions
- **Semantic HTML**: Proper use of headings, landmarks, and form elements
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Optimized for assistive technologies

```typescript
// Example accessibility implementation
<section 
  className="symptoms-section"
  role="region"
  aria-labelledby="symptoms-heading"
>
  <h3 id="symptoms-heading">Cardiovascular Symptoms</h3>
  <input
    type="checkbox"
    aria-required="true"
    aria-describedby="chest-pain-description"
    aria-label="Chest pain symptom checkbox"
  />
</section>
```

### 5. 📊 Detailed Logging
- **Audit Trail**: Complete log of user interactions
- **Error Tracking**: Detailed error logging with context
- **Performance Monitoring**: Operation timing and success rates
- **User Analytics**: Understanding user behavior and pain points

```typescript
// Example logging implementation
const logInteraction = useCallback((action: string, data?: Record<string, any>) => {
  const logEntry = {
    timestamp: new Date(),
    patientId,
    action,
    data,
    component: 'CardiologyIntake',
    formSection: formSections[currentSection]
  };
  
  console.log('[Cardiology Intake]', logEntry);
}, [patientId, currentSection]);
```

### 6. 📖 Code Comments
- **Function Documentation**: JSDoc comments for all public functions
- **Complex Logic Explanation**: Clear comments for business logic
- **Usage Examples**: Code samples in documentation
- **Maintenance Notes**: Important considerations for future developers

```typescript
/**
 * Update cardiovascular symptoms
 * 
 * This function manages the state of cardiovascular symptoms, ensuring
 * that all changes are logged and validated before updating the form data.
 * 
 * @param symptom - The specific cardiovascular symptom to update
 * @param details - Partial symptom details to merge with existing data
 */
const updateCardiovascularSymptoms = useCallback((
  symptom: keyof CardiovascularSymptoms,
  details: Partial<SymptomDetails>
) => {
  // Implementation with detailed logging and validation
}, [formData, updateFormData, logInteraction]);
```

## 🚀 Usage Examples

### Basic Integration

```typescript
import { CardiologyIntake } from '../modules';

function PatientPortal({ patientId }: { patientId: string }) {
  const handleFormSubmit = (form: IntakeForm) => {
    console.log('Form submitted:', form.id);
  };

  const handleError = (error: EHRError) => {
    console.error('Form error:', error.message);
  };

  return (
    <CardiologyIntake
      patientId={patientId}
      onSubmit={handleFormSubmit}
      onError={handleError}
      showProgress={true}
    />
  );
}
```

### Dynamic Specialty Selection

```typescript
import { SPECIALTY_MODULES, getSpecialtyModule } from '../modules';

function SpecialtySelector({ onSelect }: { onSelect: (specialty: string) => void }) {
  return (
    <div className="specialty-grid">
      {Object.entries(SPECIALTY_MODULES).map(([key, module]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className="specialty-card"
          aria-label={`Select ${module.name} specialty`}
        >
          <span className="specialty-icon">{module.icon}</span>
          <h3>{module.name}</h3>
          <p>{module.description}</p>
        </button>
      ))}
    </div>
  );
}
```

## 🧪 Testing

Each module includes comprehensive tests covering:

- **Accessibility compliance** (ARIA attributes, keyboard navigation)
- **Error handling scenarios** (network failures, validation errors)
- **Loading state management** (visual indicators, interaction blocking)
- **Form interactions** (user input, navigation, submission)
- **TypeScript type safety** (compile-time error checking)

```bash
# Run tests for all specialty modules
npm test -- modules/

# Run tests for specific specialty
npm test -- modules/specialty-cardiology/

# Run accessibility tests
npm test -- --testNamePattern="accessibility"
```

## 🔧 Development Guidelines

### Adding a New Specialty

1. **Use the generator script**:
   ```bash
   /tmp/generate-specialty-module.sh your-specialty-name
   ```

2. **Customize the types** in `types/index.ts` for specialty-specific requirements

3. **Enhance the component** in `components/YourSpecialtyIntake.tsx` with additional form sections

4. **Create tests** in `__tests__/` directory

5. **Update the main index** in `modules/index.ts` to export your new module

### Code Quality Standards

- **ESLint compliance**: All code must pass linting checks
- **TypeScript strict mode**: No type errors or warnings
- **Test coverage**: Minimum 80% code coverage
- **Accessibility audit**: WCAG 2.1 AA compliance
- **Performance**: Lazy loading for large specialty modules

### Documentation Requirements

- **README files**: Each specialty should have its own README
- **API documentation**: JSDoc comments for all public interfaces
- **Usage examples**: Working code samples
- **Migration guides**: When breaking changes are introduced

## 🤝 Contributing

When contributing to specialty modules:

1. Follow the established patterns and standards
2. Include comprehensive tests for new functionality
3. Update documentation for any API changes
4. Ensure accessibility compliance
5. Add appropriate logging for debugging and analytics
6. Use TypeScript strict mode throughout

## 📞 Support

For questions about specialty modules:

- **Technical Issues**: Create an issue in the repository
- **Feature Requests**: Submit a feature request with use cases
- **Documentation**: Contribute to docs by submitting PRs
- **Security**: Report security issues through private channels

---

*This module system ensures consistent, high-quality healthcare applications that prioritize patient safety, accessibility, and developer experience.*