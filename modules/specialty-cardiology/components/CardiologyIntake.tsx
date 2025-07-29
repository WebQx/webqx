import { useWhisper } from "@/modules/transcription/hooks/useWhisper";
import { mapToRxNorm } from "@/interoperability/rxnorm/mapper";
import { saveToEHR } from "@/ehr-integrations/openemr/api";
import { useAuth } from "@/auth/hooks/useAuth";
import { useAuditLog } from "@/auth/logging/logger";
import CardiologyLayout from "@/modules/specialty-cardiology/components/Layout";
import MicButton from "@/modules/ui/MicButton";
import NotePreview from "@/modules/ui/NotePreview";
import SubmitButton from "@/modules/ui/SubmitButton";
import { useState } from "react";

/**
 * CardiologyIntake Component
 * 
 * A comprehensive cardiology intake form with voice transcription capabilities.
 * Includes error handling, loading states, TypeScript types, and accessibility features.
 */
export const CardiologyIntake: React.FC = () => {
  // Hook for voice transcription with English language setting
  const { startRecording, transcript } = useWhisper("en");
  
  // Authentication hook with cardiology specialty verification
  const { user, roleVerified } = useAuth("cardiology");
  
  // Audit logging hook for compliance and monitoring
  const logAction = useAuditLog();

  // State for loading and error messages
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Map transcript to RxNorm format for standardized medication data
  const note = mapToRxNorm(transcript);

  /**
   * Handles form submission with comprehensive error handling and logging
   */
  const handleSubmit = async (): Promise<void> => {
    // Verify user has required permissions before proceeding
    if (!roleVerified) {
      alert("Access Denied");
      return;
    }

    // Reset error state and start loading
    setIsLoading(true);
    setError(null);

    try {
      // Save the note to the EHR system
      await saveToEHR("cardiology", note, user.id);

      // Log the successful action for audit trail
      logAction({
        user: user.id,
        module: "CardiologyIntake",
        action: "Submitted transcript",
        timestamp: new Date().toISOString(),
        status: "success",
      });

      alert("Note successfully submitted!");
    } catch (err) {
      // Handle errors and provide user feedback
      const errorMessage = "Error submitting the note. Please try again.";
      setError(errorMessage);
      
      // Log the failure for troubleshooting and audit purposes
      logAction({
        user: user.id,
        module: "CardiologyIntake",
        action: "Failed to submit transcript",
        timestamp: new Date().toISOString(),
        status: "failure",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      // Always reset loading state when operation completes
      setIsLoading(false);
    }
  };

  return (
    <CardiologyLayout>
      {/* Microphone button to start recording with accessibility label */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <MicButton onClick={startRecording} aria-label="Start recording" />
        <p style={{ marginTop: '8px', color: '#666' }}>
          Click the microphone to start voice recording
        </p>
      </div>

      {/* Preview the generated note with RxNorm mappings */}
      <NotePreview data={note} />

      {/* Submit button with loading state and accessibility features */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <SubmitButton
          onClick={handleSubmit}
          isLoading={isLoading}
          aria-label="Submit note"
        />
      </div>

      {/* Display error message if any with proper styling and accessibility */}
      {error && (
        <div 
          role="alert"
          style={{ 
            color: "red", 
            backgroundColor: "#ffebee",
            border: "1px solid #ffcdd2",
            borderRadius: "4px",
            padding: "12px",
            marginTop: "16px",
            textAlign: "center"
          }}
        >
          ❌ {error}
        </div>
      )}
    </CardiologyLayout>
  );
};