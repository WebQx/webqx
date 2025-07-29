/**
 * Custom OHIF Plugin for WebQX™ Integration
 * 
 * Provides custom imaging tools including advanced annotations,
 * measurements, and markup capabilities while maintaining DICOM compliance.
 */

import { 
  StudyAnnotation, 
  MeasurementData, 
  AnnotationContent, 
  WebQXUser,
  Permission 
} from '../../types';

interface PluginContext {
  user: WebQXUser;
  language: string;
  permissions: Permission[];
  onAnnotationChange?: (annotation: StudyAnnotation) => void;
  onMeasurementChange?: (measurement: MeasurementData) => void;
}

interface ToolState {
  activeTool: string | null;
  isDrawing: boolean;
  currentAnnotation: Partial<StudyAnnotation> | null;
  measurements: MeasurementData[];
}

export class WebQXImagingPlugin {
  private context: PluginContext;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private toolState: ToolState = {
    activeTool: null,
    isDrawing: false,
    currentAnnotation: null,
    measurements: []
  };
  private eventListeners: Map<string, EventListener[]> = new Map();

  constructor(context: PluginContext) {
    this.context = context;
    this.initializeTools();
  }

  /**
   * Initialize the plugin with a canvas element
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvasContext = canvas.getContext('2d');
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  /**
   * Activate a specific tool
   */
  activateTool(toolName: string): boolean {
    // Check permissions
    if (!this.hasToolPermission(toolName)) {
      console.warn(`User does not have permission to use tool: ${toolName}`);
      return false;
    }

    this.deactivateCurrentTool();
    this.toolState.activeTool = toolName;
    this.updateCursor(toolName);
    
    return true;
  }

  /**
   * Deactivate current tool
   */
  deactivateCurrentTool(): void {
    this.toolState.activeTool = null;
    this.toolState.isDrawing = false;
    this.toolState.currentAnnotation = null;
    this.updateCursor('default');
  }

