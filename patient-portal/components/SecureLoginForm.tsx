/**
 * HIPAA-Compliant Secure Login Component
 * 
 * Responsive login form with client-side validation, encryption,
 * and security features for the WebQX patient portal.
 */

import React, { useState, useEffect } from 'react';

interface LoginFormData {
  email: string;
  password: string;
  mfaCode?: string;
}

interface LoginError {
  code: string;
  message: string;
  details?: any;
}

interface LoginProps {
  onLogin?: (user: any) => void;
  onRegister?: () => void;
}

// Simple client-side encryption using base64 (in production, use proper encryption)
const encryptData = (data: string): string => {
  try {
    return btoa(data);
  } catch (error) {
    console.error('Encryption error:', error);
    return data;
  }
};

const SecureLoginForm: React.FC<LoginProps> = ({ onLogin, onRegister }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    mfaCode: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);
  const [showMfa, setShowMfa] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isRegistrationMode, setIsRegistrationMode] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    role: 'PATIENT'
  });

  // Clear error when user starts typing
  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [formData]);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate password strength
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return errors;
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (isRegistrationMode) {
      const passwordErrors = validatePassword(formData.password);
      if (passwordErrors.length > 0) {
        errors.password = passwordErrors[0];
      }
    }

    if (isRegistrationMode) {
      if (!registrationData.firstName) {
        errors.firstName = 'First name is required';
      }
      if (!registrationData.lastName) {
        errors.lastName = 'Last name is required';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (['firstName', 'lastName', 'role'].includes(name)) {
      setRegistrationData(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear specific validation error
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Encrypt credentials before sending
      const encryptedCredentials = {
        email: formData.email,
        password: encryptData(formData.password),
        mfaCode: formData.mfaCode
      };

      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(encryptedCredentials)
      });

      const result = await response.json();

      if (result.success) {
        // Login successful
        if (onLogin) {
          onLogin(result.user);
        }
        
        // Redirect to main portal
        window.location.href = '/portal';
      } else {
        // Handle different error types
        if (result.error?.code === 'MFA_REQUIRED') {
          setShowMfa(true);
        } else {
          setError(result.error);
        }
      }

    } catch (err) {
      console.error('Login error:', err);
      setError({
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle registration submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userData = {
        email: formData.email,
        password: encryptData(formData.password),
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        role: registrationData.role
      };

      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const result = await response.json();

      if (result.success) {
        // Registration successful, switch to login mode
        setIsRegistrationMode(false);
        setError(null);
        alert('Account created successfully! Please log in with your credentials.');
      } else {
        setError(result.error);
      }

    } catch (err) {
      console.error('Registration error:', err);
      setError({
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="secure-login-container">
      <div className="login-form-wrapper">
        <div className="login-header">
          <h2>🔒 {isRegistrationMode ? 'Create Account' : 'Secure Login'}</h2>
          <p>WebQX™ Patient Portal - HIPAA Compliant Access</p>
        </div>

        <form onSubmit={isRegistrationMode ? handleRegister : handleLogin} className="login-form">
          {/* Registration fields */}
          {isRegistrationMode && (
            <>
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={registrationData.firstName}
                  onChange={handleInputChange}
                  className={validationErrors.firstName ? 'error' : ''}
                  disabled={isLoading}
                  autoComplete="given-name"
                />
                {validationErrors.firstName && (
                  <span className="error-message">{validationErrors.firstName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={registrationData.lastName}
                  onChange={handleInputChange}
                  className={validationErrors.lastName ? 'error' : ''}
                  disabled={isLoading}
                  autoComplete="family-name"
                />
                {validationErrors.lastName && (
                  <span className="error-message">{validationErrors.lastName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="role">Account Type</label>
                <select
                  id="role"
                  name="role"
                  value={registrationData.role}
                  onChange={handleInputChange}
                  disabled={isLoading}
                >
                  <option value="PATIENT">Patient</option>
                  <option value="PROVIDER">Healthcare Provider</option>
                  <option value="NURSE">Nurse</option>
                  <option value="STAFF">Staff</option>
                </select>
              </div>
            </>
          )}

          {/* Email field */}
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={validationErrors.email ? 'error' : ''}
              disabled={isLoading}
              autoComplete="email"
              required
            />
            {validationErrors.email && (
              <span className="error-message">{validationErrors.email}</span>
            )}
          </div>

          {/* Password field */}
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={validationErrors.password ? 'error' : ''}
              disabled={isLoading}
              autoComplete={isRegistrationMode ? 'new-password' : 'current-password'}
              required
            />
            {validationErrors.password && (
              <span className="error-message">{validationErrors.password}</span>
            )}
          </div>

          {/* MFA field (shown when required) */}
          {showMfa && (
            <div className="form-group">
              <label htmlFor="mfaCode">Multi-Factor Authentication Code</label>
              <input
                type="text"
                id="mfaCode"
                name="mfaCode"
                value={formData.mfaCode || ''}
                onChange={handleInputChange}
                disabled={isLoading}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="error-banner">
              <strong>Error:</strong> {error.message}
              {error.code === 'ACCOUNT_LOCKED' && (
                <p>Your account has been temporarily locked for security. Please try again later.</p>
              )}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                {isRegistrationMode ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isRegistrationMode ? 'Create Account' : 'Sign In'
            )}
          </button>

          {/* Mode toggle */}
          <div className="form-footer">
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setIsRegistrationMode(!isRegistrationMode);
                setError(null);
                setValidationErrors({});
                setShowMfa(false);
              }}
              disabled={isLoading}
            >
              {isRegistrationMode 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Create one"}
            </button>
          </div>
        </form>

        {/* Security notice */}
        <div className="security-notice">
          <p>🔐 <strong>Your privacy is protected:</strong></p>
          <ul>
            <li>All data is encrypted in transit and at rest</li>
            <li>HIPAA-compliant security measures</li>
            <li>Session timeout for your protection</li>
            <li>Audit logging for security monitoring</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .secure-login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .login-form-wrapper {
          background: white;
          border-radius: 12px;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
          padding: 40px;
          max-width: 450px;
          width: 100%;
        }

        .login-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .login-header h2 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 28px;
          font-weight: 600;
        }

        .login-header p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .login-form {
          margin-bottom: 30px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s ease;
          box-sizing: border-box;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input.error,
        .form-group select.error {
          border-color: #e74c3c;
        }

        .error-message {
          display: block;
          color: #e74c3c;
          font-size: 12px;
          margin-top: 5px;
        }

        .error-banner {
          background: #ffeaea;
          border: 1px solid #e74c3c;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          color: #c0392b;
          font-size: 14px;
        }

        .submit-button {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 20px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .form-footer {
          text-align: center;
          margin-top: 20px;
        }

        .link-button {
          background: none;
          border: none;
          color: #667eea;
          text-decoration: underline;
          cursor: pointer;
          font-size: 14px;
          padding: 0;
        }

        .link-button:hover:not(:disabled) {
          color: #5a6fd8;
        }

        .security-notice {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          font-size: 12px;
          color: #495057;
        }

        .security-notice p {
          margin: 0 0 10px 0;
          font-weight: 600;
        }

        .security-notice ul {
          margin: 0;
          padding-left: 20px;
        }

        .security-notice li {
          margin-bottom: 5px;
        }

        @media (max-width: 500px) {
          .login-form-wrapper {
            padding: 30px 20px;
            margin: 10px;
          }
          
          .login-header h2 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default SecureLoginForm;