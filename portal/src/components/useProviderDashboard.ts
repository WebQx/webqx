import { useState, useEffect, useRef } from 'react';

interface ProviderDashboardData {
  patients?: { count: number };
  telehealth?: { active: number; waiting: number };
  transcriptionJobs?: Array<{ id: string; status: string; created_at: string }>;
  files?: { total: number };
  errors?: Array<{ section: string; error: string }>;
  updated_at: string;
}

interface UseProviderDashboardReturn {
  data: ProviderDashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching provider dashboard data
 * Polls every 60s, pauses when document is hidden
 */
export function useProviderDashboard(): UseProviderDashboardReturn {
  const [data, setData] = useState<ProviderDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);

  const fetchDashboard = async () => {
    // Don't fetch if document is hidden
    if (!isVisibleRef.current) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get base URL from environment or current origin
      const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      
      const response = await fetch(`${baseUrl}/api/dashboard/provider`, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please log in.');
        }
        if (response.status === 403) {
          throw new Error('Provider role required.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const dashboardData = await response.json();
      setData(dashboardData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      console.error('Provider dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      // Fetch immediately when becoming visible
      if (!document.hidden && data === null) {
        fetchDashboard();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [data]);

  // Setup polling
  useEffect(() => {
    // Initial fetch
    fetchDashboard();

    // Poll every 60 seconds
    intervalRef.current = window.setInterval(() => {
      if (!document.hidden) {
        fetchDashboard();
      }
    }, 60000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const refresh = async () => {
    await fetchDashboard();
  };

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh
  };
}
