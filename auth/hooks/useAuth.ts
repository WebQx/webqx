import { useState, useEffect } from 'react';
import { UseAuthReturn, User } from '../types';

/**
 * Hook for authentication and role verification
 * Checks if the user has the required specialty access
 */
export const useAuth = (requiredSpecialty?: string): UseAuthReturn => {
  const [user, setUser] = useState<User>({
    id: "user123",
    name: "Dr. Sarah Johnson",
    email: "s.johnson@hospital.com",
    role: "physician",
    specialty: "cardiology"
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if the user's role is verified for the required specialty
  const roleVerified = requiredSpecialty 
    ? user.specialty === requiredSpecialty || user.role === "admin"
    : true;

  useEffect(() => {
    // In a real implementation, this would fetch user data from an API
    // and verify their authentication status
    setIsLoading(false);
  }, []);

  return {
    user,
    roleVerified,
    isLoading,
    error
  };
};