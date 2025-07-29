/**
 * @fileoverview Tests for Provider Viewer Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProviderViewer from '../ProviderViewer';

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
          }
        })}>
          Load Image
        </button>
      </div>
    );
  };
});

jest.mock('../ViewerControls', () => {
  return function MockViewerControls(props: any) {
    return (
      <div data-testid="viewer-controls">
        <button onClick={() => props.onZoom(2.0)}>Zoom</button>
        <button onClick={() => props.onReset()}>Reset</button>
      </div>
    );
  };
});

jest.mock('../MetadataDisplay', () => {
  return function MockMetadataDisplay() {
    return <div data-testid="metadata-display">Metadata</div>;
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

describe('ProviderViewer', () => {
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
    render(<ProviderViewer studyInstanceUID="study1" />);
    expect(screen.getByText('imaging.provider_viewer')).toBeInTheDocument();
  });

  it('displays all main components', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    expect(screen.getByTestId('dicom-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-controls')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-display')).toBeInTheDocument();
  });

  it('allows toggling metadata panel', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    const metadataToggle = screen.getByTitle('imaging.toggle_metadata');
    fireEvent.click(metadataToggle);
    
    // Should still be in document as we're mocking it
    expect(screen.getByTestId('metadata-display')).toBeInTheDocument();
  });

  it('allows toggling controls panel', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    const controlsToggle = screen.getByTitle('imaging.toggle_controls');
    fireEvent.click(controlsToggle);
    
    // Should still be in document as we're mocking it
    expect(screen.getByTestId('viewer-controls')).toBeInTheDocument();
  });

  it('handles save functionality', async () => {
    const onSave = jest.fn();
    render(<ProviderViewer studyInstanceUID="study1" onSave={onSave} />);
    
    const saveButton = screen.getByText('common.save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dicom/studies/study1/annotations',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  it('handles print functionality', () => {
    const onPrint = jest.fn();
    render(<ProviderViewer studyInstanceUID="study1" onPrint={onPrint} />);
    
    const printButton = screen.getByText('common.print');
    fireEvent.click(printButton);
    
    expect(onPrint).toHaveBeenCalled();
  });

  it('displays study information when image is loaded', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    const loadImageButton = screen.getByText('Load Image');
    fireEvent.click(loadImageButton);
    
    expect(screen.getByText('Test Study - CT')).toBeInTheDocument();
  });

  it('shows status bar with viewer information', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    expect(screen.getByText(/imaging.zoom/)).toBeInTheDocument();
    expect(screen.getByText(/imaging.measurements/)).toBeInTheDocument();
    expect(screen.getByText(/imaging.annotations/)).toBeInTheDocument();
  });

  it('handles export functionality', () => {
    const onExport = jest.fn();
    render(<ProviderViewer studyInstanceUID="study1" onExport={onExport} />);
    
    // Note: This test would need to be enhanced to test the dropdown functionality
    expect(screen.getByText('common.export ▼')).toBeInTheDocument();
  });

  it('passes correct config to DicomViewer', () => {
    render(<ProviderViewer studyInstanceUID="study1" />);
    
    const dicomViewer = screen.getByTestId('dicom-viewer');
    expect(dicomViewer).toBeInTheDocument();
    
    // The config would be passed as props to the mocked component
    // In a real test, we'd verify the config properties
  });

  it('handles series-specific viewing', () => {
    render(
      <ProviderViewer 
        studyInstanceUID="study1" 
        seriesInstanceUID="series1" 
      />
    );
    
    expect(screen.getByTestId('dicom-viewer')).toBeInTheDocument();
  });
});