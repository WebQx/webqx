/**
 * Tests for Lab Results Viewer Component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LabResultsViewer from '../components/LabResultsViewer';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockFHIRBundle = {
  resourceType: 'Bundle',
  entry: [
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-1',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '789-8',
            display: 'Hemoglobin'
          }],
          text: 'Hemoglobin'
        },
        subject: {
          reference: 'Patient/12345',
          display: 'John Doe'
        },
        effectiveDateTime: '2025-07-30T11:00:00Z',
        issued: '2025-07-30T12:00:00Z',
        valueQuantity: {
          value: 13.5,
          unit: 'g/dL',
          system: 'http://unitsofmeasure.org'
        },
        referenceRange: [{
          text: '12.0-16.0',
          low: {
            value: 12.0,
            unit: 'g/dL'
          },
          high: {
            value: 16.0,
            unit: 'g/dL'
          }
        }],
        interpretation: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'N',
            display: 'Normal'
          }]
        }],
        performer: [{
          display: 'Lab Facility'
        }]
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-2',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }]
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '718-7',
            display: 'Hematocrit'
          }],
          text: 'Hematocrit'
        },
        subject: {
          reference: 'Patient/12345',
          display: 'John Doe'
        },
        effectiveDateTime: '2025-07-30T11:00:00Z',
        issued: '2025-07-30T12:00:00Z',
        valueQuantity: {
          value: 42.0,
          unit: '%',
          system: 'http://unitsofmeasure.org'
        },
        referenceRange: [{
          text: '36.0-48.0'
        }],
        interpretation: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'N',
            display: 'Normal'
          }]
        }]
      }
    }
  ]
};

describe('LabResultsViewer', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should render loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<LabResultsViewer patientId="12345" />);
    
    expect(screen.getByText('Loading lab results...')).toBeInTheDocument();
  });

  it('should fetch and display lab results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading lab results...')).not.toBeInTheDocument();
    });

    // Check if lab results are displayed
    expect(screen.getByText('Lab Results')).toBeInTheDocument();
    expect(screen.getByText('2 results')).toBeInTheDocument();
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    expect(screen.getByText('Hematocrit')).toBeInTheDocument();
    expect(screen.getByText('13.5 g/dL')).toBeInTheDocument();
    expect(screen.getByText('42 %')).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    const mockOnError = jest.fn();
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<LabResultsViewer patientId="12345" onError={mockOnError} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Lab Results')).toBeInTheDocument();
    });

    expect(mockOnError).toHaveBeenCalledWith('Network error');
  });

  it('should handle empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resourceType: 'Bundle', entry: [] })
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('No lab results found')).toBeInTheDocument();
    });
  });

  it('should filter results by date range', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    // Change date filter to Last 30 Days
    const dateFilter = screen.getByDisplayValue('All Time');
    fireEvent.change(dateFilter, { target: { value: '30days' } });

    // Results should still be there since they're recent
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('should filter results by status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    // Change status filter to preliminary (should show no results)
    const statusFilter = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusFilter, { target: { value: 'preliminary' } });

    expect(screen.getByText('0 results')).toBeInTheDocument();
  });

  it('should toggle abnormal only filter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    // Enable abnormal only filter (should show no results since all are normal)
    const abnormalOnlyCheckbox = screen.getByRole('checkbox');
    fireEvent.click(abnormalOnlyCheckbox);

    expect(screen.getByText('0 results')).toBeInTheDocument();
  });

  it('should change sort order', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    // Change sort field to Test Name
    const sortField = screen.getByDisplayValue('Date');
    fireEvent.change(sortField, { target: { value: 'name' } });

    // Toggle sort direction
    const sortDirection = screen.getByText('↓');
    fireEvent.click(sortDirection);

    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('should open result detail modal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    });

    // Click on a result to open detail modal
    fireEvent.click(screen.getByText('Hemoglobin'));

    expect(screen.getByText('Lab Result Details')).toBeInTheDocument();
    expect(screen.getByText('Normal: 12.0-16.0')).toBeInTheDocument();
  });

  it('should close result detail modal', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" />);

    await waitFor(() => {
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('Hemoglobin'));
    expect(screen.getByText('Lab Result Details')).toBeInTheDocument();

    // Close modal
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(button => 
      button.querySelector('svg') && button.className.includes('text-gray-400')
    );
    fireEvent.click(closeButton!);

    expect(screen.queryByText('Lab Result Details')).not.toBeInTheDocument();
  });

  it('should call onLoadingChange callback', async () => {
    const mockOnLoadingChange = jest.fn();
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" onLoadingChange={mockOnLoadingChange} />);

    await waitFor(() => {
      expect(screen.getByText('2 results')).toBeInTheDocument();
    });

    expect(mockOnLoadingChange).toHaveBeenCalledWith(true);
    expect(mockOnLoadingChange).toHaveBeenCalledWith(false);
  });

  it('should make correct FHIR API call', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFHIRBundle
    });

    render(<LabResultsViewer patientId="12345" fhirServerUrl="/test-fhir" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/test-fhir/Observation?patient=12345&category=laboratory&_sort=-date&_count=100'
      );
    });
  });
});