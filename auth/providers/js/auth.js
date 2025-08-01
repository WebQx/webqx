/**
 * WebQX Provider Portal - Authentication Module
 * Handles login, session management, and role-based access
 */

class ProviderAuthManager {
    constructor() {
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionWarningTime = 5 * 60 * 1000; // 5 minutes before timeout
        this.sessionTimer = null;
        this.warningTimer = null;
        this.selectedRole = null;
        
        // Provider roles with module access
        this.providerRoles = {
            'physician': {
                name: 'Physician',
                description: 'Full access to patient records, prescribing, and clinical modules',
                modules: ['patients', 'prescriptions', 'lab-results', 'imaging', 'scheduling', 'billing'],
                redirect: '/provider/dashboard/physician'
            },
            'nurse': {
                name: 'Nurse',
                description: 'Access to patient care, medication administration, and vital signs',
                modules: ['patients', 'vitals', 'medication-admin', 'scheduling', 'care-plans'],
                redirect: '/provider/dashboard/nurse'
            },
            'pharmacist': {
                name: 'Pharmacist',
                description: 'Access to prescription management and medication reconciliation',
                modules: ['prescriptions', 'medication-reconciliation', 'drug-interactions', 'inventory'],
                redirect: '/provider/dashboard/pharmacist'
            },
            'administrator': {
                name: 'Administrator',
                description: 'Administrative access to system management and reporting',
                modules: ['users', 'reporting', 'billing', 'system-config', 'audit-logs'],
                redirect: '/provider/dashboard/admin'
            },
            'technician': {
                name: 'Technician',
                description: 'Access to lab results, imaging, and technical procedures',
                modules: ['lab-results', 'imaging', 'procedures', 'equipment'],
                redirect: '/provider/dashboard/technician'
            },
            'specialist': {
                name: 'Specialist',
                description: 'Specialized clinical access based on specialty certification',
                modules: ['patients', 'specialty-procedures', 'consultations', 'research'],
                redirect: '/provider/dashboard/specialist'
            }
        };

        this.init();
    }

    init() {
        this.setupFormHandlers();
        this.checkExistingSession();
        this.setupSessionManagement();
    }

