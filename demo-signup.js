'use strict';

/**
 * Demo Signup Form Handler
 * Validates and stores signup submissions in localStorage
 * Provides fallback mailto link on errors
 */

(function() {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'webqx_demo_signups';
  const DEMO_SIGNUP_POST_ENDPOINT = null; // Configure later for real endpoint
  const FALLBACK_EMAIL = 'demo@webqx.com';

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function getStoredSignups() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to load signups:', e);
      return [];
    }
  }

  function storeSignup(signup) {
    try {
      const signups = getStoredSignups();
      signups.push(signup);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(signups));
      return true;
    } catch (e) {
      console.warn('Failed to store signup:', e);
      return false;
    }
  }

  function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.getElementById('signup-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'signup-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10001;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      animation: slideDown 0.3s ease-out;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  async function submitToEndpoint(data) {
    if (!DEMO_SIGNUP_POST_ENDPOINT) {
      return { success: false, error: 'No endpoint configured' };
    }

    try {
      const response = await fetch(DEMO_SIGNUP_POST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.warn('Signup endpoint error:', error);
      return { success: false, error: error.message };
    }
  }

  async function handleSubmit(formData) {
    const { email, role, message } = formData;

    // Validate email
    if (!validateEmail(email)) {
      showToast('Please enter a valid email address', 'error');
      return false;
    }

    // Create signup record
    const signup = {
      email,
      role: role || 'Not specified',
      message: message || '',
      timestamp: new Date().toISOString(),
      ts: Date.now()
    };

    // Store locally
    const stored = storeSignup(signup);
    
    if (!stored) {
      showToast('Failed to save signup. Please try again.', 'error');
      return false;
    }

    // Log analytics event
    if (window.WebQxDemoAnalytics) {
      window.WebQxDemoAnalytics.log('signup_submit', { role });
    }

    // Try to submit to endpoint (optional)
    if (DEMO_SIGNUP_POST_ENDPOINT) {
      await submitToEndpoint(signup);
      // Don't fail if endpoint fails - we already stored locally
    }

    showToast('✓ Thanks! You\'re on the waitlist. We\'ll be in touch soon.');
    return true;
  }

  function createMailtoFallback(email, role) {
    const subject = encodeURIComponent('WebQx EMR Pilot Program - Interest');
    const body = encodeURIComponent(`Hi WebQx Team,

I'm interested in joining the EMR pilot program.

Email: ${email}
Role Interest: ${role}

Please send me more information.

Thanks!`);
    
    return `mailto:${FALLBACK_EMAIL}?subject=${subject}&body=${body}`;
  }

  // Expose public API
  window.WebQxDemoSignup = {
    handleSubmit,
    validateEmail,
    createMailtoFallback,
    getStoredSignups,
    FALLBACK_EMAIL
  };

})();
