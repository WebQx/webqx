/**
 * UI component types
 */

export interface MicButtonProps {
  onClick: () => void;
  'aria-label'?: string;
  disabled?: boolean;
}

export interface SubmitButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  'aria-label'?: string;
  disabled?: boolean;
}

export interface NotePreviewProps {
  data: any;
  className?: string;
}