/**
 * @fileoverview PACS Imaging Viewer Types
 * 
 * Shared type definitions for DICOM imaging viewers used across
 * provider panel and patient portal components.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export interface DicomImage {
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  imageNumber: number;
  url: string;
  metadata: DicomMetadata;
}

export interface DicomMetadata {
  patientName: string;
  patientId: string;
  studyDate: string;
  studyTime?: string;
  modality: string;
  studyDescription: string;
  seriesDescription: string;
  institutionName?: string;
  physicianName?: string;
  imagePosition?: [number, number, number];
  imageOrientation?: [number, number, number, number, number, number];
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  windowCenter?: number;
  windowWidth?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  highBit?: number;
  photometricInterpretation?: string;
  samplesPerPixel?: number;
  rows?: number;
  columns?: number;
}

export interface ViewerConfig {
  enableZoom: boolean;
  enablePan: boolean;
  enableRotate: boolean;
  enableBrightnessContrast: boolean;
  enableMeasurements: boolean;
  enableAnnotations: boolean;
  enableCine: boolean;
  enableFullscreen: boolean;
  enableMetadataDisplay: boolean;
  enableWindowLevel: boolean;
  readOnly: boolean;
}

export interface ViewerState {
  zoom: number;
  pan: { x: number; y: number };
  rotation: number;
  brightness: number;
  contrast: number;
  windowCenter: number;
  windowWidth: number;
  isPlaying: boolean;
  currentImageIndex: number;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'area' | 'ellipse';
  points: Array<{ x: number; y: number }>;
  value: number;
  unit: string;
  label?: string;
  color?: string;
  createdAt: Date;
  createdBy: string;
}

export interface Annotation {
  id: string;
  type: 'arrow' | 'text' | 'freehand' | 'rectangle' | 'circle';
  points: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth: number;
  createdAt: Date;
  createdBy: string;
}

export interface ViewerTools {
  measurements: Measurement[];
  annotations: Annotation[];
  activeTool: string | null;
}

export interface DicomStudy {
  studyInstanceUID: string;
  patientId: string;
  studyDate: string;
  studyDescription: string;
  modality: string;
  seriesCount: number;
  instanceCount: number;
  series: DicomSeries[];
  status: 'available' | 'pending' | 'restricted';
}

export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription: string;
  modality: string;
  instanceCount: number;
  images: DicomImage[];
}

export interface ViewerProps {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  config: ViewerConfig;
  onImageLoad?: (image: DicomImage) => void;
  onError?: (error: Error) => void;
  onMeasurement?: (measurement: Measurement) => void;
  onAnnotation?: (annotation: Annotation) => void;
  onStateChange?: (state: ViewerState) => void;
  className?: string;
}

export interface ViewerControlsProps {
  config: ViewerConfig;
  state: ViewerState;
  tools: ViewerTools;
  onZoom: (factor: number) => void;
  onPan: (delta: { x: number; y: number }) => void;
  onRotate: (angle: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onWindowLevel: (center: number, width: number) => void;
  onToolSelect: (tool: string | null) => void;
  onReset: () => void;
  onFullscreen: () => void;
}

export interface MetadataDisplayProps {
  metadata: DicomMetadata;
  compact?: boolean;
  readOnly?: boolean;
  className?: string;
}

export type ViewerEvent = 
  | { type: 'imageLoad'; data: DicomImage }
  | { type: 'error'; data: Error }
  | { type: 'stateChange'; data: ViewerState }
  | { type: 'measurementCreate'; data: Measurement }
  | { type: 'annotationCreate'; data: Annotation }
  | { type: 'toolChange'; data: string | null };