/**
 * Type definitions for prescription-related components
 */

export interface Medication {
  /** Unique identifier for the medication */
  id: string;
  /** Name of the medication */
  name: string;
  /** Dosage information (e.g., "10mg") */
  dosage: string;
  /** Frequency of administration (e.g., "twice daily") */
  frequency: string;
  /** Instructions for taking the medication */
  instructions?: string;
  /** Prescribing doctor's name */
  prescriber: string;
  /** Date the prescription was issued */
  dateIssued: string;
  /** Number of refills remaining */
  refillsRemaining: number;
  /** Whether the medication is active */
  isActive: boolean;
  /** Pharmacy information where medication can be filled */
  pharmacy?: PharmacyInfo;
}

export interface PharmacyInfo {
  /** Unique identifier for the pharmacy */
  id: string;
  /** Name of the pharmacy */
  name: string;
  /** Address of the pharmacy */
  address: string;
  /** Phone number for the pharmacy */
  phone: string;
  /** Whether this is the patient's preferred pharmacy */
  isPreferred?: boolean;
}

export interface PatientData {
  /** Patient's unique identifier */
  id: string;
  /** Patient's full name */
  name: string;
  /** List of patient's medications */
  medications: Medication[];
  /** Patient's preferred pharmacy */
  preferredPharmacy?: PharmacyInfo;
  /** Date of birth for patient */
  dateOfBirth?: string;
  /** Insurance information */
  insurance?: {
    provider: string;
    memberId: string;
  };
}

export interface PrescriptionTranslations {
  /** Main title for the dashboard */
  title?: string;
  /** Loading message during data fetch */
  loadingMessage?: string;
  /** Message shown when no medications are available */
  noDataMessage?: string;
  /** Message shown when no medications match search */
  noMedicationsFound?: string;
  /** Label for active medications filter */
  activeMedications?: string;
  /** Label for all medications filter */
  allMedications?: string;
  /** Label for search input */
  searchPlaceholder?: string;
  /** Label for refill button */
  refillButton?: string;
  /** Label for view details button */
  viewDetailsButton?: string;
  /** Label for pharmacy information */
  pharmacyLabel?: string;
  /** Error message for failed operations */
  errorMessage?: string;
  /** Success message for refill requests */
  refillSuccess?: string;
  /** Accessibility label for medication list */
  medicationListLabel?: string;
  /** Label for dosage information */
  dosageLabel?: string;
  /** Label for frequency information */
  frequencyLabel?: string;
  /** Label for refills remaining */
  refillsLabel?: string;
  /** Label for prescriber information */
  prescriberLabel?: string;
}

export interface PrescriptionDashboardProps {
  /** Patient data including medications */
  patientData?: PatientData;
  /** Translations for the component */
  translations?: PrescriptionTranslations;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message if data fetch failed */
  error?: string;
  /** Callback when refill is requested */
  onRefillRequest?: (medicationId: string) => void;
  /** Callback when medication details are viewed */
  onViewDetails?: (medicationId: string) => void;
  /** Callback when pharmacy is selected */
  onPharmacySelect?: (pharmacyId: string) => void;
  /** CSS class name for styling */
  className?: string;
  /** Whether to show inactive medications by default */
  showInactive?: boolean;
}

export interface MedCardProps {
  /** Medication data to display */
  medication: Medication;
  /** Translations for the card */
  translations?: PrescriptionTranslations;
  /** Callback when refill is requested */
  onRefillRequest?: (medicationId: string) => void;
  /** Callback when details are viewed */
  onViewDetails?: (medicationId: string) => void;
  /** CSS class name for styling */
  className?: string;
  /** Whether the card is in a loading state */
  isLoading?: boolean;
}