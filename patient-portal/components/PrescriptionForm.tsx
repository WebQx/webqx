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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    // Issue 1: No error handling for fetchRxNorm failures
    // Issue 2: No loading state indication
    try {
      const results = await fetchRxNorm(searchQuery);
      setMedications(results);
    } catch (error) {
      // Error is caught but not handled properly
      console.error('Search failed:', error);
    }
  };

  const handleAddToEHR = (medication: Medication) => {
    // Issue 5: No functionality implemented for Add to EHR button
    console.log('Add to EHR clicked for:', medication.name);
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
        <button onClick={handleSearch}>
          Search
        </button>
      </div>

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
              {/* Issue 3: Missing aria-label attributes for accessibility */}
              <button 
                onClick={() => handleAddToEHR(medication)}
                className="add-to-ehr-btn"
              >
                Add to EHR
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrescriptionForm;