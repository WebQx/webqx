/**
 * @fileoverview PACS Shared Viewers Export Module
 * 
 * Central export point for all PACS imaging viewer components.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

// Core components
export { default as DicomViewer } from './DicomViewer';
export { default as ViewerControls } from './ViewerControls';
export { default as MetadataDisplay } from './MetadataDisplay';

// Specialized viewers
export { default as ProviderViewer } from './ProviderViewer';
export { default as PatientViewer } from './PatientViewer';

// Types and interfaces
export type {
  DicomImage,
  DicomMetadata,
  DicomStudy,
  DicomSeries,
  ViewerConfig,
  ViewerState,
  ViewerProps,
  ViewerControlsProps,
  MetadataDisplayProps,
  Measurement,
  Annotation,
  ViewerTools,
  ViewerEvent,
} from './types';

// Default configurations
export const DEFAULT_PROVIDER_CONFIG: ViewerConfig = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  enableBrightnessContrast: true,
  enableMeasurements: true,
  enableAnnotations: true,
  enableCine: true,
  enableFullscreen: true,
  enableMetadataDisplay: true,
  enableWindowLevel: true,
  readOnly: false,
};

export const DEFAULT_PATIENT_CONFIG: ViewerConfig = {
  enableZoom: true,
  enablePan: true,
  enableRotate: true,
  enableBrightnessContrast: false,
  enableMeasurements: false,
  enableAnnotations: false,
  enableCine: true,
  enableFullscreen: true,
  enableMetadataDisplay: true,
  enableWindowLevel: false,
  readOnly: true,
};

// Utility functions
export const createMeasurement = (
  type: 'distance' | 'angle' | 'area' | 'ellipse',
  points: Array<{ x: number; y: number }>,
  value: number,
  unit: string,
  createdBy: string,
  label?: string,
  color?: string
): Measurement => ({
  id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  points,
  value,
  unit,
  label,
  color: color || '#FF6B6B',
  createdAt: new Date(),
  createdBy,
});

export const createAnnotation = (
  type: 'arrow' | 'text' | 'freehand' | 'rectangle' | 'circle',
  points: Array<{ x: number; y: number }>,
  createdBy: string,
  text?: string,
  color?: string,
  strokeWidth?: number
): Annotation => ({
  id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  type,
  points,
  text,
  color: color || '#4ECDC4',
  strokeWidth: strokeWidth || 2,
  createdAt: new Date(),
  createdBy,
});

// Version information
export const PACS_VIEWERS_VERSION = '1.0.0';