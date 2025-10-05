'use strict';

/**
 * WebQx Demo Mode - Core card system and mock data generation
 * Provides interactive demo experience without backend dependencies
 */

(function() {
  if (typeof window === 'undefined') return;

  // Configuration constants
  const DEMO_PRODUCTION_URL = 'https://webqx.up.railway.app/';
  const DEMO_SIGNUP_POST_ENDPOINT = null; // Set real endpoint later

  // Demo mode detection
  const DEMO_MODE = 
    (window.location.hostname.includes('github.io')) ||
    (new URLSearchParams(window.location.search).get('demo') === '1') ||
    (window.WEBQX_DEMO === true);

  // Seeded random for deterministic mock data
  let seed = Math.floor(Date.now() / 60000); // Changes every minute
  
  function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  function randomInt(min, max) {
    return Math.floor(seededRandom() * (max - min + 1)) + min;
  }

  function randomChoice(arr) {
    return arr[Math.floor(seededRandom() * arr.length)];
  }

  // Card state management
  let cards = [];
  let refreshIntervals = new Map();
  let currentRole = 'patient'; // Default role

  // Load card definitions
  async function loadCardDefinitions() {
    // Check for custom cards
    if (window.WEBQX_DEMO_CARDS) {
      return window.WEBQX_DEMO_CARDS;
    }

    // Try to fetch from JSON file
    try {
      const response = await fetch('./demo-placement-cards.json');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Failed to load demo-placement-cards.json:', e);
    }

    // Fallback to hardcoded cards
    return getDefaultCards();
  }

  function getDefaultCards() {
    return [
      { card_id: 'patient-appointments', title: 'My Appointments', description: 'View and manage upcoming medical appointments', icon: '📅', category: 'patient', refresh_interval: 25, demo: true },
      { card_id: 'patient-records', title: 'Health Records', description: 'Access your medical history and documents', icon: '📋', category: 'patient', refresh_interval: 45, demo: true },
      { card_id: 'patient-prescriptions', title: 'Prescriptions', description: 'View active medications and request refills', icon: '💊', category: 'patient', refresh_interval: 40, demo: true },
      { card_id: 'patient-lab-results', title: 'Lab Results', description: 'Review recent test results and trends', icon: '🔬', category: 'patient', refresh_interval: 50, demo: true },
      { card_id: 'patient-messages', title: 'Messages', description: 'Secure messaging with your care team', icon: '💬', category: 'patient', refresh_interval: 35, demo: true },
      { card_id: 'provider-patients', title: 'Patient Panel', description: 'View and manage your patient roster', icon: '👥', category: 'provider', refresh_interval: 50, demo: true },
      { card_id: 'provider-schedule', title: 'Today\'s Schedule', description: 'View appointments and clinical workflow', icon: '🗓️', category: 'provider', refresh_interval: 35, demo: true },
      { card_id: 'provider-clinical-insights', title: 'Clinical Insights', description: 'AI-powered patient care recommendations', icon: '🧠', category: 'provider', refresh_interval: 60, demo: true },
      { card_id: 'provider-telehealth', title: 'Telehealth Sessions', description: 'Manage virtual consultations and visits', icon: '📹', category: 'provider', refresh_interval: 55, demo: true },
      { card_id: 'admin-system-status', title: 'System Status', description: 'Monitor platform health and performance', icon: '⚙️', category: 'admin', refresh_interval: 70, demo: true },
      { card_id: 'analytics-engagement', title: 'Platform Analytics', description: 'User engagement and system metrics', icon: '📊', category: 'admin', refresh_interval: 30, demo: true }
    ];
  }

  // Mock data generators
  function generateMockData(cardId) {
    switch (cardId) {
      case 'patient-appointments':
        return generateAppointments();
      case 'patient-records':
        return generateRecords();
      case 'patient-prescriptions':
        return generatePrescriptions();
      case 'patient-lab-results':
        return generateLabResults();
      case 'patient-messages':
        return generateMessages();
      case 'provider-patients':
        return generatePatients();
      case 'provider-schedule':
        return generateSchedule();
      case 'provider-clinical-insights':
        return generateClinicalInsights();
      case 'provider-telehealth':
        return generateTelehealth();
      case 'admin-system-status':
        return generateSystemStatus();
      case 'analytics-engagement':
        return generateAnalytics();
      default:
        return { count: randomInt(1, 10), status: 'Active' };
    }
  }

  function generateAppointments() {
    const upcoming = randomInt(2, 5);
    const next = new Date(Date.now() + randomInt(1, 7) * 86400000);
    return {
      upcoming_count: upcoming,
      next_appointment: next.toISOString().split('T')[0],
      next_type: randomChoice(['Follow-up', 'Annual Physical', 'Consultation', 'Telehealth']),
      pending_confirmations: randomInt(0, 2)
    };
  }

  function generateRecords() {
    return {
      total_records: randomInt(45, 125),
      recent_updates: randomInt(1, 5),
      categories: {
        visits: randomInt(10, 30),
        labs: randomInt(5, 15),
        imaging: randomInt(2, 8),
        documents: randomInt(5, 20)
      }
    };
  }

  function generatePrescriptions() {
    return {
      active_medications: randomInt(2, 8),
      refills_due: randomInt(0, 3),
      pending_requests: randomInt(0, 2),
      last_filled: `${randomInt(2, 30)} days ago`
    };
  }

  function generateLabResults() {
    return {
      new_results: randomInt(0, 4),
      pending_review: randomInt(0, 2),
      last_test: `${randomInt(3, 60)} days ago`,
      critical_flags: randomInt(0, 1)
    };
  }

  function generateMessages() {
    return {
      unread: randomInt(0, 5),
      total: randomInt(10, 45),
      last_message: `${randomInt(1, 48)} hours ago`,
      urgent: randomInt(0, 1)
    };
  }

  function generatePatients() {
    return {
      total_patients: randomInt(85, 250),
      active_today: randomInt(8, 25),
      new_this_week: randomInt(2, 8),
      critical_alerts: randomInt(0, 3)
    };
  }

  function generateSchedule() {
    return {
      appointments_today: randomInt(6, 18),
      completed: randomInt(2, 10),
      upcoming: randomInt(3, 12),
      virtual_sessions: randomInt(1, 5),
      next_appointment: `${randomInt(15, 90)} min`
    };
  }

  function generateClinicalInsights() {
    return {
      high_priority: randomInt(2, 8),
      medication_interactions: randomInt(0, 3),
      care_gaps: randomInt(1, 6),
      preventive_care: randomInt(2, 7)
    };
  }

  function generateTelehealth() {
    return {
      scheduled_sessions: randomInt(3, 12),
      active_now: randomInt(0, 2),
      completed_today: randomInt(1, 6),
      average_duration: `${randomInt(15, 35)} min`
    };
  }

  function generateSystemStatus() {
    const uptime = 99.5 + seededRandom() * 0.5;
    return {
      status: randomChoice(['Operational', 'Operational', 'Operational', 'Degraded']),
      uptime: uptime.toFixed(2) + '%',
      active_users: randomInt(125, 350),
      api_latency: randomInt(45, 180) + 'ms',
      db_connections: randomInt(15, 45)
    };
  }

  function generateAnalytics() {
    // Use actual analytics if available
    if (window.WebQxDemoAnalytics) {
      const summary = window.WebQxDemoAnalytics.getSummary();
      return {
        session_events: summary.session_events,
        total_events: summary.total_events,
        session_duration: Math.round(summary.session_duration_ms / 1000) + 's',
        unique_sessions: Math.ceil(summary.total_events / 10)
      };
    }
    
    return {
      session_events: randomInt(5, 25),
      total_events: randomInt(100, 500),
      session_duration: randomInt(30, 300) + 's',
      unique_sessions: randomInt(10, 50)
    };
  }

  // Detailed modal data generators
  function generateDetailedData(cardId) {
    switch (cardId) {
      case 'patient-appointments':
        return generateAppointmentDetails();
      case 'patient-prescriptions':
        return generatePrescriptionDetails();
      case 'patient-lab-results':
        return generateLabDetails();
      case 'provider-patients':
        return generatePatientDetails();
      case 'provider-schedule':
        return generateScheduleDetails();
      default:
        return null;
    }
  }

  function generateAppointmentDetails() {
    const appointments = [];
    for (let i = 0; i < 3; i++) {
      const days = i + 1 + randomInt(0, 5);
      const date = new Date(Date.now() + days * 86400000);
      const hour = randomInt(8, 16);
      appointments.push({
        date: date.toISOString().split('T')[0],
        time: `${hour}:${randomInt(0, 1) * 30 || '00'}`,
        provider: randomChoice(['Dr. Sarah Johnson', 'Dr. Michael Chen', 'Dr. Emily Williams', 'Dr. James Rodriguez']),
        type: randomChoice(['Follow-up', 'Annual Physical', 'Consultation', 'Telehealth']),
        location: randomChoice(['Main Clinic', 'West Campus', 'Virtual', 'East Building'])
      });
    }
    return appointments;
  }

  function generatePrescriptionDetails() {
    const meds = [
      'Atorvastatin', 'Lisinopril', 'Metformin', 'Amlodipine', 'Omeprazole',
      'Levothyroxine', 'Albuterol', 'Gabapentin', 'Losartan', 'Sertraline'
    ];
    
    return meds.slice(0, randomInt(3, 6)).map(med => ({
      name: med,
      dose: `${randomInt(5, 100)}mg`,
      frequency: randomChoice(['Daily', 'Twice daily', 'Three times daily', 'As needed']),
      refills: randomInt(0, 5),
      prescriber: randomChoice(['Dr. Johnson', 'Dr. Chen', 'Dr. Williams'])
    }));
  }

  function generateLabDetails() {
    return [
      { test: 'Complete Blood Count', date: getRecentDate(7), status: 'Normal', critical: false },
      { test: 'Metabolic Panel', date: getRecentDate(7), status: 'Normal', critical: false },
      { test: 'Lipid Panel', date: getRecentDate(30), status: 'Review Required', critical: false },
      { test: 'HbA1c', date: getRecentDate(90), status: 'Normal', critical: false }
    ];
  }

  function generatePatientDetails() {
    const names = ['Johnson, Emily', 'Chen, Michael', 'Williams, Sarah', 'Rodriguez, James', 'Brown, Lisa'];
    return names.map(name => ({
      name,
      mrn: 'MRN-' + randomInt(100000, 999999),
      next_visit: getRecentDate(randomInt(-3, 7)),
      status: randomChoice(['Active', 'Active', 'Pending', 'Follow-up'])
    }));
  }

  function generateScheduleDetails() {
    const schedule = [];
    for (let i = 0; i < 6; i++) {
      const hour = 8 + i + randomInt(0, 1);
      schedule.push({
        time: `${hour}:${randomInt(0, 1) * 30 || '00'}`,
        patient: randomChoice(['Smith, J.', 'Jones, M.', 'Williams, S.', 'Brown, K.', 'Davis, R.']),
        type: randomChoice(['Follow-up', 'New Patient', 'Annual', 'Urgent']),
        duration: randomChoice(['15 min', '30 min', '45 min'])
      });
    }
    return schedule;
  }

  function getRecentDate(daysAgo) {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  }

  // Card rendering
  function renderCard(card, data) {
    const cardEl = document.createElement('div');
    cardEl.className = 'demo-card';
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('tabindex', '0');
    cardEl.setAttribute('aria-label', `${card.title}: ${card.description}`);
    cardEl.dataset.cardId = card.card_id;

    const dataStr = formatCardData(data);
    
    cardEl.innerHTML = `
      <div class="card-icon">${card.icon}</div>
      <div class="card-content">
        <h3 class="card-title">${card.title}</h3>
        <p class="card-description">${card.description}</p>
        <div class="card-data">${dataStr}</div>
      </div>
      <div class="card-refresh-indicator" aria-hidden="true">⟳</div>
    `;

    // Log card view
    if (window.WebQxDemoAnalytics) {
      window.WebQxDemoAnalytics.log('card_view', { card_id: card.card_id });
    }

    return cardEl;
  }

  function formatCardData(data) {
    const entries = Object.entries(data).slice(0, 3);
    return entries.map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      // Format value - if it's an object, show a summary instead of [object Object]
      let displayValue = value;
      if (typeof value === 'object' && value !== null) {
        displayValue = Object.keys(value).length + ' items';
      }
      return `<div><strong>${label}:</strong> ${displayValue}</div>`;
    }).join('');
  }

  // Modal dialog
  function openModal(card) {
    if (window.WebQxDemoAnalytics) {
      window.WebQxDemoAnalytics.log('modal_open', { card_id: card.card_id });
    }

    const modal = document.createElement('div');
    modal.className = 'demo-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');

    const detailedData = generateDetailedData(card.card_id);
    const detailsHtml = detailedData ? formatDetailedData(detailedData) : '<p>No additional details available.</p>';

    modal.innerHTML = `
      <div class="modal-overlay" aria-hidden="true"></div>
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-icon">${card.icon}</div>
          <h2 id="modal-title">${card.title}</h2>
          <button class="modal-close" aria-label="Close modal">✕</button>
        </div>
        <div class="modal-body">
          <p class="modal-description">${card.description}</p>
          <div class="modal-details">${detailsHtml}</div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary modal-btn-close">Close</button>
          <button class="btn-secondary modal-btn-signup">Request Production Access</button>
          <button class="btn-primary modal-btn-launch">Launch Full System</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // Focus trap
    const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) firstFocusable.focus();

    // Event listeners
    const closeModal = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-btn-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    
    modal.querySelector('.modal-btn-signup').addEventListener('click', () => {
      closeModal();
      const signupForm = document.getElementById('signup-form');
      if (signupForm) {
        signupForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const emailInput = signupForm.querySelector('input[type="email"]');
        if (emailInput) {
          setTimeout(() => emailInput.focus(), 500);
        }
      }
    });

    modal.querySelector('.modal-btn-launch').addEventListener('click', () => {
      window.open(DEMO_PRODUCTION_URL, '_blank');
    });

    // Keyboard handling
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });

    document.body.style.overflow = 'hidden';
  }

  function formatDetailedData(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) return '<p>No items to display.</p>';
      
      // Check if first item has date/time fields for table format
      if (data[0].date || data[0].time) {
        let html = '<table class="modal-table"><tbody>';
        data.forEach(item => {
          html += '<tr>';
          Object.entries(item).forEach(([key, value]) => {
            html += `<td><strong>${key}:</strong> ${value}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
      }
      
      // List format
      return '<ul class="modal-list">' + 
        data.map(item => {
          const details = Object.entries(item).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join(', ');
          return `<li>${details}</li>`;
        }).join('') + 
        '</ul>';
    }
    
    return '<p>Data format not supported.</p>';
  }

  // Auto-refresh
  function setupAutoRefresh(card, cardEl) {
    const interval = (card.refresh_interval || 30) * 1000;
    
    const refreshCard = () => {
      const data = generateMockData(card.card_id);
      const dataEl = cardEl.querySelector('.card-data');
      if (dataEl) {
        dataEl.innerHTML = formatCardData(data);
        
        // Flash indicator
        const indicator = cardEl.querySelector('.card-refresh-indicator');
        if (indicator) {
          indicator.style.opacity = '1';
          setTimeout(() => { indicator.style.opacity = '0'; }, 500);
        }
      }
    };

    const intervalId = setInterval(refreshCard, interval);
    refreshIntervals.set(card.card_id, intervalId);
  }

  // Initialize demo
  async function initDemo() {
    if (!DEMO_MODE) return;

    cards = await loadCardDefinitions();
    
    const container = document.getElementById('demo-cards-container');
    if (!container) {
      console.warn('Demo cards container not found');
      return;
    }

    renderCards(container);
  }

  function renderCards(container) {
    container.innerHTML = '';
    
    const filteredCards = cards.filter(card => {
      if (currentRole === 'all') return true;
      return card.category === currentRole || card.category === 'admin';
    });

    filteredCards.forEach(card => {
      const data = generateMockData(card.card_id);
      const cardEl = renderCard(card, data);
      
      // Click handler
      const clickHandler = () => {
        if (window.WebQxDemoAnalytics) {
          window.WebQxDemoAnalytics.log('card_click', { card_id: card.card_id });
        }
        openModal(card);
      };
      
      cardEl.addEventListener('click', clickHandler);
      cardEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
      });

      container.appendChild(cardEl);
      
      // Setup auto-refresh
      if (card.refresh_interval) {
        setupAutoRefresh(card, cardEl);
      }
    });
  }

  function setRole(role) {
    currentRole = role;
    const container = document.getElementById('demo-cards-container');
    if (container) {
      renderCards(container);
    }
  }

  function cleanup() {
    refreshIntervals.forEach(intervalId => clearInterval(intervalId));
    refreshIntervals.clear();
  }

  // Expose public API
  window.WebQxDemoMode = {
    init: initDemo,
    setRole,
    cleanup,
    DEMO_MODE,
    DEMO_PRODUCTION_URL
  };

  // Auto-init if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDemo);
  } else {
    initDemo();
  }

  // Cleanup on unload
  window.addEventListener('beforeunload', cleanup);

})();
