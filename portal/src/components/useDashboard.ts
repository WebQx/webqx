import { useState, useEffect, useCallback } from 'react';

export interface DashboardData {
  patients?: { count: number };
  telehealth?: { active: number; waiting: number };
  transcriptionJobs?: Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
  files?: { total: number };
  errors: Array<{
    section: string;
    error: string;
  }>;
  updated_at: string;
  cached?: boolean;
}

export interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching provider dashboard data
 * Implements caching and error handling
 */
export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determine the base URL for the API
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 
                     window.location.origin;

      const response = await fetch(`${baseUrl}/api/dashboard/provider`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Include auth token from localStorage if available
          ...(localStorage.getItem('authToken') ? {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          } : {})
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 403) {
          throw new Error('Provider role required');
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const dashboardData: DashboardData = await response.json();
      setData(dashboardData);
      setLastUpdated(new Date(dashboardData.updated_at));
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchDashboard
  };
}
