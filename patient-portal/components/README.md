# PrescriptionDashboard Component

A comprehensive, accessible, and performant React component for managing patient prescription information in healthcare applications.

## 🎯 Features

### ✅ Accessibility Improvements
- Full ARIA label support with `aria-label`, `aria-labelledby`, `aria-describedby`
- Keyboard navigation for all interactive elements
- Screen reader compatibility with proper roles and descriptions
- Focus management and visual focus indicators
- High contrast mode support
- Reduced motion accessibility

### ✅ Error Handling
- Graceful handling of undefined/empty `patientData`
- User-friendly fallback messages with localization support
- Comprehensive error states with retry functionality
- Network error handling and recovery

### ✅ Loading States
- Skeleton loading animations with accessibility labels
- Loading indicators with proper `aria-busy` attributes
- Performance-optimized loading states
- Non-blocking UI updates

### ✅ Performance Optimizations
- Memoized expensive computations using `useMemo`
- Optimized search and filtering for large datasets
- Callback optimization with `useCallback`
- Efficient re-rendering strategies

### ✅ Localization Fallback
- Complete translation system with default fallbacks
- All text elements support customization
- Graceful degradation when translations are missing
- Internationalization ready

### ✅ Styling Enhancements
- Hover effects and smooth transitions
- Responsive design for all screen sizes
- Professional medical interface design
- CSS-in-JS compatible
- Theme customization support

## 📦 Installation

```bash
# Copy the component files to your project
cp -r patient-portal/components/PrescriptionDashboard.tsx your-project/components/
cp -r patient-portal/components/MedCard.tsx your-project/components/
cp -r patient-portal/types/prescription.ts your-project/types/
cp -r patient-portal/styles/prescription.css your-project/styles/
```

## 🚀 Basic Usage

```tsx
import React from 'react';
import PrescriptionDashboard from './components/PrescriptionDashboard';
import { PatientData, PrescriptionTranslations } from './types/prescription';
import './styles/prescription.css';

const MyApp: React.FC = () => {
  const patientData: PatientData = {
    id: 'patient-123',
    name: 'John Doe',
    medications: [
      {
        id: 'med-1',
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Once daily',
        prescriber: 'Dr. Smith',
        dateIssued: '2024-01-15',
        refillsRemaining: 3,
        isActive: true
      }
    ]
  };

  const translations: PrescriptionTranslations = {
    title: 'My Prescriptions',
    loadingMessage: 'Loading medications...',
    noDataMessage: 'No medications found.'
  };

  const handleRefillRequest = (medicationId: string) => {
    console.log('Refill requested for:', medicationId);
  };

  return (
    <PrescriptionDashboard
      patientData={patientData}
      translations={translations}
      onRefillRequest={handleRefillRequest}
    />
  );
};
```

## 🔧 API Reference

### PrescriptionDashboard Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `patientData` | `PatientData` | No | Patient and medication information |
| `translations` | `PrescriptionTranslations` | No | Localization strings |
| `isLoading` | `boolean` | No | Loading state indicator |
| `error` | `string` | No | Error message to display |
| `onRefillRequest` | `(medicationId: string) => void` | No | Callback for refill requests |
| `onViewDetails` | `(medicationId: string) => void` | No | Callback for viewing details |
| `onPharmacySelect` | `(pharmacyId: string) => void` | No | Callback for pharmacy selection |
| `className` | `string` | No | Additional CSS classes |
| `showInactive` | `boolean` | No | Show inactive medications by default |

### PatientData Interface

```tsx
interface PatientData {
  id: string;
  name: string;
  medications: Medication[];
  preferredPharmacy?: PharmacyInfo;
  dateOfBirth?: string;
  insurance?: {
    provider: string;
    memberId: string;
  };
}
```

### Medication Interface

```tsx
interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  prescriber: string;
  dateIssued: string;
  refillsRemaining: number;
  isActive: boolean;
  pharmacy?: PharmacyInfo;
}
```

## 🎨 Styling

### CSS Variables

You can customize the component appearance using CSS variables:

```css
:root {
  --prescription-primary-color: #007bff;
  --prescription-success-color: #28a745;
  --prescription-warning-color: #ffc107;
  --prescription-danger-color: #dc3545;
  --prescription-border-radius: 8px;
  --prescription-box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

### Custom Themes

```css
/* Dark theme example */
.prescription-dashboard.dark-theme {
  --prescription-bg-color: #2c3e50;
  --prescription-text-color: #ecf0f1;
  --prescription-card-bg: #34495e;
}
```

## 📱 Responsive Design

The component is fully responsive and adapts to different screen sizes:

- **Desktop**: Multi-column grid layout
- **Tablet**: Responsive grid with flexible columns
- **Mobile**: Single column stack layout

## ♿ Accessibility Features

### Screen Reader Support
- Comprehensive ARIA labels and descriptions
- Semantic HTML structure
- Role-based navigation

### Keyboard Navigation
- Tab order management
- Enter/Space key activation
- Escape key for clearing search

### Visual Accessibility
- High contrast mode support
- Focus indicators
- Reduced motion preferences
- Print-friendly styles

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Test Coverage

The component includes comprehensive tests covering:
- Component rendering with various props
- Error handling and edge cases
- Accessibility compliance
- User interactions and callbacks
- Performance optimizations

## 📚 Examples

### Loading State
```tsx
<PrescriptionDashboard
  isLoading={true}
  translations={translations}
/>
```

### Error State
```tsx
<PrescriptionDashboard
  error="Failed to load data"
  translations={translations}
/>
```

### Empty State
```tsx
<PrescriptionDashboard
  patientData={{ id: '1', name: 'John', medications: [] }}
  translations={translations}
/>
```

### With All Features
```tsx
<PrescriptionDashboard
  patientData={fullPatientData}
  translations={customTranslations}
  onRefillRequest={handleRefill}
  onViewDetails={handleDetails}
  onPharmacySelect={handlePharmacy}
  showInactive={true}
  className="custom-dashboard"
/>
```

## 🔧 Development

### Prerequisites
- React 18+
- TypeScript 4.5+
- Node.js 16+

### Building
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

## 📄 License

This component is part of the WebQX Healthcare Platform and follows the project's Apache 2.0 license.

## 🤝 Contributing

Please refer to the main project's contributing guidelines for information on how to contribute to this component.

## 📞 Support

For questions, issues, or feature requests, please use the main project's issue tracker or contact the development team.