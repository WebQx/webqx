/**
 * WebQX Provider Portal - Internationalization Module
 * Handles multi-language support including Arabic RTL layout
 */

class I18nManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('providerLanguage') || 'en';
        this.translations = {};
        this.rtlLanguages = ['ar'];
        this.supportedLanguages = ['en', 'es', 'ar'];
        
        this.init();
    }

    async init() {
        // Load all translations
        await this.loadTranslations();
        // Apply current language
        this.changeLanguage(this.currentLanguage);
    }

    async loadTranslations() {
        try {
            // Load English (base)
            const enResponse = await fetch('/patient-portal/i18n/locales/en.json');
            this.translations.en = await enResponse.json();

            // Load Spanish
            const esResponse = await fetch('/patient-portal/i18n/locales/es.json');
            this.translations.es = await esResponse.json();

            // Load Arabic
            const arResponse = await fetch('/patient-portal/i18n/locales/ar.json');
            this.translations.ar = await arResponse.json();

        } catch (error) {
            console.error('Failed to load translations:', error);
            // Fallback to hardcoded translations
            this.setFallbackTranslations();
        }
    }

    setFallbackTranslations() {
        this.translations = {
            en: {
                provider: {
                    title: "WebQX™ Provider Portal",
                    subtitle: "Secure Healthcare Professional Access"
                },
                form: {
                    username: "Username or Email",
                    usernamePlaceholder: "Enter your username or email",
                    password: "Password",
                    passwordPlaceholder: "Enter your password",
                    rememberMe: "Remember me",
                    forgotPassword: "Forgot Password?",
                    signIn: "Sign In"
                },
                security: {
                    hipaaCompliant: "HIPAA Compliant",
                    encryptionNotice: "All data is encrypted end-to-end and complies with healthcare privacy standards.",
                    sessionTimeout: "Session will timeout after 30 minutes of inactivity for security."
                },
                sso: {
                    orSignInWith: "Or sign in with"
                },
                roleModal: {
                    title: "Confirm Your Role",
                    description: "Please confirm your professional role to access the appropriate modules.",
                    cancel: "Cancel",
                    confirm: "Confirm"
                },
                forgotPassword: {
                    title: "Reset Password",
                    description: "Enter your email address and we'll send you instructions to reset your password.",
                    emailPlaceholder: "Enter your email address",
                    cancel: "Cancel",
                    sendInstructions: "Send Instructions"
                }
            },
            es: {
                provider: {
                    title: "Portal de Proveedores WebQX™",
                    subtitle: "Acceso Seguro para Profesionales de la Salud"
                },
                form: {
                    username: "Usuario o Correo Electrónico",
                    usernamePlaceholder: "Ingrese su usuario o correo electrónico",
                    password: "Contraseña",
                    passwordPlaceholder: "Ingrese su contraseña",
                    rememberMe: "Recordarme",
                    forgotPassword: "¿Olvidó su contraseña?",
                    signIn: "Iniciar Sesión"
                },
                security: {
                    hipaaCompliant: "Compatible con HIPAA",
                    encryptionNotice: "Todos los datos están encriptados de extremo a extremo y cumplen con los estándares de privacidad de la salud.",
                    sessionTimeout: "La sesión expirará después de 30 minutos de inactividad por seguridad."
                },
                sso: {
                    orSignInWith: "O inicie sesión con"
                },
                roleModal: {
                    title: "Confirme su Rol",
                    description: "Por favor confirme su rol profesional para acceder a los módulos apropiados.",
                    cancel: "Cancelar",
                    confirm: "Confirmar"
                },
                forgotPassword: {
                    title: "Restablecer Contraseña",
                    description: "Ingrese su dirección de correo electrónico y le enviaremos instrucciones para restablecer su contraseña.",
                    emailPlaceholder: "Ingrese su dirección de correo electrónico",
                    cancel: "Cancelar",
                    sendInstructions: "Enviar Instrucciones"
                }
            },
            ar: {
                provider: {
                    title: "بوابة مقدمي الخدمة WebQX™",
                    subtitle: "وصول آمن للمهنيين الصحيين"
                },
                form: {
                    username: "اسم المستخدم أو البريد الإلكتروني",
                    usernamePlaceholder: "أدخل اسم المستخدم أو البريد الإلكتروني",
                    password: "كلمة المرور",
                    passwordPlaceholder: "أدخل كلمة المرور",
                    rememberMe: "تذكرني",
                    forgotPassword: "نسيت كلمة المرور؟",
                    signIn: "تسجيل الدخول"
                },
                security: {
                    hipaaCompliant: "متوافق مع HIPAA",
                    encryptionNotice: "جميع البيانات مشفرة من البداية إلى النهاية وتتوافق مع معايير خصوصية الرعاية الصحية.",
                    sessionTimeout: "ستنتهي صلاحية الجلسة بعد 30 دقيقة من عدم النشاط لأغراض الأمان."
                },
                sso: {
                    orSignInWith: "أو سجل الدخول باستخدام"
                },
                roleModal: {
                    title: "تأكيد دورك",
                    description: "يرجى تأكيد دورك المهني للوصول إلى الوحدات المناسبة.",
                    cancel: "إلغاء",
                    confirm: "تأكيد"
                },
                forgotPassword: {
                    title: "إعادة تعيين كلمة المرور",
                    description: "أدخل عنوان بريدك الإلكتروني وسنرسل لك تعليمات لإعادة تعيين كلمة المرور.",
                    emailPlaceholder: "أدخل عنوان بريدك الإلكتروني",
                    cancel: "إلغاء",
                    sendInstructions: "إرسال التعليمات"
                }
            }
        };
    }

    translate(key, params = {}) {
        const keys = key.split('.');
        let translation = this.translations[this.currentLanguage];
        
        for (const k of keys) {
            if (translation && typeof translation === 'object') {
                translation = translation[k];
            } else {
                // Fallback to English
                translation = this.translations.en;
                for (const k of keys) {
                    if (translation && typeof translation === 'object') {
                        translation = translation[k];
                    } else {
                        return key; // Return key if translation not found
                    }
                }
                break;
            }
        }

        if (typeof translation === 'string') {
            // Replace parameters
            return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
                return params[param] || match;
            });
        }

        return key;
    }

    changeLanguage(language) {
        if (!this.supportedLanguages.includes(language)) {
            console.warn(`Language ${language} not supported`);
            return;
        }

        this.currentLanguage = language;
        localStorage.setItem('providerLanguage', language);
        
        // Update HTML lang and dir attributes
        const html = document.documentElement;
        html.lang = language;
        html.dir = this.rtlLanguages.includes(language) ? 'rtl' : 'ltr';
        
        // Update all elements with data-i18n attributes
        this.updateTranslations();
        
        // Update language selector buttons
        this.updateLanguageButtons();
        
        // Trigger custom event for language change
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language, isRTL: this.isRTL() } 
        }));
    }

    updateTranslations() {
        // Update text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translate(key);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.translate(key);
        });
    }

    updateLanguageButtons() {
        // Reset all language buttons
        document.querySelectorAll('[id^="lang-"]').forEach(btn => {
            btn.classList.remove('bg-opacity-40', 'font-semibold');
            btn.classList.add('bg-opacity-20');
        });
        
        // Highlight current language button
        const currentBtn = document.getElementById(`lang-${this.currentLanguage}`);
        if (currentBtn) {
            currentBtn.classList.remove('bg-opacity-20');
            currentBtn.classList.add('bg-opacity-40', 'font-semibold');
        }
    }

    isRTL() {
        return this.rtlLanguages.includes(this.currentLanguage);
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// Global i18n instance
let i18n;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    i18n = new I18nManager();
});

// Global functions for HTML onclick handlers
function changeLanguage(language) {
    if (i18n) {
        i18n.changeLanguage(language);
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18nManager;
}