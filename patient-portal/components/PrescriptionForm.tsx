import React, { useState } from 'react';

/**
 * PrescriptionForm component - Medication search using RxNorm service
 * This component demonstrates the issues mentioned in the problem statement
 */

interface Medication {
  rxcui: string;
  name: string;
  synonym?: string;
}

interface PrescriptionFormProps {
  className?: string;
}

// Mock RxNorm API service (placeholder implementation)
const fetchRxNorm = async (query: string): Promise<Medication[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate potential API failure (no error handling in initial version)
  if (Math.random() < 0.1) {
    throw new Error('RxNorm API temporarily unavailable');
  }
  
  // Mock medication data
  const mockMedications: Medication[] = [
    { rxcui: '12345', name: 'Acetaminophen 500mg', synonym: 'Tylenol' },
    { rxcui: '12346', name: 'Ibuprofen 200mg', synonym: 'Advil' },
    { rxcui: '12347', name: 'Amoxicillin 500mg', synonym: 'Antibiotic' },
    { rxcui: '12348', name: 'Lisinopril 10mg', synonym: 'Blood pressure medication' },
    { rxcui: '12349', name: 'Metformin 500mg', synonym: 'Diabetes medication' },
  ];
  
  return mockMedications.filter(med => 
    med.name.toLowerCase().includes(query.toLowerCase()) ||
    (med.synonym && med.synonym.toLowerCase().includes(query.toLowerCase()))
  );
};

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  className = ""
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addedMedications, setAddedMedications] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string>('');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // Clear previous error and set loading state
    setError('');
    setIsLoading(true);
    
    try {
      const results = await fetchRxNorm(searchQuery);
      setMedications(results);
    } catch (error) {
      // Issue 1 FIXED: Proper error handling for fetchRxNorm failures
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(`Search failed: ${errorMessage}. Please try again.`);
      setMedications([]); // Clear previous results
    } finally {
      // Issue 2 FIXED: Loading state properly managed
      setIsLoading(false);
    }
  };

  const handleAddToEHR = (medication: Medication) => {
    // Issue 5 FIXED: Implement functionality for Add to EHR button
    if (addedMedications.has(medication.rxcui)) {
      setNotification(`${medication.name} is already in your EHR`);
    } else {
      // Add to EHR (placeholder implementation)
      setAddedMedications(prev => {
        const newSet = new Set(prev);
        newSet.add(medication.rxcui);
        return newSet;
      });
      setNotification(`✅ ${medication.name} has been successfully added to your Electronic Health Record`);
      
      // In a real implementation, this would make an API call to add to EHR
      console.log('Adding to EHR:', {
        rxcui: medication.rxcui,
        name: medication.name,
        synonym: medication.synonym,
        timestamp: new Date().toISOString()
      });
    }
    
    // Clear notification after 5 seconds
    setTimeout(() => setNotification(''), 5000);
  };

  return (
    <div className={`prescription-form ${className}`}>
      <h3>Medication Search</h3>
      
      {/* Basic search input and button - Issue 4: Basic styling */}
      <div className="search-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for medications..."
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch}
          disabled={isLoading}
          aria-describedby={isLoading ? "loading-status" : undefined}
        >
          {isLoading ? '🔄 Searching...' : 'Search'}
        </button>
      </div>

      {/* Display success/info notifications */}
      {notification && (
        <div className="notification-message" role="alert" aria-live="polite">
          {notification}
        </div>
      )}

      {/* Display loading indicator */}
      {isLoading && (
        <div className="loading-indicator" role="status" aria-live="polite" id="loading-status">
          🔄 Searching for medications...
        </div>
      )}

      {/* Display error message if search fails */}
      {error && (
        <div className="error-message" role="alert" aria-live="polite">
          ⚠️ {error}
        </div>
      )}

      {/* Results list - Issue 4: Basic styling */}
      {medications.length > 0 && (
        <div className="results-list">
          <h4>Search Results:</h4>
          {medications.map((medication) => (
            <div key={medication.rxcui} className="medication-item">
              <div className="medication-info">
                <strong>{medication.name}</strong>
                {medication.synonym && (
                  <span className="medication-synonym"> ({medication.synonym})</span>
                )}
                <div className="medication-id">RxCUI: {medication.rxcui}</div>
              </div>
              {/* Issue 3 FIXED: Adding aria-label attributes for accessibility */}
              <button 
                onClick={() => handleAddToEHR(medication)}
                className={`add-to-ehr-btn ${addedMedications.has(medication.rxcui) ? 'added' : ''}`}
                aria-label={`Add ${medication.name} to Electronic Health Record`}
                disabled={addedMedications.has(medication.rxcui)}
              >
                {addedMedications.has(medication.rxcui) ? '✅ Added' : 'Add to EHR'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrescriptionForm;