/**
 * PACS Provider Dashboard Component
 * 
 * React component for provider-facing PACS interface.
 * Provides imaging workflow management, study viewing, and reporting capabilities.
 */

import React, { useState, useEffect } from 'react';
import { 
  DICOMStudy, 
  ImagingOrder, 
  ImagingReport, 
  ProviderImagingWorkflow,
  ImagingSearchCriteria 
} from '../../types';
import { PACSService } from '../../services/pacsService';
import { ImagingWorkflowService } from '../../services/imagingWorkflowService';

interface PACSProviderDashboardProps {
  providerID: string;
  className?: string;
  onStudySelect?: (study: DICOMStudy) => void;
  onOrderCreate?: (order: ImagingOrder) => void;
}

export const PACSProviderDashboard: React.FC<PACSProviderDashboardProps> = ({
  providerID,
  className = '',
  onStudySelect,
  onOrderCreate
}) => {
  const [activeTab, setActiveTab] = useState<'worklist' | 'studies' | 'reports' | 'orders'>('worklist');
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [reports, setReports] = useState<ImagingReport[]>([]);
  const [workflow, setWorkflow] = useState<ProviderImagingWorkflow | null>(null);
  const [searchCriteria, setSearchCriteria] = useState<ImagingSearchCriteria>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pacsService = new PACSService();
  const workflowService = new ImagingWorkflowService(pacsService);

  useEffect(() => {
    loadProviderData();
  }, [providerID]);

  const loadProviderData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load provider orders
      const ordersResult = await workflowService.getOrdersByProvider(providerID);
      if (ordersResult.success && ordersResult.data) {
        setOrders(ordersResult.data);
      }

      // Load studies for search criteria
      if (Object.keys(searchCriteria).length > 0) {
        const studiesResult = await pacsService.searchStudies(searchCriteria);
        if (studiesResult.success && studiesResult.data) {
          setStudies(studiesResult.data.studies);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load provider data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (criteria: ImagingSearchCriteria) => {
    setSearchCriteria(criteria);
    setLoading(true);

    try {
      const result = await pacsService.searchStudies(criteria);
      if (result.success && result.data) {
        setStudies(result.data.studies);
      } else {
        setError(result.error?.message || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStudyView = (study: DICOMStudy) => {
    if (onStudySelect) {
      onStudySelect(study);
    } else {
      // Open study in viewer
      const viewerUrl = pacsService.getViewerURL(study.studyInstanceUID);
      window.open(viewerUrl, '_blank');
    }
  };

  const handleOrderStatusUpdate = async (orderID: string, status: ImagingOrder['status']) => {
    try {
      const result = await workflowService.updateOrderStatus(orderID, status);
      if (result.success) {
        await loadProviderData(); // Refresh data
      } else {
        setError(result.error?.message || 'Failed to update order status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  };

  return (
    <div className={`pacs-provider-dashboard ${className}`}>
      <div className="dashboard-header">
        <h2>PACS Provider Dashboard</h2>
        <div className="provider-info">
          <span>Provider ID: {providerID}</span>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">×</button>
        </div>
      )}

      <div className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'worklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('worklist')}
        >
          Worklist
        </button>
        <button 
          className={`tab ${activeTab === 'studies' ? 'active' : ''}`}
          onClick={() => setActiveTab('studies')}
        >
          Studies
        </button>
        <button 
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
        <button 
          className={`tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'worklist' && (
          <WorklistTab 
            orders={orders}
            onOrderStatusUpdate={handleOrderStatusUpdate}
            loading={loading}
          />
        )}

        {activeTab === 'studies' && (
          <StudiesTab 
            studies={studies}
            onSearch={handleSearch}
            onStudyView={handleStudyView}
            loading={loading}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsTab 
            reports={reports}
            loading={loading}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTab 
            orders={orders}
            onOrderCreate={onOrderCreate}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

// Worklist Tab Component
const WorklistTab: React.FC<{
  orders: ImagingOrder[];
  onOrderStatusUpdate: (orderID: string, status: ImagingOrder['status']) => void;
  loading: boolean;
}> = ({ orders, onOrderStatusUpdate, loading }) => {
  const pendingOrders = orders.filter(order => 
    ['ordered', 'scheduled', 'in-progress'].includes(order.status)
  );

  if (loading) {
    return <div className="loading">Loading worklist...</div>;
  }

  return (
    <div className="worklist-tab">
      <h3>Active Worklist</h3>
      {pendingOrders.length === 0 ? (
        <p>No pending orders.</p>
      ) : (
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient ID</th>
                <th>Modality</th>
                <th>Body Part</th>
                <th>Urgency</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map(order => (
                <tr key={order.orderID}>
                  <td>{order.orderID}</td>
                  <td>{order.patientID}</td>
                  <td>{order.modality}</td>
                  <td>{order.bodyPart}</td>
                  <td>
                    <span className={`urgency ${order.urgency}`}>
                      {order.urgency}
                    </span>
                  </td>
                  <td>
                    <span className={`status ${order.status}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <select 
                      value={order.status}
                      onChange={(e) => onOrderStatusUpdate(order.orderID, e.target.value as ImagingOrder['status'])}
                    >
                      <option value="ordered">Ordered</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Studies Tab Component
const StudiesTab: React.FC<{
  studies: DICOMStudy[];
  onSearch: (criteria: ImagingSearchCriteria) => void;
  onStudyView: (study: DICOMStudy) => void;
  loading: boolean;
}> = ({ studies, onSearch, onStudyView, loading }) => {
  const [searchForm, setSearchForm] = useState<ImagingSearchCriteria>({});

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchForm);
  };

  return (
    <div className="studies-tab">
      <h3>Study Search</h3>
      
      <form onSubmit={handleSearchSubmit} className="search-form">
        <div className="form-row">
          <input
            type="text"
            placeholder="Patient ID"
            value={searchForm.patientID || ''}
            onChange={(e) => setSearchForm({ ...searchForm, patientID: e.target.value })}
          />
          <input
            type="text"
            placeholder="Patient Name"
            value={searchForm.patientName || ''}
            onChange={(e) => setSearchForm({ ...searchForm, patientName: e.target.value })}
          />
          <select
            value={searchForm.modality?.[0] || ''}
            onChange={(e) => setSearchForm({ 
              ...searchForm, 
              modality: e.target.value ? [e.target.value] : undefined 
            })}
          >
            <option value="">All Modalities</option>
            <option value="CT">CT</option>
            <option value="MR">MR</option>
            <option value="XR">X-Ray</option>
            <option value="US">Ultrasound</option>
            <option value="MG">Mammography</option>
          </select>
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {studies.length > 0 && (
        <div className="studies-results">
          <h4>Search Results ({studies.length})</h4>
          <div className="studies-grid">
            {studies.map(study => (
              <div key={study.studyInstanceUID} className="study-card">
                <div className="study-header">
                  <strong>{study.patientName}</strong>
                  <span className="study-date">{study.studyDate}</span>
                </div>
                <div className="study-details">
                  <p><strong>Study:</strong> {study.studyDescription}</p>
                  <p><strong>Modalities:</strong> {study.modalities.join(', ')}</p>
                  <p><strong>Series:</strong> {study.numberOfSeries}</p>
                  <p><strong>Images:</strong> {study.numberOfImages}</p>
                </div>
                <div className="study-actions">
                  <button 
                    onClick={() => onStudyView(study)}
                    className="view-button"
                  >
                    View Study
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Reports Tab Component
const ReportsTab: React.FC<{
  reports: ImagingReport[];
  loading: boolean;
}> = ({ reports, loading }) => {
  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-tab">
      <h3>Imaging Reports</h3>
      {reports.length === 0 ? (
        <p>No reports available.</p>
      ) : (
        <div className="reports-list">
          {reports.map(report => (
            <div key={report.reportID} className="report-card">
              <div className="report-header">
                <h4>Report {report.reportID}</h4>
                <span className={`status ${report.status}`}>
                  {report.status}
                </span>
              </div>
              <div className="report-content">
                <p><strong>Patient:</strong> {report.patientID}</p>
                <p><strong>Date:</strong> {report.reportDate}</p>
                <p><strong>Radiologist:</strong> {report.radiologistID}</p>
                <div className="findings">
                  <h5>Findings:</h5>
                  <p>{report.findings}</p>
                </div>
                <div className="impression">
                  <h5>Impression:</h5>
                  <p>{report.impression}</p>
                </div>
                {report.recommendations && (
                  <div className="recommendations">
                    <h5>Recommendations:</h5>
                    <p>{report.recommendations}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Orders Tab Component
const OrdersTab: React.FC<{
  orders: ImagingOrder[];
  onOrderCreate?: (order: ImagingOrder) => void;
  loading: boolean;
}> = ({ orders, onOrderCreate, loading }) => {
  if (loading) {
    return <div className="loading">Loading orders...</div>;
  }

  return (
    <div className="orders-tab">
      <h3>All Orders</h3>
      <div className="orders-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="count">{orders.filter(o => o.status === 'ordered').length}</span>
            <span className="label">Ordered</span>
          </div>
          <div className="stat">
            <span className="count">{orders.filter(o => o.status === 'in-progress').length}</span>
            <span className="label">In Progress</span>
          </div>
          <div className="stat">
            <span className="count">{orders.filter(o => o.status === 'completed').length}</span>
            <span className="label">Completed</span>
          </div>
        </div>
      </div>
      
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient ID</th>
                <th>Date</th>
                <th>Modality</th>
                <th>Body Part</th>
                <th>Indication</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.orderID}>
                  <td>{order.orderID}</td>
                  <td>{order.patientID}</td>
                  <td>{order.orderDate}</td>
                  <td>{order.modality}</td>
                  <td>{order.bodyPart}</td>
                  <td>{order.clinicalIndication}</td>
                  <td>
                    <span className={`status ${order.status}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PACSProviderDashboard;