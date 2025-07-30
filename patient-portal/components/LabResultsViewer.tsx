/**
 * Lab Results Viewer Component
 * 
 * A React component for displaying patient lab results from FHIR Observation resources.
 * Includes filtering, sorting, and user-friendly display of laboratory data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FHIRObservation, LabResult, LabResultsGroup, ObservationStatus } from '../../interoperability/fhir/r4/resources/Observation';

interface LabResultsViewerProps {
  patientId: string;
  fhirServerUrl?: string;
  onError?: (error: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

interface FilterOptions {
  dateRange: 'all' | '30days' | '90days' | '1year';
  status: 'all' | ObservationStatus;
  category: 'all' | 'chemistry' | 'hematology' | 'microbiology' | 'other';
  abnormalOnly: boolean;
}

interface SortOptions {
  field: 'date' | 'name' | 'value' | 'status';
  direction: 'asc' | 'desc';
}

export const LabResultsViewer: React.FC<LabResultsViewerProps> = ({
  patientId,
  fhirServerUrl = '/fhir',
  onError,
  onLoadingChange
}) => {
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'all',
    status: 'all',
    category: 'all',
    abnormalOnly: false
  });
  
  const [sort, setSort] = useState<SortOptions>({
    field: 'date',
    direction: 'desc'
  });

  // Fetch lab results from FHIR server
  useEffect(() => {
    const fetchLabResults = async () => {
      try {
        setLoading(true);
        onLoadingChange?.(true);
        
        const searchParams = new URLSearchParams({
          patient: patientId,
          category: 'laboratory',
          _sort: '-date',
          _count: '100'
        });
        
        const response = await fetch(`${fhirServerUrl}/Observation?${searchParams}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch lab results: ${response.status} ${response.statusText}`);
        }
        
        const bundle = await response.json();
        
        if (bundle.resourceType === 'Bundle' && bundle.entry) {
          const observations: FHIRObservation[] = bundle.entry
            .filter((entry: any) => entry.resource?.resourceType === 'Observation')
            .map((entry: any) => entry.resource);
          
          const transformedResults = observations.map(transformObservationToLabResult);
          setLabResults(transformedResults);
        } else {
          setLabResults([]);
        }
        
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load lab results';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    };

    if (patientId) {
      fetchLabResults();
    }
  }, [patientId, fhirServerUrl, onError, onLoadingChange]);

  // Transform FHIR Observation to LabResult
  const transformObservationToLabResult = (observation: FHIRObservation): LabResult => {
    const getValue = () => {
      if (observation.valueQuantity) {
        return observation.valueQuantity.value || 0;
      }
      if (observation.valueString) {
        return observation.valueString;
      }
      if (observation.valueCodeableConcept) {
        return observation.valueCodeableConcept.coding?.[0]?.display || 
               observation.valueCodeableConcept.text || 'N/A';
      }
      if (observation.valueBoolean !== undefined) {
        return observation.valueBoolean ? 'Positive' : 'Negative';
      }
      return 'N/A';
    };

    const getInterpretation = () => {
      if (!observation.interpretation || observation.interpretation.length === 0) {
        return undefined;
      }
      
      const code = observation.interpretation[0].coding?.[0]?.code;
      const mapping: Record<string, 'normal' | 'high' | 'low' | 'critical' | 'abnormal'> = {
        'N': 'normal',
        'H': 'high',
        'L': 'low',
        'HH': 'critical',
        'LL': 'critical',
        'A': 'abnormal'
      };
      
      return mapping[code || ''] || 'abnormal';
    };

    const getReferenceRange = () => {
      if (!observation.referenceRange || observation.referenceRange.length === 0) {
        return undefined;
      }
      
      const range = observation.referenceRange[0];
      if (range.text) {
        return range.text;
      }
      
      if (range.low && range.high) {
        return `${range.low.value}-${range.high.value} ${range.low.unit || ''}`;
      }
      
      return undefined;
    };

    return {
      id: observation.id || '',
      patientId: observation.subject?.reference?.split('/')[1] || patientId,
      patientName: observation.subject?.display || 'Unknown',
      testName: observation.code.text || observation.code.coding?.[0]?.display || 'Unknown Test',
      testCode: observation.code.coding?.[0]?.code || '',
      value: getValue(),
      unit: observation.valueQuantity?.unit,
      normalRange: getReferenceRange(),
      status: observation.status,
      interpretation: getInterpretation(),
      collectionDate: observation.effectiveDateTime || observation.issued || new Date().toISOString(),
      resultDate: observation.issued || observation.effectiveDateTime || new Date().toISOString(),
      performingLab: observation.performer?.[0]?.display
    };
  };

  // Filter and sort lab results
  const filteredAndSortedResults = useMemo(() => {
    let filtered = [...labResults];

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case '30days':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case '1year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(result => 
        new Date(result.collectionDate) >= cutoffDate
      );
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(result => result.status === filters.status);
    }

    // Apply abnormal only filter
    if (filters.abnormalOnly) {
      filtered = filtered.filter(result => 
        result.interpretation && result.interpretation !== 'normal'
      );
    }

    // Apply category filter (basic implementation)
    if (filters.category !== 'all') {
      filtered = filtered.filter(result => {
        const testName = result.testName.toLowerCase();
        switch (filters.category) {
          case 'chemistry':
            return testName.includes('glucose') || testName.includes('sodium') || 
                   testName.includes('potassium') || testName.includes('creatinine');
          case 'hematology':
            return testName.includes('hemoglobin') || testName.includes('hematocrit') || 
                   testName.includes('wbc') || testName.includes('platelet');
          case 'microbiology':
            return testName.includes('culture') || testName.includes('bacteria') || 
                   testName.includes('sensitivity');
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case 'date':
          comparison = new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime();
          break;
        case 'name':
          comparison = a.testName.localeCompare(b.testName);
          break;
        case 'value':
          comparison = String(a.value).localeCompare(String(b.value));
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      
      return sort.direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [labResults, filters, sort]);

  // Group results by collection date
  const groupedResults = useMemo(() => {
    const groups: LabResultsGroup[] = [];
    const groupMap = new Map<string, LabResult[]>();

    filteredAndSortedResults.forEach(result => {
      const dateKey = result.collectionDate.split('T')[0]; // Group by date only
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, []);
      }
      groupMap.get(dateKey)!.push(result);
    });

    groupMap.forEach((results, date) => {
      groups.push({
        patientId: results[0].patientId,
        patientName: results[0].patientName,
        collectionDate: date,
        results,
        status: 'complete'
      });
    });

    return groups.sort((a, b) => 
      new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime()
    );
  }, [filteredAndSortedResults]);

  const getStatusBadgeColor = (status: ObservationStatus) => {
    const colors = {
      'final': 'bg-green-100 text-green-800',
      'preliminary': 'bg-yellow-100 text-yellow-800',
      'corrected': 'bg-blue-100 text-blue-800',
      'cancelled': 'bg-red-100 text-red-800',
      'amended': 'bg-purple-100 text-purple-800',
      'registered': 'bg-gray-100 text-gray-800',
      'entered-in-error': 'bg-red-100 text-red-800',
      'unknown': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.unknown;
  };

  const getInterpretationColor = (interpretation?: string) => {
    const colors = {
      'normal': 'text-green-600',
      'high': 'text-orange-600',
      'low': 'text-blue-600',
      'critical': 'text-red-600',
      'abnormal': 'text-red-600'
    };
    return colors[interpretation as keyof typeof colors] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading lab results...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Lab Results</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Lab Results
          </h3>
          <span className="text-sm text-gray-500">
            {filteredAndSortedResults.length} results
          </span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value as any})}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Time</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="1year">Last Year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value as any})}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="final">Final</option>
              <option value="preliminary">Preliminary</option>
              <option value="corrected">Corrected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value as any})}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">All Categories</option>
              <option value="chemistry">Chemistry</option>
              <option value="hematology">Hematology</option>
              <option value="microbiology">Microbiology</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.abnormalOnly}
                onChange={(e) => setFilters({...filters, abnormalOnly: e.target.checked})}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Abnormal only</span>
            </label>
          </div>
        </div>

        {/* Sort controls */}
        <div className="flex items-center mb-4">
          <span className="text-sm text-gray-700 mr-2">Sort by:</span>
          <select
            value={sort.field}
            onChange={(e) => setSort({...sort, field: e.target.value as any})}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm mr-2"
          >
            <option value="date">Date</option>
            <option value="name">Test Name</option>
            <option value="value">Value</option>
            <option value="status">Status</option>
          </select>
          <button
            onClick={() => setSort({...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc'})}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {sort.direction === 'asc' ? '↑' : '↓'}
          </button>
        </div>

        {/* Results */}
        {groupedResults.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No lab results found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or check back later for new results.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedResults.map((group) => (
              <div key={group.collectionDate} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900">
                    {new Date(group.collectionDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h4>
                  <p className="text-sm text-gray-500">{group.results.length} tests</p>
                </div>
                <div className="divide-y divide-gray-200">
                  {group.results.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedResult(result)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="text-sm font-medium text-gray-900">{result.testName}</h5>
                          <p className="text-sm text-gray-500">{result.testCode}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className={`text-sm font-medium ${getInterpretationColor(result.interpretation)}`}>
                              {result.value} {result.unit}
                            </p>
                            {result.normalRange && (
                              <p className="text-xs text-gray-500">Normal: {result.normalRange}</p>
                            )}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(result.status)}`}>
                            {result.status}
                          </span>
                        </div>
                      </div>
                      {result.interpretation && result.interpretation !== 'normal' && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getInterpretationColor(result.interpretation)} bg-opacity-10`}>
                            {result.interpretation.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Result Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Lab Result Details</h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Test Name</label>
                <p className="text-sm text-gray-900">{selectedResult.testName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Result</label>
                <p className={`text-sm font-medium ${getInterpretationColor(selectedResult.interpretation)}`}>
                  {selectedResult.value} {selectedResult.unit}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Normal Range</label>
                <p className="text-sm text-gray-900">{selectedResult.normalRange || 'Not specified'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(selectedResult.status)}`}>
                  {selectedResult.status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Collection Date</label>
                <p className="text-sm text-gray-900">
                  {new Date(selectedResult.collectionDate).toLocaleDateString()}
                </p>
              </div>
              {selectedResult.performingLab && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Performing Lab</label>
                  <p className="text-sm text-gray-900">{selectedResult.performingLab}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabResultsViewer;