/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import { useState, useEffect, useRef } from 'react';
import { FavoriteMedication, RecentSearch, Medication } from '../types';

/**
 * Hook for managing favorite medications
 */
export const useFavoriteMedications = (userId: string) => {
  const [favorites, setFavorites] = useState<FavoriteMedication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load favorites from localStorage (in production, this would be an API call)
    const loadFavorites = () => {
      try {
        const stored = localStorage.getItem(`favorites_${userId}`);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [userId]);

  const addToFavorites = async (medication: Medication, commonDosage?: string, commonFrequency?: string) => {
    const favorite: FavoriteMedication = {
      id: `fav_${Date.now()}`,
      userId,
      medication,
      commonDosage,
      commonFrequency,
      addedDate: new Date()
    };

    const newFavorites = [...favorites, favorite];
    setFavorites(newFavorites);
    
    try {
      localStorage.setItem(`favorites_${userId}`, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Failed to save favorite:', error);
    }
  };

  const removeFromFavorites = async (medicationId: string) => {
    const newFavorites = favorites.filter(fav => fav.medication.id !== medicationId);
    setFavorites(newFavorites);
    
    try {
      localStorage.setItem(`favorites_${userId}`, JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  const isFavorite = (medicationId: string) => {
    return favorites.some(fav => fav.medication.id === medicationId);
  };

  return {
    favorites,
    isLoading,
    addToFavorites,
    removeFromFavorites,
    isFavorite
  };
};

/**
 * Hook for managing recent searches
 */
export const useRecentSearches = (userId: string, maxItems: number = 10) => {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const loadRecentSearches = () => {
      try {
        const stored = localStorage.getItem(`recent_searches_${userId}`);
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load recent searches:', error);
      }
    };

    loadRecentSearches();
  }, [userId]);

  const addRecentSearch = (searchTerm: string, resultCount: number) => {
    const search: RecentSearch = {
      id: `search_${Date.now()}`,
      userId,
      searchTerm,
      resultCount,
      timestamp: new Date()
    };

    // Remove duplicate and add to beginning
    const filtered = recentSearches.filter(s => s.searchTerm !== searchTerm);
    const newSearches = [search, ...filtered].slice(0, maxItems);
    
    setRecentSearches(newSearches);
    
    try {
      localStorage.setItem(`recent_searches_${userId}`, JSON.stringify(newSearches));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(`recent_searches_${userId}`);
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  };

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches
  };
};

/**
 * Hook for debouncing values
 */
export const useDebounce = <T>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    if (value !== debouncedValue) {
      setIsDebouncing(true);
    }

    const handler = setTimeout(() => {
      setDebouncedValue(value);
      setIsDebouncing(false);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay, debouncedValue]);

  return { debouncedValue, isDebouncing };
};

/**
 * Hook for async operations with loading, error, and data states
 */
export const useAsyncOperation = <T, Args extends any[]>(
  asyncFunction: (...args: Args) => Promise<T>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = async (...args: Args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await asyncFunction(...args);
      
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const reset = () => {
    setData(null);
    setError(null);
    setLoading(false);
  };

  return { data, loading, error, execute, reset };
};

/**
 * Hook for managing local storage with JSON serialization
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  const removeValue = () => {
    try {
      setStoredValue(initialValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue] as const;
};

/**
 * Hook for pagination functionality
 */
export const usePagination = <T>(items: T[], pageSize: number = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(items.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentItems = items.slice(startIndex, endIndex);
  
  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };
  
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const hasNext = currentPage < totalPages;
  const hasPrev = currentPage > 1;
  
  return {
    currentItems,
    currentPage,
    totalPages,
    pageSize,
    totalItems: items.length,
    hasNext,
    hasPrev,
    goToPage,
    nextPage,
    prevPage
  };
};

/**
 * Hook for tracking online/offline status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return isOnline;
};

/**
 * Hook for managing error boundary-like behavior in functional components
 */
export const useErrorHandler = () => {
  const [error, setError] = useState<Error | null>(null);

  const resetError = () => setError(null);

  const handleError = (error: Error) => {
    console.error('Error caught by useErrorHandler:', error);
    setError(error);
  };

  useEffect(() => {
    if (error) {
      // In a real app, you might want to report this to an error tracking service
      console.error('Component error:', error);
    }
  }, [error]);

  return { error, resetError, handleError };
};