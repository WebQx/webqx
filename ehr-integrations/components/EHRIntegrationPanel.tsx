/**
 * EHR Integration Panel Component
 * 
 * Main user interface component for managing EHR integrations.
 * Provides a comprehensive dashboard for configuration, monitoring,
 * and control of EHR system connections with full accessibility support.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  EHRConfiguration,
  EHRSystemType,
  ConnectionStatus,
  SyncOperation,
  SyncProgress,
  LoadingState,
  ErrorState
} from '../types';
import { EHRService } from '../services/ehrService';
import { AuditLogger } from '../services/auditLogger';

/**
 * Component props interface
 */
export interface EHRIntegrationPanelProps {
  /** CSS class name for styling */
  className?: string;
  /** Component ID for accessibility */
  id?: string;
  /** Whether the panel is in read-only mode */
  readOnly?: boolean;
  /** Initial EHR configurations */
  initialConfigurations?: EHRConfiguration[];
  /** Callback when configuration is added */
  onConfigurationAdded?: (config: EHRConfiguration) => void;
  /** Callback when configuration is updated */
  onConfigurationUpdated?: (config: EHRConfiguration) => void;
  /** Callback when configuration is removed */
  onConfigurationRemoved?: (configId: string) => void;
  /** Callback when sync operation starts */
  onSyncStarted?: (operation: SyncOperation) => void;
  /** Callback when sync operation completes */
  onSyncCompleted?: (operation: SyncOperation) => void;
  /** Custom EHR service instance */
  ehrService?: EHRService;
  /** Enable detailed logging */
  enableLogging?: boolean;
}

/**
 * Configuration form data
 */
interface ConfigurationFormData {
  name: string;
  systemType: EHRSystemType;
  baseUrl: string;
  apiVersion: string;
  authenticationType: 'oauth2' | 'apikey' | 'basic' | 'certificate' | 'jwt';
  clientId: string;
  clientSecret: string;
  apiKey: string;
  username: string;
  password: string;
  tokenEndpoint: string;
  authEndpoint: string;
  scopes: string;
  certificatePath: string;
  timeoutMs: number;
  maxRetryAttempts: number;
  isActive: boolean;
}

/**
 * Tab types for the panel
 */
type TabType = 'overview' | 'configurations' | 'monitoring' | 'logs';

/**
 * EHR Integration Panel Component
 * 
 * Comprehensive interface for managing EHR integrations with:
 * - Configuration management
 * - Real-time connection monitoring
 * - Sync operation control
 * - Audit logging
 * - Full accessibility support
 */
