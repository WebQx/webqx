import React from 'react';
import { NotePreviewProps } from './types';

/**
 * Note Preview Component
 * Displays a preview of the structured clinical note
 */
const NotePreview: React.FC<NotePreviewProps> = ({ data, className = "" }) => {
  if (!data) {
    return (
      <div className={`note-preview ${className}`}>
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          No note data to preview. Start recording to generate a note.
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`note-preview ${className}`}
      style={{
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '16px',
        backgroundColor: '#f9f9f9',
        margin: '16px 0'
      }}
    >
      <h3 style={{ marginTop: 0, color: '#333' }}>📝 Note Preview</h3>
      
      {data.originalText && (
        <div style={{ marginBottom: '12px' }}>
          <strong>Original Transcript:</strong>
          <p style={{ 
            background: 'white', 
            padding: '8px', 
            borderRadius: '4px', 
            margin: '4px 0' 
          }}>
            {data.originalText}
          </p>
        </div>
      )}

      {data.mappedMedications && data.mappedMedications.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <strong>Mapped Medications (RxNorm):</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            {data.mappedMedications.map((med: string, index: number) => (
              <li key={index}>{med}</li>
            ))}
          </ul>
        </div>
      )}

      {data.confidence !== undefined && (
        <div style={{ fontSize: '14px', color: '#666' }}>
          <strong>Mapping Confidence:</strong> {(data.confidence * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
};

export default NotePreview;