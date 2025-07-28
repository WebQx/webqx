/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';

// Types for prescription data
export interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescriber: string;
  dateCreated: string;
  instructions?: string;
  refillsRemaining?: number;
}

export interface RxTemplate {
  id: string;
  name: string;
  medication: string;
  commonDosages: string[];
  commonFrequencies: string[];
  category: string;
  description?: string;
}

// Context state interface
interface PrescriptionsState {
  prescriptions: Prescription[];
  templates: RxTemplate[];
  selectedTemplate: RxTemplate | null;
  isLoading: boolean;
  error: string | null;
  formData: Partial<Prescription>;
}

// Action types
type PrescriptionsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PRESCRIPTIONS'; payload: Prescription[] }
  | { type: 'SET_TEMPLATES'; payload: RxTemplate[] }
  | { type: 'SELECT_TEMPLATE'; payload: RxTemplate | null }
  | { type: 'UPDATE_FORM_DATA'; payload: Partial<Prescription> }
  | { type: 'CLEAR_FORM_DATA' }
  | { type: 'ADD_PRESCRIPTION'; payload: Prescription }
  | { type: 'UPDATE_PRESCRIPTION'; payload: { id: string; updates: Partial<Prescription> } };

// Context methods interface
interface PrescriptionsContextType {
  state: PrescriptionsState;
  dispatch: React.Dispatch<PrescriptionsAction>;
  selectTemplate: (template: RxTemplate | null) => void;
  updateFormData: (data: Partial<Prescription>) => void;
  clearFormData: () => void;
  submitPrescription: (prescription: Omit<Prescription, 'id' | 'dateCreated'>) => Promise<void>;
  loadTemplates: () => Promise<void>;
  loadPrescriptions: () => Promise<void>;
}

// Initial state
const initialState: PrescriptionsState = {
  prescriptions: [],
  templates: [],
  selectedTemplate: null,
  isLoading: false,
  error: null,
  formData: {}
};

// Reducer function
function prescriptionsReducer(state: PrescriptionsState, action: PrescriptionsAction): PrescriptionsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_PRESCRIPTIONS':
      return { ...state, prescriptions: action.payload, isLoading: false };
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload, isLoading: false };
    case 'SELECT_TEMPLATE':
      return { ...state, selectedTemplate: action.payload };
    case 'UPDATE_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'CLEAR_FORM_DATA':
      return { ...state, formData: {}, selectedTemplate: null };
    case 'ADD_PRESCRIPTION':
      return { 
        ...state, 
        prescriptions: [...state.prescriptions, action.payload],
        formData: {},
        selectedTemplate: null,
        isLoading: false
      };
    case 'UPDATE_PRESCRIPTION':
      return {
        ...state,
        prescriptions: state.prescriptions.map(p => 
          p.id === action.payload.id 
            ? { ...p, ...action.payload.updates }
            : p
        )
      };
    default:
      return state;
  }
}

// Create context
const PrescriptionsContext = createContext<PrescriptionsContextType | undefined>(undefined);

// Mock data for demonstration
const mockTemplates: RxTemplate[] = [
  {
    id: '1',
    name: 'Lisinopril (Blood Pressure)',
    medication: 'Lisinopril',
    commonDosages: ['5mg', '10mg', '20mg', '40mg'],
    commonFrequencies: ['Once daily', 'Twice daily'],
    category: 'Cardiovascular',
    description: 'ACE inhibitor for hypertension and heart failure'
  },
  {
    id: '2',
    name: 'Metformin (Diabetes)',
    medication: 'Metformin',
    commonDosages: ['500mg', '850mg', '1000mg'],
    commonFrequencies: ['Once daily', 'Twice daily', 'Three times daily'],
    category: 'Endocrine',
    description: 'First-line treatment for type 2 diabetes'
  },
  {
    id: '3',
    name: 'Ibuprofen (Pain Relief)',
    medication: 'Ibuprofen',
    commonDosages: ['200mg', '400mg', '600mg', '800mg'],
    commonFrequencies: ['As needed', 'Every 4-6 hours', 'Three times daily'],
    category: 'Analgesic',
    description: 'Nonsteroidal anti-inflammatory drug (NSAID)'
  }
];

// Provider component
interface PrescriptionsProviderProps {
  children: ReactNode;
}

export const PrescriptionsProvider: React.FC<PrescriptionsProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(prescriptionsReducer, initialState);

  // Action creators
  const selectTemplate = useCallback((template: RxTemplate | null) => {
    dispatch({ type: 'SELECT_TEMPLATE', payload: template });
    if (template) {
      dispatch({ 
        type: 'UPDATE_FORM_DATA', 
        payload: { 
          medication: template.medication 
        } 
      });
    }
  }, []);

  const updateFormData = useCallback((data: Partial<Prescription>) => {
    dispatch({ type: 'UPDATE_FORM_DATA', payload: data });
  }, []);

  const clearFormData = useCallback(() => {
    dispatch({ type: 'CLEAR_FORM_DATA' });
  }, []);

  const submitPrescription = useCallback(async (prescription: Omit<Prescription, 'id' | 'dateCreated'>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newPrescription: Prescription = {
        ...prescription,
        id: `rx-${Date.now()}`,
        dateCreated: new Date().toISOString()
      };

      dispatch({ type: 'ADD_PRESCRIPTION', payload: newPrescription });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to submit prescription' 
      });
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      dispatch({ type: 'SET_TEMPLATES', payload: mockTemplates });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load templates' 
      });
    }
  }, []);

  const loadPrescriptions = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock existing prescriptions
      const mockPrescriptions: Prescription[] = [
        {
          id: 'rx-001',
          medication: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once daily',
          duration: '30 days',
          prescriber: 'Dr. Smith',
          dateCreated: '2024-03-01T10:00:00Z',
          instructions: 'Take with food',
          refillsRemaining: 2
        }
      ];
      
      dispatch({ type: 'SET_PRESCRIPTIONS', payload: mockPrescriptions });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load prescriptions' 
      });
    }
  }, []);

  const contextValue: PrescriptionsContextType = {
    state,
    dispatch,
    selectTemplate,
    updateFormData,
    clearFormData,
    submitPrescription,
    loadTemplates,
    loadPrescriptions
  };

  return (
    <PrescriptionsContext.Provider value={contextValue}>
      {children}
    </PrescriptionsContext.Provider>
  );
};

// Custom hook to use the context
export const usePrescriptions = () => {
  const context = useContext(PrescriptionsContext);
  if (context === undefined) {
    throw new Error('usePrescriptions must be used within a PrescriptionsProvider');
  }
  return context;
};

export default PrescriptionsContext;