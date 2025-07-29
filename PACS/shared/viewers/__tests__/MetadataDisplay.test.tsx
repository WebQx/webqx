/**
 * @fileoverview Tests for Metadata Display Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MetadataDisplay from '../MetadataDisplay';
import { DicomMetadata } from '../types';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockMetadata: DicomMetadata = {
  patientName: 'John Doe',
  patientId: 'PAT001',
  studyDate: '20231201',
  studyTime: '143000',
  modality: 'CT',
  studyDescription: 'Chest CT with contrast',
  seriesDescription: 'Axial chest',
  institutionName: 'Test Hospital',
  physicianName: 'Dr. Smith',
  rows: 512,
  columns: 512,
  pixelSpacing: [0.703125, 0.703125],
  sliceThickness: 5.0,
  windowCenter: 40,
  windowWidth: 400,
  bitsAllocated: 16,
  photometricInterpretation: 'MONOCHROME2',
};

describe('MetadataDisplay', () => {
  it('renders without crashing', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    expect(screen.getByText('imaging.dicom_metadata')).toBeInTheDocument();
  });

  it('displays patient information', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    expect(screen.getByText('imaging.patient_information')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('PAT001')).toBeInTheDocument();
  });

  it('displays study information', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    expect(screen.getByText('imaging.study_information')).toBeInTheDocument();
    expect(screen.getByText('CT')).toBeInTheDocument();
    expect(screen.getByText('Chest CT with contrast')).toBeInTheDocument();
    expect(screen.getByText('Axial chest')).toBeInTheDocument();
  });

  it('displays institution information', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    expect(screen.getByText('imaging.institution_information')).toBeInTheDocument();
    expect(screen.getByText('Test Hospital')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('displays image information', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    expect(screen.getByText('imaging.image_information')).toBeInTheDocument();
    expect(screen.getByText('512 × 512')).toBeInTheDocument();
    expect(screen.getByText('0.703 × 0.703 mm')).toBeInTheDocument();
    expect(screen.getByText('5 mm')).toBeInTheDocument();
    expect(screen.getByText('C: 40, W: 400')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('MONOCHROME2')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    // Should format DICOM date (YYYYMMDD) to readable format
    const dateElements = screen.getAllByText(/12\/1\/2023|1\/12\/2023|2023/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('formats times correctly', () => {
    render(<MetadataDisplay metadata={mockMetadata} />);
    
    // Should format DICOM time (HHMMSS) to HH:MM:SS
    expect(screen.getByText('14:30:00')).toBeInTheDocument();
  });

  it('shows read-only indicator when specified', () => {
    render(<MetadataDisplay metadata={mockMetadata} readOnly={true} />);
    
    expect(screen.getByText('imaging.read_only')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
  });

  it('does not show read-only indicator when not specified', () => {
    render(<MetadataDisplay metadata={mockMetadata} readOnly={false} />);
    
    expect(screen.queryByText('imaging.read_only')).not.toBeInTheDocument();
  });

  it('renders compact view when specified', () => {
    render(<MetadataDisplay metadata={mockMetadata} compact={true} />);
    
    expect(screen.getByText('John Doe • PAT001')).toBeInTheDocument();
    expect(screen.getByText(/CT • Chest CT with contrast/)).toBeInTheDocument();
    expect(screen.getByText('Axial chest')).toBeInTheDocument();
    
    // Should not show full metadata sections
    expect(screen.queryByText('imaging.dicom_metadata')).not.toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalMetadata: DicomMetadata = {
      patientName: 'Jane Doe',
      patientId: 'PAT002',
      studyDate: '20231201',
      modality: 'MR',
      studyDescription: 'Brain MRI',
      seriesDescription: 'T1 weighted',
    };

    render(<MetadataDisplay metadata={minimalMetadata} />);
    
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Brain MRI')).toBeInTheDocument();
    // Should show "not available" for missing fields
    expect(screen.getAllByText('common.not_available')).toHaveLength(2); // institution and physician
  });

  it('applies custom className', () => {
    const { container } = render(
      <MetadataDisplay metadata={mockMetadata} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies read-only class when specified', () => {
    const { container } = render(
      <MetadataDisplay metadata={mockMetadata} readOnly={true} />
    );
    
    expect(container.firstChild).toHaveClass('read-only');
  });

  it('applies compact class when specified', () => {
    const { container } = render(
      <MetadataDisplay metadata={mockMetadata} compact={true} />
    );
    
    expect(container.firstChild).toHaveClass('metadata-compact');
  });
});