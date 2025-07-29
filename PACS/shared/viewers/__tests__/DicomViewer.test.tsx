/**
 * @fileoverview Tests for DICOM Viewer Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DicomViewer from '../DicomViewer';
import { ViewerConfig } from '../types';

// Mock fetch
global.fetch = jest.fn();

const mockConfig: ViewerConfig = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  enableBrightnessContrast: true,
  enableMeasurements: false,
  enableAnnotations: false,
  enableCine: true,
  enableFullscreen: true,
  enableMetadataDisplay: true,
  enableWindowLevel: true,
  readOnly: false,
};

const mockImages = [
  {
    id: 'image1',
    studyInstanceUID: 'study1',
    seriesInstanceUID: 'series1',
    sopInstanceUID: 'sop1',
    imageNumber: 1,
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    metadata: {
      patientName: 'Test Patient',
      patientId: 'TEST001',
      studyDate: '20231201',
      modality: 'CT',
      studyDescription: 'Test Study',
      seriesDescription: 'Test Series',
      windowCenter: 128,
      windowWidth: 256,
      rows: 512,
      columns: 512,
    },
  },
];

beforeEach(() => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockImages),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('DicomViewer', () => {
  it('renders without crashing', () => {
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
      />
    );
    expect(screen.getByText('Loading DICOM images...')).toBeInTheDocument();
  });

  it('loads images on mount', async () => {
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/dicom/studies/study1/images',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer null',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  it('displays zoom controls when enabled', async () => {
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Zoom In')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom Out')).toBeInTheDocument();
    });
  });

  it('displays rotation controls when enabled', async () => {
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
      />
    );

    await waitFor(() => {
      expect(screen.getByTitle('Rotate Left')).toBeInTheDocument();
      expect(screen.getByTitle('Rotate Right')).toBeInTheDocument();
    });
  });

  it('handles zoom in functionality', async () => {
    const onStateChange = jest.fn();
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onStateChange={onStateChange}
      />
    );

    await waitFor(() => {
      const zoomInButton = screen.getByTitle('Zoom In');
      fireEvent.click(zoomInButton);
    });

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.25,
      })
    );
  });

  it('handles zoom out functionality', async () => {
    const onStateChange = jest.fn();
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onStateChange={onStateChange}
      />
    );

    await waitFor(() => {
      const zoomOutButton = screen.getByTitle('Zoom Out');
      fireEvent.click(zoomOutButton);
    });

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 0.8,
      })
    );
  });

  it('handles rotation functionality', async () => {
    const onStateChange = jest.fn();
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onStateChange={onStateChange}
      />
    );

    await waitFor(() => {
      const rotateRightButton = screen.getByTitle('Rotate Right');
      fireEvent.click(rotateRightButton);
    });

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        rotation: 90,
      })
    );
  });

  it('handles reset view functionality', async () => {
    const onStateChange = jest.fn();
    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onStateChange={onStateChange}
      />
    );

    await waitFor(() => {
      const resetButton = screen.getByTitle('Reset View');
      fireEvent.click(resetButton);
    });

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.0,
        rotation: 0,
        pan: { x: 0, y: 0 },
      })
    );
  });

  it('displays navigation for multiple images', async () => {
    const multipleImages = [...mockImages, { ...mockImages[0], id: 'image2', imageNumber: 2 }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(multipleImages),
    });

    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const onError = jest.fn();

    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onError={onError}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Images')).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('calls onImageLoad when image is loaded', async () => {
    const onImageLoad = jest.fn();

    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={mockConfig}
        onImageLoad={onImageLoad}
      />
    );

    await waitFor(() => {
      expect(onImageLoad).toHaveBeenCalledWith(mockImages[0]);
    });
  });

  it('respects disabled controls in config', () => {
    const disabledConfig: ViewerConfig = {
      ...mockConfig,
      enableZoom: false,
      enableRotate: false,
    };

    render(
      <DicomViewer
        studyInstanceUID="study1"
        config={disabledConfig}
      />
    );

    expect(screen.queryByTitle('Zoom In')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Rotate Left')).not.toBeInTheDocument();
  });
});