export const EHRIntegrationPanel: React.FC<EHRIntegrationPanelProps> = ({
  className = '',
  id = 'ehr-integration-panel',
  readOnly = false,
  initialConfigurations = [],
  onConfigurationAdded,
  onConfigurationUpdated,
  onConfigurationRemoved,
  onSyncStarted,
  onSyncCompleted,
  ehrService: customEhrService,
  enableLogging = true
}) => {
  // ============================================================================
  // State Management
  // ============================================================================

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [configurations, setConfigurations] = useState<EHRConfiguration[]>(initialConfigurations);
  const [connectionStatuses, setConnectionStatuses] = useState<Map<string, ConnectionStatus>>(new Map());
  const [activeOperations, setActiveOperations] = useState<Map<string, SyncProgress>>(new Map());
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false });
  const [errorState, setErrorState] = useState<ErrorState>({ hasError: false });
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<EHRConfiguration | null>(null);
  const [formData, setFormData] = useState<ConfigurationFormData>(getDefaultFormData());

  // Services
  const ehrService = useRef(customEhrService || new EHRService());
  const auditLogger = useRef(new AuditLogger());

  // Refs for accessibility
  const alertRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Initialize component and load configurations
   */
  useEffect(() => {
    initializePanel();
    
    // Set up periodic status updates
    const statusInterval = setInterval(() => {
      updateConnectionStatuses();
      updateOperationStatuses();
    }, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  /**
   * Log user actions if logging is enabled
   */
  useEffect(() => {
    if (enableLogging) {
      auditLogger.current.log({
        action: 'view_patient_data',
        resourceType: 'ehr_integration_panel',
        resourceId: id,
        success: true,
        context: {
          activeTab,
          configurationsCount: configurations.length,
          activeOperationsCount: activeOperations.size
        }
      }).catch(error => {
        console.error('Failed to log panel access:', error);
      });
    }
  }, [activeTab, configurations.length, activeOperations.size, enableLogging, id]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle tab change
   */
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    announceToScreenReader(`Switched to ${tab} tab`);
  }, []);

  /**
   * Handle configuration form submission
   */
  const handleConfigurationSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (readOnly) {
      setErrorState({
        hasError: true,
        message: 'Panel is in read-only mode',
        retryable: false
      });
      return;
    }

    setLoadingState({ isLoading: true, message: 'Saving configuration...' });
    setErrorState({ hasError: false });

    try {
      // Validate form data
      const validationErrors = validateFormData(formData);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      // Create configuration object
      const config: EHRConfiguration = {
        id: editingConfig?.id || `config_${Date.now()}`,
        name: formData.name.trim(),
        systemType: formData.systemType,
        baseUrl: formData.baseUrl.trim(),
        apiVersion: formData.apiVersion.trim(),
        authentication: {
          type: formData.authenticationType,
          clientId: formData.clientId.trim() || undefined,
          clientSecret: formData.clientSecret.trim() || undefined,
          apiKey: formData.apiKey.trim() || undefined,
          username: formData.username.trim() || undefined,
          password: formData.password.trim() || undefined,
          tokenEndpoint: formData.tokenEndpoint.trim() || undefined,
          authEndpoint: formData.authEndpoint.trim() || undefined,
          scopes: formData.scopes ? formData.scopes.split(',').map(s => s.trim()) : undefined,
          certificatePath: formData.certificatePath.trim() || undefined
        },
        timeoutMs: formData.timeoutMs,
        retryConfig: {
          maxAttempts: formData.maxRetryAttempts,
          initialDelayMs: 1000,
          backoffMultiplier: 2,
          maxDelayMs: 30000,
          useJitter: true
        },
        isActive: formData.isActive,
        createdAt: editingConfig?.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Add or update configuration
      const result = await ehrService.current.addConfiguration(config);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to save configuration');
      }

      // Update local state
      if (editingConfig) {
        setConfigurations(prev => prev.map(c => c.id === config.id ? config : c));
        onConfigurationUpdated?.(config);
        announceToScreenReader('Configuration updated successfully');
      } else {
        setConfigurations(prev => [...prev, config]);
        onConfigurationAdded?.(config);
        announceToScreenReader('Configuration added successfully');
      }

      // Reset form
      setShowConfigForm(false);
      setEditingConfig(null);
      setFormData(getDefaultFormData());

      // Log the action
      if (enableLogging) {
        auditLogger.current.log({
          action: 'configure_ehr',
          resourceType: 'ehr_configuration',
          resourceId: config.id,
          success: true,
          context: {
            action: editingConfig ? 'updated' : 'created',
            configName: config.name,
            systemType: config.systemType
          }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorState({
        hasError: true,
        message: errorMessage,
        retryable: true
      });
      announceToScreenReader(`Error: ${errorMessage}`);

      // Log the error
      if (enableLogging) {
        auditLogger.current.log({
          action: 'configure_ehr',
          resourceType: 'ehr_configuration',
          resourceId: editingConfig?.id || 'new',
          success: false,
          errorMessage,
          context: {
            action: editingConfig ? 'update_failed' : 'create_failed'
          }
        });
      }
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [formData, editingConfig, readOnly, onConfigurationAdded, onConfigurationUpdated, enableLogging]);

  /**
   * Handle configuration deletion
   */
  const handleConfigurationDelete = useCallback(async (configId: string) => {
    if (readOnly) {
      setErrorState({
        hasError: true,
        message: 'Panel is in read-only mode',
        retryable: false
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    setLoadingState({ isLoading: true, message: 'Deleting configuration...' });

    try {
      const result = await ehrService.current.removeConfiguration(configId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete configuration');
      }

      setConfigurations(prev => prev.filter(c => c.id !== configId));
      setConnectionStatuses(prev => {
        const newStatuses = new Map(prev);
        newStatuses.delete(configId);
        return newStatuses;
      });

      onConfigurationRemoved?.(configId);
      announceToScreenReader('Configuration deleted successfully');

      // Log the action
      if (enableLogging) {
        auditLogger.current.log({
          action: 'configure_ehr',
          resourceType: 'ehr_configuration',
          resourceId: configId,
          success: true,
          context: { action: 'deleted' }
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete configuration';
      setErrorState({
        hasError: true,
        message: errorMessage,
        retryable: true
      });
      announceToScreenReader(`Error: ${errorMessage}`);
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [readOnly, onConfigurationRemoved, enableLogging]);

  /**
   * Handle connection toggle
   */
  const handleConnectionToggle = useCallback(async (configId: string) => {
    const currentStatus = connectionStatuses.get(configId) || 'disconnected';
    const isConnecting = currentStatus === 'connecting';
    const isConnected = currentStatus === 'connected';

    if (isConnecting) {
      return; // Don't allow toggle while connecting
    }

    setLoadingState({ 
      isLoading: true, 
      message: isConnected ? 'Disconnecting...' : 'Connecting...' 
    });

    try {
      const result = isConnected 
        ? await ehrService.current.disconnect(configId)
        : await ehrService.current.connect(configId);

      if (!result.success) {
        throw new Error(result.error?.message || `Failed to ${isConnected ? 'disconnect' : 'connect'}`);
      }

      // Update connection status
      updateConnectionStatuses();
      
      const action = isConnected ? 'disconnected' : 'connected';
      announceToScreenReader(`EHR system ${action} successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection operation failed';
      setErrorState({
        hasError: true,
        message: errorMessage,
        retryable: true
      });
      announceToScreenReader(`Error: ${errorMessage}`);
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [connectionStatuses]);

  /**
   * Handle sync operation start
   */
  const handleSyncStart = useCallback(async (configId: string, patientMrn: string) => {
    setLoadingState({ isLoading: true, message: 'Starting sync operation...' });

    try {
      const result = await ehrService.current.startSync(configId, patientMrn);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to start sync');
      }

      onSyncStarted?.(result.data!);
      announceToScreenReader('Sync operation started');

      // Monitor sync progress
      monitorSyncOperation(result.data!.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start sync';
      setErrorState({
        hasError: true,
        message: errorMessage,
        retryable: true
      });
      announceToScreenReader(`Error: ${errorMessage}`);
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, [onSyncStarted]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Initialize the panel
   */
  const initializePanel = useCallback(async () => {
    setLoadingState({ isLoading: true, message: 'Loading EHR integrations...' });

    try {
      // Update connection statuses for existing configurations
      await updateConnectionStatuses();
      setErrorState({ hasError: false });
    } catch (error) {
      setErrorState({
        hasError: true,
        message: 'Failed to load EHR integration data',
        retryable: true
      });
    } finally {
      setLoadingState({ isLoading: false });
    }
  }, []);

  /**
   * Update connection statuses for all configurations
   */
  const updateConnectionStatuses = useCallback(async () => {
    const newStatuses = new Map<string, ConnectionStatus>();
    
    for (const config of configurations) {
      const status = ehrService.current.getConnectionStatus(config.id);
      newStatuses.set(config.id, status);
    }
    
    setConnectionStatuses(newStatuses);
  }, [configurations]);

  /**
   * Update operation statuses
   */
  const updateOperationStatuses = useCallback(async () => {
    // This would normally check for active operations and update their status
    // For now, we'll implement a basic version
    setActiveOperations(prev => new Map(prev));
  }, []);

  /**
   * Monitor sync operation progress
   */
  const monitorSyncOperation = useCallback(async (operationId: string) => {
    const checkProgress = async () => {
      try {
        const result = await ehrService.current.getSyncStatus(operationId);
        if (result.success && result.data) {
          setActiveOperations(prev => {
            const newOps = new Map(prev);
            newOps.set(operationId, result.data!);
            return newOps;
          });

          // If operation is complete, stop monitoring
          if (result.data.status === 'completed' || result.data.status === 'failed') {
            // Notify completion
            if (result.data.status === 'completed') {
              announceToScreenReader('Sync operation completed successfully');
            } else {
              announceToScreenReader('Sync operation failed');
            }
            return;
          }

          // Continue monitoring
          setTimeout(checkProgress, 2000);
        }
      } catch (error) {
        console.error('Failed to check sync progress:', error);
      }
    };

    checkProgress();
  }, []);

  /**
   * Announce message to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    if (alertRef.current) {
      alertRef.current.textContent = message;
      // Clear after a delay
      setTimeout(() => {
        if (alertRef.current) {
          alertRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  /**
   * Validate form data
   */
  const validateFormData = (data: ConfigurationFormData): string[] => {
    const errors: string[] = [];

    if (!data.name.trim()) errors.push('Configuration name is required');
    if (!data.baseUrl.trim()) errors.push('Base URL is required');
    if (!data.apiVersion.trim()) errors.push('API version is required');
    if (data.timeoutMs < 1000 || data.timeoutMs > 300000) {
      errors.push('Timeout must be between 1 and 300 seconds');
    }

    // Authentication-specific validation
    switch (data.authenticationType) {
      case 'oauth2':
        if (!data.clientId.trim()) errors.push('Client ID is required for OAuth2');
        if (!data.tokenEndpoint.trim()) errors.push('Token endpoint is required for OAuth2');
        break;
      case 'apikey':
        if (!data.apiKey.trim()) errors.push('API key is required');
        break;
      case 'basic':
        if (!data.username.trim()) errors.push('Username is required for basic auth');
        if (!data.password.trim()) errors.push('Password is required for basic auth');
        break;
      case 'certificate':
        if (!data.certificatePath.trim()) errors.push('Certificate path is required');
        break;
    }

    return errors;
  };

  /**
   * Get default form data
   */
  function getDefaultFormData(): ConfigurationFormData {
    return {
      name: '',
      systemType: 'epic',
      baseUrl: '',
      apiVersion: 'v1',
      authenticationType: 'oauth2',
      clientId: '',
      clientSecret: '',
      apiKey: '',
      username: '',
      password: '',
      tokenEndpoint: '',
      authEndpoint: '',
      scopes: '',
      certificatePath: '',
      timeoutMs: 30000,
      maxRetryAttempts: 3,
      isActive: true
    };
  }

  /**
   * Get status color for display
   */
  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return '#10b981'; // green
      case 'connecting': return '#f59e0b'; // yellow
      case 'error': return '#ef4444'; // red
      case 'disconnected': default: return '#6b7280'; // gray
    }
  };

  /**
   * Get status icon for display
   */
  const getStatusIcon = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return '✓';
      case 'connecting': return '⟳';
      case 'error': return '⚠';
      case 'disconnected': default: return '○';
    }
  };

  // ============================================================================
  // Render Components
  // ============================================================================

  /**
   * Render tab navigation
   */
  const renderTabs = () => (
    <div 
      className="ehr-panel-tabs" 
      role="tablist"
      aria-label="EHR Integration Panel Tabs"
      style={{
        display: 'flex',
        borderBottom: '2px solid #e5e7eb',
        marginBottom: '1.5rem'
      }}
    >
      {[
        { key: 'overview', label: 'Overview' },
        { key: 'configurations', label: 'Configurations' },
        { key: 'monitoring', label: 'Monitoring' },
        { key: 'logs', label: 'Audit Logs' }
      ].map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`${id}-${tab.key}-panel`}
          id={`${id}-${tab.key}-tab`}
          onClick={() => handleTabChange(tab.key as TabType)}
          disabled={loadingState.isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === tab.key ? '#3b82f6' : 'transparent',
            color: activeTab === tab.key ? 'white' : '#374151',
            cursor: loadingState.isLoading ? 'not-allowed' : 'pointer',
            fontWeight: activeTab === tab.key ? '600' : '400',
            borderRadius: '0.25rem 0.25rem 0 0',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseEnter={(e) => {
            if (!loadingState.isLoading && activeTab !== tab.key) {
              (e.target as HTMLElement).style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.key) {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  /**
   * Render overview tab
   */
  const renderOverviewTab = () => (
    <div
      id={`${id}-overview-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-overview-tab`}
      style={{ padding: '1rem 0' }}
    >
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>
        EHR Integration Overview
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Summary Cards */}
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '0.5rem',
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
            Total Configurations
          </h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
            {configurations.length}
          </p>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '0.5rem',
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
            Active Connections
          </h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
            {Array.from(connectionStatuses.values()).filter(status => status === 'connected').length}
          </p>
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '0.5rem',
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
            Active Operations
          </h3>
          <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {activeOperations.size}
          </p>
        </div>
      </div>

      {/* Recent Configurations */}
      {configurations.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
            Recent Configurations
          </h3>
          <div style={{ 
            border: '1px solid #e5e7eb', 
            borderRadius: '0.5rem',
            overflow: 'hidden'
          }}>
            {configurations.slice(0, 5).map((config, index) => (
              <div
                key={config.id}
                style={{
                  padding: '1rem',
                  borderBottom: index < 4 ? '1px solid #e5e7eb' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: '600' }}>
                    {config.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                    {config.systemType} • {config.baseUrl}
                  </p>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: getStatusColor(connectionStatuses.get(config.id) || 'disconnected')
                }}>
                  <span aria-hidden="true">
                    {getStatusIcon(connectionStatuses.get(config.id) || 'disconnected')}
                  </span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                    {connectionStatuses.get(config.id) || 'disconnected'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Render configurations tab
   */
  const renderConfigurationsTab = () => (
    <div
      id={`${id}-configurations-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-configurations-tab`}
      style={{ padding: '1rem 0' }}
    >
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem' 
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
          EHR Configurations
        </h2>
        {!readOnly && (
          <button
            onClick={() => {
              setShowConfigForm(true);
              setEditingConfig(null);
              setFormData(getDefaultFormData());
            }}
            disabled={loadingState.isLoading}
            aria-label="Add new EHR configuration"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: loadingState.isLoading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: loadingState.isLoading ? 0.6 : 1
            }}
          >
            + Add Configuration
          </button>
        )}
      </div>

      {/* Configuration List */}
      {configurations.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#6b7280',
          border: '2px dashed #d1d5db',
          borderRadius: '0.5rem'
        }}>
          <p style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
            No EHR configurations found
          </p>
          <p style={{ margin: 0 }}>
            Add your first configuration to get started with EHR integration.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configurations.map(config => (
            <div
              key={config.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                backgroundColor: 'white'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '1rem'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
                    {config.name}
                  </h3>
                  <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280' }}>
                    {config.systemType} • API {config.apiVersion}
                  </p>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                    {config.baseUrl}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Connection Status */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    backgroundColor: getStatusColor(connectionStatuses.get(config.id) || 'disconnected') + '20',
                    color: getStatusColor(connectionStatuses.get(config.id) || 'disconnected')
                  }}>
                    <span aria-hidden="true">
                      {getStatusIcon(connectionStatuses.get(config.id) || 'disconnected')}
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                      {connectionStatuses.get(config.id) || 'disconnected'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleConnectionToggle(config.id)}
                        disabled={loadingState.isLoading || connectionStatuses.get(config.id) === 'connecting'}
                        aria-label={`${connectionStatuses.get(config.id) === 'connected' ? 'Disconnect' : 'Connect'} ${config.name}`}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: connectionStatuses.get(config.id) === 'connected' ? '#ef4444' : '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        {connectionStatuses.get(config.id) === 'connected' ? 'Disconnect' : 'Connect'}
                      </button>

                      <button
                        onClick={() => {
                          setEditingConfig(config);
                          setFormData({
                            name: config.name,
                            systemType: config.systemType,
                            baseUrl: config.baseUrl,
                            apiVersion: config.apiVersion,
                            authenticationType: config.authentication.type,
                            clientId: config.authentication.clientId || '',
                            clientSecret: config.authentication.clientSecret || '',
                            apiKey: config.authentication.apiKey || '',
                            username: config.authentication.username || '',
                            password: config.authentication.password || '',
                            tokenEndpoint: config.authentication.tokenEndpoint || '',
                            authEndpoint: config.authentication.authEndpoint || '',
                            scopes: config.authentication.scopes?.join(', ') || '',
                            certificatePath: config.authentication.certificatePath || '',
                            timeoutMs: config.timeoutMs,
                            maxRetryAttempts: config.retryConfig.maxAttempts,
                            isActive: config.isActive
                          });
                          setShowConfigForm(true);
                        }}
                        disabled={loadingState.isLoading}
                        aria-label={`Edit ${config.name} configuration`}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleConfigurationDelete(config.id)}
                        disabled={loadingState.isLoading}
                        aria-label={`Delete ${config.name} configuration`}
                        style={{
                          padding: '0.5rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Configuration Details */}
              <div style={{ 
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.25rem',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <strong>Authentication:</strong> {config.authentication.type}
                  </div>
                  <div>
                    <strong>Timeout:</strong> {config.timeoutMs / 1000}s
                  </div>
                  <div>
                    <strong>Max Retries:</strong> {config.retryConfig.maxAttempts}
                  </div>
                  <div>
                    <strong>Active:</strong> {config.isActive ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Form Modal */}
      {showConfigForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="config-form-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowConfigForm(false);
              setEditingConfig(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90%',
              overflow: 'auto'
            }}
          >
            <h2 id="config-form-title" style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem' }}>
              {editingConfig ? 'Edit Configuration' : 'Add New Configuration'}
            </h2>

            <form ref={formRef} onSubmit={handleConfigurationSubmit}>
              {/* Form fields would go here - abbreviated for space */}
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label htmlFor="config-name" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Configuration Name *
                  </label>
                  <input
                    id="config-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    aria-describedby="name-help"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.25rem',
                      fontSize: '1rem'
                    }}
                  />
                  <div id="name-help" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    A descriptive name for this EHR configuration
                  </div>
                </div>

                <div>
                  <label htmlFor="config-system-type" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    EHR System Type *
                  </label>
                  <select
                    id="config-system-type"
                    value={formData.systemType}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemType: e.target.value as EHRSystemType }))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.25rem',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="epic">Epic</option>
                    <option value="cerner">Cerner</option>
                    <option value="allscripts">Allscripts</option>
                    <option value="athenahealth">AthenaHealth</option>
                    <option value="nextgen">NextGen</option>
                    <option value="eclinicalworks">eClinicalWorks</option>
                    <option value="meditech">Meditech</option>
                    <option value="fhir_generic">FHIR Generic</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Additional form fields would be here */}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigForm(false);
                    setEditingConfig(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'transparent',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.25rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingState.isLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: loadingState.isLoading ? 'not-allowed' : 'pointer',
                    opacity: loadingState.isLoading ? 0.6 : 1
                  }}
                >
                  {loadingState.isLoading ? 'Saving...' : (editingConfig ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Render monitoring tab
   */
  const renderMonitoringTab = () => (
    <div
      id={`${id}-monitoring-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-monitoring-tab`}
      style={{ padding: '1rem 0' }}
    >
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}>
        EHR Monitoring
      </h2>
      
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: '#6b7280',
        border: '2px dashed #d1d5db',
        borderRadius: '0.5rem'
      }}>
        <p style={{ margin: 0, fontSize: '1.125rem' }}>
          Real-time monitoring dashboard coming soon
        </p>
      </div>
    </div>
  );

  /**
   * Render logs tab
   */
  const renderLogsTab = () => (
    <div
      id={`${id}-logs-panel`}
      role="tabpanel"
      aria-labelledby={`${id}-logs-tab`}
      style={{ padding: '1rem 0' }}
    >
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '600' }}>
        Audit Logs
      </h2>
      
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: '#6b7280',
        border: '2px dashed #d1d5db',
        borderRadius: '0.5rem'
      }}>
        <p style={{ margin: 0, fontSize: '1.125rem' }}>
          Audit log viewer coming soon
        </p>
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div
      id={id}
      className={`ehr-integration-panel ${className}`}
      role="region"
      aria-label="EHR Integration Management Panel"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '1.5rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Screen Reader Announcements */}
      <div
        ref={alertRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      />

      {/* Loading Indicator */}
      {loadingState.isLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            padding: '1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '0.5rem',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          {loadingState.message || 'Loading...'}
        </div>
      )}

      {/* Error Display */}
      {errorState.hasError && (
        <div
          role="alert"
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#dc2626'
          }}
        >
          <strong>Error:</strong> {errorState.message}
          {errorState.retryable && (
            <button
              onClick={() => setErrorState({ hasError: false })}
              style={{
                marginLeft: '1rem',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: '700' }}>
          EHR Integration Management
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '1.125rem' }}>
          Configure and manage Electronic Health Record system integrations
        </p>
      </header>

      {/* Tab Navigation */}
      {renderTabs()}

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'configurations' && renderConfigurationsTab()}
      {activeTab === 'monitoring' && renderMonitoringTab()}
      {activeTab === 'logs' && renderLogsTab()}

      {/* CSS for animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EHRIntegrationPanel;