  /**
   * Handle annotation tools
   */
  createTextAnnotation(x: number, y: number, text: string): StudyAnnotation {
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'text',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        text,
        coordinates: [x, y],
        style: {
          color: '#ff0000',
          thickness: 2,
          opacity: 0.8,
          font: '14px Arial'
        }
      },
      visibility: 'public'
    };

    this.drawTextAnnotation(annotation);
    this.context.onAnnotationChange?.(annotation);
    
    return annotation;
  }

  createArrowAnnotation(startX: number, startY: number, endX: number, endY: number): StudyAnnotation {
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'arrow',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        coordinates: [startX, startY, endX, endY],
        style: {
          color: '#00ff00',
          thickness: 3,
          opacity: 0.9
        }
      },
      visibility: 'public'
    };

    this.drawArrowAnnotation(annotation);
    this.context.onAnnotationChange?.(annotation);
    
    return annotation;
  }

  createCircleAnnotation(centerX: number, centerY: number, radius: number): StudyAnnotation {
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'circle',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        coordinates: [centerX, centerY, radius],
        style: {
          color: '#0000ff',
          thickness: 2,
          opacity: 0.7
        }
      },
      visibility: 'public'
    };

    this.drawCircleAnnotation(annotation);
    this.context.onAnnotationChange?.(annotation);
    
    return annotation;
  }

  createRectangleAnnotation(x: number, y: number, width: number, height: number): StudyAnnotation {
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'rectangle',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        coordinates: [x, y, width, height],
        style: {
          color: '#ff00ff',
          thickness: 2,
          opacity: 0.6
        }
      },
      visibility: 'public'
    };

    this.drawRectangleAnnotation(annotation);
    this.context.onAnnotationChange?.(annotation);
    
    return annotation;
  }

  /**
   * Handle measurement tools
   */
  createLengthMeasurement(startX: number, startY: number, endX: number, endY: number, pixelSpacing: number = 1): MeasurementData {
    const pixelDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const realDistance = pixelDistance * pixelSpacing;

    const measurement: MeasurementData = {
      value: realDistance,
      unit: 'mm',
      type: 'length',
      accuracy: 0.1
    };

    // Create annotation for the measurement
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'measurement',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        text: `${realDistance.toFixed(1)} mm`,
        coordinates: [startX, startY, endX, endY],
        measurements: measurement,
        style: {
          color: '#ffff00',
          thickness: 2,
          opacity: 0.8,
          font: '12px Arial'
        }
      },
      visibility: 'public'
    };

    this.drawLengthMeasurement(annotation);
    this.context.onMeasurementChange?.(measurement);
    this.context.onAnnotationChange?.(annotation);

    return measurement;
  }

  createAreaMeasurement(points: number[], pixelSpacing: number = 1): MeasurementData {
    const pixelArea = this.calculatePolygonArea(points);
    const realArea = pixelArea * Math.pow(pixelSpacing, 2);

    const measurement: MeasurementData = {
      value: realArea,
      unit: 'mm²',
      type: 'area',
      accuracy: 0.01
    };

    // Create annotation for the measurement
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'measurement',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        text: `${realArea.toFixed(2)} mm²`,
        coordinates: points,
        measurements: measurement,
        style: {
          color: '#00ffff',
          thickness: 2,
          opacity: 0.8,
          font: '12px Arial'
        }
      },
      visibility: 'public'
    };

    this.drawAreaMeasurement(annotation);
    this.context.onMeasurementChange?.(measurement);
    this.context.onAnnotationChange?.(annotation);

    return measurement;
  }

  createAngleMeasurement(point1: number[], point2: number[], point3: number[]): MeasurementData {
    const angle = this.calculateAngle(point1, point2, point3);

    const measurement: MeasurementData = {
      value: angle,
      unit: '°',
      type: 'angle',
      accuracy: 0.1
    };

    // Create annotation for the measurement
    const annotation: StudyAnnotation = {
      id: this.generateId(),
      type: 'measurement',
      authorId: this.context.user.id,
      authorRole: this.context.user.role,
      timestamp: new Date(),
      content: {
        text: `${angle.toFixed(1)}°`,
        coordinates: [...point1, ...point2, ...point3],
        measurements: measurement,
        style: {
          color: '#ff8800',
          thickness: 2,
          opacity: 0.8,
          font: '12px Arial'
        }
      },
      visibility: 'public'
    };

    this.drawAngleMeasurement(annotation);
    this.context.onMeasurementChange?.(measurement);
    this.context.onAnnotationChange?.(annotation);

    return measurement;
  }

  /**
   * Render existing annotations
   */
  renderAnnotations(annotations: StudyAnnotation[]): void {
    if (!this.canvasContext) return;

    // Clear previous annotations
    this.clearCanvas();

    annotations.forEach(annotation => {
      switch (annotation.type) {
        case 'text':
          this.drawTextAnnotation(annotation);
          break;
        case 'arrow':
          this.drawArrowAnnotation(annotation);
          break;
        case 'circle':
          this.drawCircleAnnotation(annotation);
          break;
        case 'rectangle':
          this.drawRectangleAnnotation(annotation);
          break;
        case 'measurement':
          if (annotation.content.measurements?.type === 'length') {
            this.drawLengthMeasurement(annotation);
          } else if (annotation.content.measurements?.type === 'area') {
            this.drawAreaMeasurement(annotation);
          } else if (annotation.content.measurements?.type === 'angle') {
            this.drawAngleMeasurement(annotation);
          }
          break;
      }
    });
  }

  /**
   * Export annotations in DICOM-compliant format
   */
  exportToDICOM(annotations: StudyAnnotation[]): any {
    // Convert annotations to DICOM SR (Structured Report) format
    const dicomAnnotations = annotations.map(annotation => ({
      ConceptNameCodeSequence: {
        CodeValue: this.getAnnotationCodeValue(annotation.type),
        CodingSchemeDesignator: 'DCM',
        CodeMeaning: annotation.type
      },
      ValueType: annotation.type === 'measurement' ? 'NUM' : 'TEXT',
      TextValue: annotation.content.text,
      GraphicAnnotationSequence: {
        GraphicType: this.getDICOMGraphicType(annotation.type),
        GraphicData: annotation.content.coordinates,
        Units: annotation.content.measurements?.unit
      },
      DateTime: annotation.timestamp.toISOString(),
      PersonName: annotation.authorId
    }));

    return {
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.88.67', // Comprehensive 3D SR
      SeriesDescription: 'WebQX Annotations',
      ContentSequence: dicomAnnotations
    };
  }

  // Private methods

  private initializeTools(): void {
    // Tool initialization logic
  }

  private setupEventListeners(): void {
    if (!this.canvas) return;

    const mouseDownHandler = (event: MouseEvent) => this.handleMouseDown(event);
    const mouseMoveHandler = (event: MouseEvent) => this.handleMouseMove(event);
    const mouseUpHandler = (event: MouseEvent) => this.handleMouseUp(event);
    const clickHandler = (event: MouseEvent) => this.handleClick(event);

    this.canvas.addEventListener('mousedown', mouseDownHandler);
    this.canvas.addEventListener('mousemove', mouseMoveHandler);
    this.canvas.addEventListener('mouseup', mouseUpHandler);
    this.canvas.addEventListener('click', clickHandler);

    this.eventListeners.set('mousedown', [mouseDownHandler]);
    this.eventListeners.set('mousemove', [mouseMoveHandler]);
    this.eventListeners.set('mouseup', [mouseUpHandler]);
    this.eventListeners.set('click', [clickHandler]);
  }

  private setupKeyboardShortcuts(): void {
    const keyHandler = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          this.deactivateCurrentTool();
          break;
        case 't':
          if (event.ctrlKey) this.activateTool('text');
          break;
        case 'a':
          if (event.ctrlKey) this.activateTool('arrow');
          break;
        case 'c':
          if (event.ctrlKey) this.activateTool('circle');
          break;
        case 'r':
          if (event.ctrlKey) this.activateTool('rectangle');
          break;
        case 'l':
          if (event.ctrlKey) this.activateTool('length');
          break;
      }
    };

    document.addEventListener('keydown', keyHandler);
    this.eventListeners.set('keydown', [keyHandler]);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.toolState.activeTool) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.toolState.isDrawing = true;

    switch (this.toolState.activeTool) {
      case 'arrow':
      case 'length':
        this.toolState.currentAnnotation = {
          content: { coordinates: [x, y] }
        };
        break;
      case 'circle':
        this.toolState.currentAnnotation = {
          content: { coordinates: [x, y, 0] }
        };
        break;
      case 'rectangle':
        this.toolState.currentAnnotation = {
          content: { coordinates: [x, y, 0, 0] }
        };
        break;
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.toolState.isDrawing || !this.toolState.currentAnnotation) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const coords = this.toolState.currentAnnotation.content!.coordinates;

    switch (this.toolState.activeTool) {
      case 'arrow':
      case 'length':
        coords[2] = x;
        coords[3] = y;
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(x - coords[0], 2) + Math.pow(y - coords[1], 2));
        coords[2] = radius;
        break;
      case 'rectangle':
        coords[2] = x - coords[0];
        coords[3] = y - coords[1];
        break;
    }

    this.redrawPreview();
  }

  private handleMouseUp(event: MouseEvent): void {
    if (!this.toolState.isDrawing || !this.toolState.currentAnnotation) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    switch (this.toolState.activeTool) {
      case 'arrow':
        this.createArrowAnnotation(
          this.toolState.currentAnnotation.content!.coordinates[0],
          this.toolState.currentAnnotation.content!.coordinates[1],
          x, y
        );
        break;
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(x - this.toolState.currentAnnotation.content!.coordinates[0], 2) +
          Math.pow(y - this.toolState.currentAnnotation.content!.coordinates[1], 2)
        );
        this.createCircleAnnotation(
          this.toolState.currentAnnotation.content!.coordinates[0],
          this.toolState.currentAnnotation.content!.coordinates[1],
          radius
        );
        break;
      case 'rectangle':
        this.createRectangleAnnotation(
          this.toolState.currentAnnotation.content!.coordinates[0],
          this.toolState.currentAnnotation.content!.coordinates[1],
          x - this.toolState.currentAnnotation.content!.coordinates[0],
          y - this.toolState.currentAnnotation.content!.coordinates[1]
        );
        break;
      case 'length':
        this.createLengthMeasurement(
          this.toolState.currentAnnotation.content!.coordinates[0],
          this.toolState.currentAnnotation.content!.coordinates[1],
          x, y
        );
        break;
    }

    this.toolState.isDrawing = false;
    this.toolState.currentAnnotation = null;
  }

  private handleClick(event: MouseEvent): void {
    if (this.toolState.activeTool === 'text') {
      const rect = this.canvas!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const text = prompt('Enter annotation text:');
      if (text) {
        this.createTextAnnotation(x, y, text);
      }
    }
  }

  private hasToolPermission(toolName: string): boolean {
    const requiredPermissions: Record<string, Permission> = {
      'text': 'annotate_images',
      'arrow': 'annotate_images',
      'circle': 'annotate_images',
      'rectangle': 'annotate_images',
      'length': 'measure_images',
      'area': 'measure_images',
      'angle': 'measure_images'
    };

    const required = requiredPermissions[toolName];
    return required ? this.context.permissions.includes(required) : false;
  }

  private updateCursor(toolName: string): void {
    if (!this.canvas) return;

    const cursors: Record<string, string> = {
      'default': 'default',
      'text': 'text',
      'arrow': 'crosshair',
      'circle': 'crosshair',
      'rectangle': 'crosshair',
      'length': 'crosshair',
      'area': 'crosshair',
      'angle': 'crosshair'
    };

    this.canvas.style.cursor = cursors[toolName] || 'default';
  }

  private drawTextAnnotation(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.fillStyle = style.color;
    ctx.font = style.font || '14px Arial';
    ctx.globalAlpha = style.opacity;
    
    ctx.fillText(
      annotation.content.text || '',
      annotation.content.coordinates[0],
      annotation.content.coordinates[1]
    );
    
    ctx.restore();
  }

  private drawArrowAnnotation(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = style.opacity;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(coords[0], coords[1]);
    ctx.lineTo(coords[2], coords[3]);
    ctx.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(coords[3] - coords[1], coords[2] - coords[0]);
    const headLength = 10;
    
    ctx.beginPath();
    ctx.moveTo(coords[2], coords[3]);
    ctx.lineTo(
      coords[2] - headLength * Math.cos(angle - Math.PI / 6),
      coords[3] - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(coords[2], coords[3]);
    ctx.lineTo(
      coords[2] - headLength * Math.cos(angle + Math.PI / 6),
      coords[3] - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
    
    ctx.restore();
  }

  private drawCircleAnnotation(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = style.opacity;
    
    ctx.beginPath();
    ctx.arc(coords[0], coords[1], coords[2], 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.restore();
  }

  private drawRectangleAnnotation(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = style.opacity;
    
    ctx.strokeRect(coords[0], coords[1], coords[2], coords[3]);
    
    ctx.restore();
  }

  private drawLengthMeasurement(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    this.drawArrowAnnotation(annotation);
    
    // Draw measurement text
    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.fillStyle = style.color;
    ctx.font = style.font || '12px Arial';
    ctx.globalAlpha = style.opacity;
    
    const midX = (coords[0] + coords[2]) / 2;
    const midY = (coords[1] + coords[3]) / 2;
    
    ctx.fillText(annotation.content.text || '', midX, midY - 10);
    
    ctx.restore();
  }

  private drawAreaMeasurement(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = style.opacity;
    
    // Draw polygon
    ctx.beginPath();
    ctx.moveTo(coords[0], coords[1]);
    for (let i = 2; i < coords.length; i += 2) {
      ctx.lineTo(coords[i], coords[i + 1]);
    }
    ctx.closePath();
    ctx.stroke();
    
    // Draw measurement text at centroid
    const centroid = this.calculateCentroid(coords);
    ctx.fillStyle = style.color;
    ctx.font = style.font || '12px Arial';
    ctx.fillText(annotation.content.text || '', centroid.x, centroid.y);
    
    ctx.restore();
  }

  private drawAngleMeasurement(annotation: StudyAnnotation): void {
    if (!this.canvasContext) return;

    const ctx = this.canvasContext;
    const coords = annotation.content.coordinates;
    const style = annotation.content.style!;
    
    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.thickness;
    ctx.globalAlpha = style.opacity;
    
    // Draw lines
    ctx.beginPath();
    ctx.moveTo(coords[2], coords[3]); // vertex
    ctx.lineTo(coords[0], coords[1]); // first point
    ctx.moveTo(coords[2], coords[3]); // vertex
    ctx.lineTo(coords[4], coords[5]); // second point
    ctx.stroke();
    
    // Draw arc
    const angle1 = Math.atan2(coords[1] - coords[3], coords[0] - coords[2]);
    const angle2 = Math.atan2(coords[5] - coords[3], coords[4] - coords[2]);
    
    ctx.beginPath();
    ctx.arc(coords[2], coords[3], 20, angle1, angle2);
    ctx.stroke();
    
    // Draw measurement text
    ctx.fillStyle = style.color;
    ctx.font = style.font || '12px Arial';
    ctx.fillText(annotation.content.text || '', coords[2] + 25, coords[3]);
    
    ctx.restore();
  }

  private redrawPreview(): void {
    // Implementation would redraw the canvas with current annotation preview
  }

  private clearCanvas(): void {
    if (!this.canvas || !this.canvasContext) return;
    this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private calculatePolygonArea(points: number[]): number {
    let area = 0;
    const n = points.length / 2;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i * 2] * points[j * 2 + 1];
      area -= points[j * 2] * points[i * 2 + 1];
    }
    
    return Math.abs(area) / 2;
  }

  private calculateAngle(point1: number[], point2: number[], point3: number[]): number {
    const angle1 = Math.atan2(point1[1] - point2[1], point1[0] - point2[0]);
    const angle2 = Math.atan2(point3[1] - point2[1], point3[0] - point2[0]);
    let angle = Math.abs(angle2 - angle1) * (180 / Math.PI);
    
    if (angle > 180) {
      angle = 360 - angle;
    }
    
    return angle;
  }

  private calculateCentroid(points: number[]): { x: number; y: number } {
    const n = points.length / 2;
    let x = 0, y = 0;
    
    for (let i = 0; i < n; i++) {
      x += points[i * 2];
      y += points[i * 2 + 1];
    }
    
    return { x: x / n, y: y / n };
  }

  private getAnnotationCodeValue(type: string): string {
    const codes: Record<string, string> = {
      'text': '121071',
      'arrow': '121072',
      'circle': '121073',
      'rectangle': '121074',
      'measurement': '121206'
    };
    return codes[type] || '121071';
  }

  private getDICOMGraphicType(type: string): string {
    const types: Record<string, string> = {
      'text': 'POINT',
      'arrow': 'POLYLINE',
      'circle': 'CIRCLE',
      'rectangle': 'POLYLINE',
      'measurement': 'POLYLINE'
    };
    return types[type] || 'POINT';
  }

  private generateId(): string {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Remove event listeners
    this.eventListeners.forEach((listeners, event) => {
      listeners.forEach(listener => {
        if (event === 'keydown') {
          document.removeEventListener(event, listener as EventListener);
        } else if (this.canvas) {
          this.canvas.removeEventListener(event, listener as EventListener);
        }
      });
    });

    this.eventListeners.clear();
    this.canvas = null;
    this.canvasContext = null;
  }
}

// Export as default for backwards compatibility
export default WebQXImagingPlugin;