    setupFormHandlers() {
        const form = document.getElementById('providerLoginForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        
        if (form) {
            form.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        // Real-time validation
        const usernameField = document.getElementById('username');
        const passwordField = document.getElementById('password');
        
        if (usernameField) {
            usernameField.addEventListener('input', () => this.clearFieldError('username'));
            usernameField.addEventListener('blur', () => this.validateUsername());
        }
        
        if (passwordField) {
            passwordField.addEventListener('input', () => this.clearFieldError('password'));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const formData = new FormData(e.target);
        const credentials = {
            username: formData.get('username').trim(),
            password: formData.get('password'),
            rememberMe: formData.get('rememberMe') === 'on'
        };

        this.setLoading(true);
        this.clearAlert();

        try {
            const response = await fetch('/api/auth/provider/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const result = await response.json();

            if (result.success) {
                // Store authentication data
                this.storeAuthData(result, credentials.rememberMe);
                
                // Show role confirmation modal
                this.showRoleConfirmation(result.user.roles);
            } else {
                this.handleLoginError(result);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Network error. Please check your connection and try again.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm() {
        let isValid = true;
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        // Username validation
        if (!username) {
            this.showFieldError('username', 'Username or email is required');
            isValid = false;
        } else if (username.includes('@')) {
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(username)) {
                this.showFieldError('username', 'Please enter a valid email address');
                isValid = false;
            }
        }
        
        // Password validation
        if (!password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        } else if (password.length < 8) {
            this.showFieldError('password', 'Password must be at least 8 characters long');
            isValid = false;
        }
        
        return isValid;
    }

    validateUsername() {
        const username = document.getElementById('username').value.trim();
        if (username && username.includes('@')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(username)) {
                this.showFieldError('username', 'Please enter a valid email address');
                return false;
            }
        }
        return true;
    }

    showFieldError(fieldName, message) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(`${fieldName}Error`);
        
        if (field && errorElement) {
            field.classList.add('border-red-400', 'bg-red-50', 'bg-opacity-10');
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    clearFieldError(fieldName) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(`${fieldName}Error`);
        
        if (field && errorElement) {
            field.classList.remove('border-red-400', 'bg-red-50', 'bg-opacity-10');
            errorElement.classList.add('hidden');
        }
    }

    setLoading(loading) {
        const button = document.getElementById('loginButton');
        const loginText = button.querySelector('.login-text');
        const spinner = button.querySelector('.loading-spinner');
        
        button.disabled = loading;
        
        if (loading) {
            loginText.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            loginText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    showAlert(message, type = 'error') {
        const container = document.getElementById('alertContainer');
        const alertElement = document.getElementById('alertMessage');
        
        alertElement.textContent = message;
        alertElement.className = `p-4 rounded-lg text-sm ${type === 'error' ? 'bg-red-500 bg-opacity-20 text-red-100 border border-red-400' : 'bg-green-500 bg-opacity-20 text-green-100 border border-green-400'}`;
        
        container.classList.remove('hidden');
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                container.classList.add('hidden');
            }, 5000);
        }
    }

    clearAlert() {
        const container = document.getElementById('alertContainer');
        container.classList.add('hidden');
    }

    handleLoginError(result) {
        switch (result.code) {
            case 'INVALID_CREDENTIALS':
                this.showAlert('Invalid username or password. Please check your credentials and try again.');
                break;
            case 'ACCOUNT_LOCKED':
                this.showAlert('Your account has been locked due to multiple failed login attempts. Please contact your administrator.');
                break;
            case 'ACCOUNT_SUSPENDED':
                this.showAlert('Your account has been suspended. Please contact your administrator for assistance.');
                break;
            case 'VALIDATION_ERROR':
                this.showAlert('Please check your input and try again.');
                if (result.details) {
                    result.details.forEach(error => {
                        if (error.param === 'username') {
                            this.showFieldError('username', error.msg);
                        } else if (error.param === 'password') {
                            this.showFieldError('password', error.msg);
                        }
                    });
                }
                break;
            default:
                this.showAlert(result.error || 'Login failed. Please try again.');
        }
    }

    storeAuthData(result, rememberMe) {
        const storage = rememberMe ? localStorage : sessionStorage;
        
        storage.setItem('providerAuthToken', result.token);
        storage.setItem('providerUser', JSON.stringify(result.user));
        storage.setItem('providerLoginTime', Date.now().toString());
    }

    showRoleConfirmation(userRoles) {
        const modal = document.getElementById('roleModal');
        const roleOptions = document.getElementById('roleOptions');
        
        // Clear existing options
        roleOptions.innerHTML = '';
        
        // Create role options
        userRoles.forEach(roleKey => {
            const role = this.providerRoles[roleKey];
            if (role) {
                const option = document.createElement('div');
                option.className = 'role-option p-4 border border-white border-opacity-20 rounded-lg cursor-pointer hover:bg-white hover:bg-opacity-10 transition-all';
                option.dataset.role = roleKey;
                
                option.innerHTML = `
                    <div class="flex items-center">
                        <input type="radio" name="role" value="${roleKey}" class="mr-3 text-blue-600 focus:ring-blue-500">
                        <div class="flex-1">
                            <h4 class="font-semibold text-white">${role.name}</h4>
                            <p class="text-sm text-gray-200 mt-1">${role.description}</p>
                            <div class="mt-2">
                                <span class="text-xs text-blue-200">Modules: ${role.modules.join(', ')}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                option.addEventListener('click', () => {
                    // Clear other selections
                    document.querySelectorAll('.role-option').forEach(opt => {
                        opt.classList.remove('bg-blue-600', 'bg-opacity-30');
                    });
                    
                    // Select this option
                    option.classList.add('bg-blue-600', 'bg-opacity-30');
                    option.querySelector('input[type="radio"]').checked = true;
                    this.selectedRole = roleKey;
                    
                    // Enable confirm button
                    document.getElementById('confirmRoleBtn').disabled = false;
                });
                
                roleOptions.appendChild(option);
            }
        });
        
        modal.classList.remove('hidden');
    }

    checkExistingSession() {
        const token = localStorage.getItem('providerAuthToken') || sessionStorage.getItem('providerAuthToken');
        
        if (token) {
            // Verify token validity
            this.verifySession(token);
        }
    }

    async verifySession(token) {
        try {
            const response = await fetch('/api/auth/provider/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // User is already authenticated, redirect based on role
                const userData = JSON.parse(localStorage.getItem('providerUser') || sessionStorage.getItem('providerUser'));
                if (userData && userData.selectedRole) {
                    this.redirectToRoleDashboard(userData.selectedRole);
                } else {
                    // Show role selection if not already selected
                    this.showRoleConfirmation(result.user.roles);
                }
            } else {
                // Token is invalid, clear storage
                this.clearAuthData();
            }
        } catch (error) {
            console.error('Session verification error:', error);
            this.clearAuthData();
        }
    }

    setupSessionManagement() {
        // Set up session timeout
        this.resetSessionTimer();
        
        // Track user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.resetSessionTimer();
            }, { passive: true });
        });
    }

    resetSessionTimer() {
        // Clear existing timers
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
        
        // Set warning timer (5 minutes before timeout)
        this.warningTimer = setTimeout(() => {
            this.showSessionWarning();
        }, this.sessionTimeout - this.sessionWarningTime);
        
        // Set session timeout timer
        this.sessionTimer = setTimeout(() => {
            this.handleSessionTimeout();
        }, this.sessionTimeout);
    }

    showSessionWarning() {
        if (confirm('Your session will expire in 5 minutes due to inactivity. Click OK to continue your session.')) {
            this.resetSessionTimer();
        }
    }

    handleSessionTimeout() {
        this.clearAuthData();
        alert('Your session has expired for security reasons. Please log in again.');
        window.location.reload();
    }

    clearAuthData() {
        localStorage.removeItem('providerAuthToken');
        localStorage.removeItem('providerUser');
        localStorage.removeItem('providerLoginTime');
        sessionStorage.removeItem('providerAuthToken');
        sessionStorage.removeItem('providerUser');
        sessionStorage.removeItem('providerLoginTime');
    }

    redirectToRoleDashboard(role) {
        const roleConfig = this.providerRoles[role];
        if (roleConfig) {
            window.location.href = roleConfig.redirect;
        } else {
            window.location.href = '/provider/dashboard';
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!email) {
            alert('Please enter your email address');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/provider/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Password reset instructions have been sent to your email address.');
                this.closeForgotPassword();
            } else {
                alert(result.error || 'Failed to send reset instructions. Please try again.');
            }
        } catch (error) {
            console.error('Forgot password error:', error);
            alert('Network error. Please check your connection and try again.');
        }
    }
}

// Global functions for HTML onclick handlers
function togglePassword() {
    const passwordField = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    
    if (passwordField.type === 'password') {
        passwordField.type = 'text';
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L12 12m-2.122-2.122L7.757 7.757M9.878 9.878l4.242 4.242M12 12l2.122 2.122m-2.122-2.122L9.878 9.878"></path>
        `;
    } else {
        passwordField.type = 'password';
        eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        `;
    }
}

function showForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
}

function closeForgotPassword() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
    document.getElementById('resetEmail').value = '';
}

function cancelRoleSelection() {
    document.getElementById('roleModal').classList.add('hidden');
    // Clear auth data and reload page
    providerAuth.clearAuthData();
    window.location.reload();
}

function confirmRole() {
    if (providerAuth.selectedRole) {
        // Update user data with selected role
        const userData = JSON.parse(localStorage.getItem('providerUser') || sessionStorage.getItem('providerUser'));
        userData.selectedRole = providerAuth.selectedRole;
        
        const storage = localStorage.getItem('providerAuthToken') ? localStorage : sessionStorage;
        storage.setItem('providerUser', JSON.stringify(userData));
        
        // Hide modal and redirect
        document.getElementById('roleModal').classList.add('hidden');
        providerAuth.redirectToRoleDashboard(providerAuth.selectedRole);
    }
}

// Global instance
let providerAuth;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    providerAuth = new ProviderAuthManager();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProviderAuthManager;
}