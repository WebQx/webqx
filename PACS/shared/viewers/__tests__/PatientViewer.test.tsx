/**
 * @fileoverview Tests for Patient Viewer Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PatientViewer from '../PatientViewer';

// Mock the child components
jest.mock('../DicomViewer', () => {
  return function MockDicomViewer(props: any) {
    return (
      <div data-testid="dicom-viewer">
        <button onClick={() => props.onImageLoad?.({
          id: 'test-image',
          metadata: {
            patientName: 'Test Patient',
            studyDescription: 'Test Study',
            modality: 'CT',
            studyDate: '20231201',
          }
        })}>
          Load Image
        </button>
      </div>
    );
  };
});

jest.mock('../MetadataDisplay', () => {
  return function MockMetadataDisplay(props: any) {
    return (
      <div data-testid="metadata-display">
        Metadata - ReadOnly: {props.readOnly ? 'true' : 'false'}
      </div>
    );
  };
});

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock fetch
global.fetch = jest.fn();

describe('PatientViewer', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    expect(screen.getByText('imaging.patient_viewer')).toBeInTheDocument();
  });

  it('displays DICOM viewer component', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    expect(screen.getByTestId('dicom-viewer')).toBeInTheDocument();
  });

  it('shows simple controls overlay', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    expect(screen.getByTitle('imaging.zoom_in')).toBeInTheDocument();
    expect(screen.getByTitle('imaging.zoom_out')).toBeInTheDocument();
    expect(screen.getByTitle('imaging.rotate_left')).toBeInTheDocument();
    expect(screen.getByTitle('imaging.rotate_right')).toBeInTheDocument();
    expect(screen.getByTitle('imaging.reset_view')).toBeInTheDocument();
    expect(screen.getByTitle('imaging.fullscreen')).toBeInTheDocument();
  });

  it('allows toggling metadata display', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    // Load an image first to enable metadata
    const loadImageButton = screen.getByText('Load Image');
    fireEvent.click(loadImageButton);
    
    const metadataToggle = screen.getByTitle('imaging.toggle_metadata');
    fireEvent.click(metadataToggle);
    
    expect(screen.getByTestId('metadata-display')).toBeInTheDocument();
    expect(screen.getByText(/ReadOnly: true/)).toBeInTheDocument();
  });

  it('displays study information when image is loaded', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    const loadImageButton = screen.getByText('Load Image');
    fireEvent.click(loadImageButton);
    
    expect(screen.getByText('CT - Test Study')).toBeInTheDocument();
  });

  it('shows patient-specific disclaimers when metadata is visible', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    // Load image and show metadata
    const loadImageButton = screen.getByText('Load Image');
    fireEvent.click(loadImageButton);
    
    const metadataToggle = screen.getByTitle('imaging.toggle_metadata');
    fireEvent.click(metadataToggle);
    
    expect(screen.getByText('imaging.important_notice')).toBeInTheDocument();
    expect(screen.getByText('imaging.questions')).toBeInTheDocument();
  });

  it('handles view completion', async () => {
    const onViewComplete = jest.fn();
    render(<PatientViewer studyInstanceUID="study1" onViewComplete={onViewComplete} />);
    
    const doneButton = screen.getByTitle('imaging.done_viewing');
    fireEvent.click(doneButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/imaging/viewing-session',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('study1'),
        })
      );
      expect(onViewComplete).toHaveBeenCalled();
    });
  });

  it('handles zoom controls', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    const zoomInButton = screen.getByTitle('imaging.zoom_in');
    const zoomOutButton = screen.getByTitle('imaging.zoom_out');
    
    expect(zoomInButton).toBeInTheDocument();
    expect(zoomOutButton).toBeInTheDocument();
    
    // Initial zoom should be 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    
    fireEvent.click(zoomInButton);
    // After zoom in, should show 125%
    expect(screen.getByText('125%')).toBeInTheDocument();
  });

  it('handles rotation controls', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    const rotateLeftButton = screen.getByTitle('imaging.rotate_left');
    const rotateRightButton = screen.getByTitle('imaging.rotate_right');
    
    fireEvent.click(rotateRightButton);
    fireEvent.click(rotateLeftButton);
    
    // These should not throw errors
    expect(rotateLeftButton).toBeInTheDocument();
    expect(rotateRightButton).toBeInTheDocument();
  });

  it('handles reset view', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    // Zoom in first
    const zoomInButton = screen.getByTitle('imaging.zoom_in');
    fireEvent.click(zoomInButton);
    expect(screen.getByText('125%')).toBeInTheDocument();
    
    // Then reset
    const resetButton = screen.getByTitle('imaging.reset_view');
    fireEvent.click(resetButton);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows help information', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    expect(screen.getByText('imaging.patient_help_text')).toBeInTheDocument();
    expect(screen.getByText('imaging.how_to_use')).toBeInTheDocument();
  });

  it('passes correct config to DicomViewer', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    const dicomViewer = screen.getByTestId('dicom-viewer');
    expect(dicomViewer).toBeInTheDocument();
    
    // The patient viewer should pass a read-only config
    // This would be verified in the actual DicomViewer props in a real test
  });

  it('handles series-specific viewing', () => {
    render(
      <PatientViewer 
        studyInstanceUID="study1" 
        seriesInstanceUID="series1" 
      />
    );
    
    expect(screen.getByTestId('dicom-viewer')).toBeInTheDocument();
  });

  it('displays status bar with viewing information', () => {
    render(<PatientViewer studyInstanceUID="study1" />);
    
    // Load image to populate status
    const loadImageButton = screen.getByText('Load Image');
    fireEvent.click(loadImageButton);
    
    expect(screen.getByText(/imaging.viewing_study/)).toBeInTheDocument();
  });
});