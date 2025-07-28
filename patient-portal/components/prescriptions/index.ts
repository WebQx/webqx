// PrescriptionsModule - Main exports
export { default as PrescriptionsModule } from './PrescriptionsModule';
export { default as SmartRxTemplatePicker } from './SmartRxTemplatePicker';
export { default as PrescriptionForm } from './PrescriptionForm';
export { default as ErrorBoundary } from './ErrorBoundary';
export { 
  PrescriptionsProvider, 
  usePrescriptions,
  type Prescription,
  type RxTemplate 
} from './PrescriptionsContext';

/**
 * WebQX Prescriptions Module
 * 
 * A comprehensive prescription management system with:
 * - Error boundaries for graceful error handling
 * - Loading states for better UX
 * - React Context to eliminate prop drilling
 * - Full accessibility compliance
 * - Smart template picker with search/filtering
 * - Validated prescription form
 * - Comprehensive unit test coverage
 */