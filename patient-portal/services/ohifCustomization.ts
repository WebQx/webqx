/**
 * @fileoverview OHIF Viewer Customization Service
 * 
 * Provides branding, theming, and localization customization for OHIF viewer
 * in patient portal context with healthcare organization branding support.
 * 
 * @author WebQX Health
 * @version 1.0.0
 */

export interface BrandingConfig {
  organizationName: string;
  logoUrl?: string;
  logoAltText?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  fontFamily: string;
  favicon?: string;
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto' | 'high-contrast';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      small: string;
      medium: string;
      large: string;
      xlarge: string;
    };
    fontWeight: {
      light: number;
      regular: number;
      medium: number;
      bold: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
}

export interface LocalizationConfig {
  language: string;
  region: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  currency?: string;
  rtl: boolean;
  translations: Record<string, string>;
}

export interface AccessibilityConfig {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigationEnhanced: boolean;
  focusIndicatorEnhanced: boolean;
}

export interface ViewerCustomization {
  branding: BrandingConfig;
  theme: ThemeConfig;
  localization: LocalizationConfig;
  accessibility: AccessibilityConfig;
  features: {
    enableDownload: boolean;
    enablePrint: boolean;
    enableShare: boolean;
    enableFullscreen: boolean;
    enableAnnotations: boolean;
    enableMeasurements: boolean;
    enableCine: boolean;
    enableWindowLevel: boolean;
    enablePresets: boolean;
    enableThumbnails: boolean;
    enableSeriesSelector: boolean;
    enableStudyBrowser: boolean;
  };
  layout: {
    showHeader: boolean;
    showSidebar: boolean;
    showToolbar: boolean;
    showStatusBar: boolean;
    compactMode: boolean;
    sidebarPosition: 'left' | 'right';
    toolbarPosition: 'top' | 'bottom' | 'left' | 'right';
  };
}

/**
 * OHIF Viewer Customization Service
 */
export class OHIFCustomizationService {
  private static instance: OHIFCustomizationService;
  private customizations = new Map<string, ViewerCustomization>();
  private defaultCustomization: ViewerCustomization;

  constructor() {
    this.defaultCustomization = this.createDefaultCustomization();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OHIFCustomizationService {
    if (!OHIFCustomizationService.instance) {
      OHIFCustomizationService.instance = new OHIFCustomizationService();
    }
    return OHIFCustomizationService.instance;
  }

  /**
   * Get customization for organization
   */
  async getCustomization(organizationId: string): Promise<ViewerCustomization> {
    // Check cache first
    if (this.customizations.has(organizationId)) {
      return this.customizations.get(organizationId)!;
    }

    // Fetch from API
    try {
      const response = await fetch(`/api/organizations/${organizationId}/customization`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Failed to load organization customization, using default');
        return this.defaultCustomization;
      }

      const customization: ViewerCustomization = await response.json();
      
      // Validate and merge with defaults
      const validatedCustomization = this.validateCustomization(customization);
      
      // Cache the result
      this.customizations.set(organizationId, validatedCustomization);
      
      return validatedCustomization;
    } catch (error) {
      console.error('Error loading customization:', error);
      return this.defaultCustomization;
    }
  }

  /**
   * Apply customization to OHIF viewer
   */
  applyCustomization(customization: ViewerCustomization, targetElement?: HTMLElement): void {
    const root = targetElement || document.documentElement;

    // Apply CSS custom properties for theming
    this.applyCSSProperties(customization.theme, root);
    
    // Apply branding
    this.applyBranding(customization.branding, root);
    
    // Apply accessibility settings
    this.applyAccessibility(customization.accessibility, root);
    
    // Apply RTL if needed
    if (customization.localization.rtl) {
      root.setAttribute('dir', 'rtl');
    }

    // Apply layout modifications
    this.applyLayout(customization.layout, root);
  }

  /**
   * Get CSS for customization
   */
  generateCSS(customization: ViewerCustomization): string {
    const { theme, branding } = customization;
    
    return `
      :root {
        /* Color variables */
        --ohif-primary-color: ${theme.colors.primary};
        --ohif-secondary-color: ${theme.colors.secondary};
        --ohif-background-color: ${theme.colors.background};
        --ohif-surface-color: ${theme.colors.surface};
        --ohif-text-color: ${theme.colors.text};
        --ohif-text-secondary-color: ${theme.colors.textSecondary};
        --ohif-border-color: ${theme.colors.border};
        --ohif-success-color: ${theme.colors.success};
        --ohif-warning-color: ${theme.colors.warning};
        --ohif-error-color: ${theme.colors.error};
        --ohif-info-color: ${theme.colors.info};
        
        /* Typography variables */
        --ohif-font-family: ${theme.typography.fontFamily};
        --ohif-font-size-small: ${theme.typography.fontSize.small};
        --ohif-font-size-medium: ${theme.typography.fontSize.medium};
        --ohif-font-size-large: ${theme.typography.fontSize.large};
        --ohif-font-size-xlarge: ${theme.typography.fontSize.xlarge};
        --ohif-font-weight-light: ${theme.typography.fontWeight.light};
        --ohif-font-weight-regular: ${theme.typography.fontWeight.regular};
        --ohif-font-weight-medium: ${theme.typography.fontWeight.medium};
        --ohif-font-weight-bold: ${theme.typography.fontWeight.bold};
        
        /* Spacing variables */
        --ohif-spacing-xs: ${theme.spacing.xs};
        --ohif-spacing-sm: ${theme.spacing.sm};
        --ohif-spacing-md: ${theme.spacing.md};
        --ohif-spacing-lg: ${theme.spacing.lg};
        --ohif-spacing-xl: ${theme.spacing.xl};
        
        /* Border radius variables */
        --ohif-border-radius-small: ${theme.borderRadius.small};
        --ohif-border-radius-medium: ${theme.borderRadius.medium};
        --ohif-border-radius-large: ${theme.borderRadius.large};
        
        /* Shadow variables */
        --ohif-shadow-small: ${theme.shadows.small};
        --ohif-shadow-medium: ${theme.shadows.medium};
        --ohif-shadow-large: ${theme.shadows.large};
        
        /* Branding variables */
        --ohif-brand-primary: ${branding.primaryColor};
        --ohif-brand-secondary: ${branding.secondaryColor};
        --ohif-brand-accent: ${branding.accentColor};
        --ohif-brand-background: ${branding.backgroundColor};
        --ohif-brand-text: ${branding.textColor};
        --ohif-brand-link: ${branding.linkColor};
        --ohif-brand-font: ${branding.fontFamily};
      }
      
      /* OHIF Viewer customizations */
      .ohif-viewer {
        font-family: var(--ohif-font-family);
        color: var(--ohif-text-color);
        background-color: var(--ohif-background-color);
      }
      
      .ohif-viewer-header {
        background-color: var(--ohif-brand-primary);
        color: var(--ohif-brand-text);
      }
      
      .ohif-viewer-logo {
        font-family: var(--ohif-brand-font);
      }
      
      .ohif-button-primary {
        background-color: var(--ohif-brand-primary);
        color: var(--ohif-brand-text);
        border-radius: var(--ohif-border-radius-medium);
      }
      
      .ohif-button-secondary {
        background-color: var(--ohif-brand-secondary);
        color: var(--ohif-brand-text);
        border-radius: var(--ohif-border-radius-medium);
      }
      
      /* High contrast mode */
      .ohif-viewer.high-contrast {
        --ohif-primary-color: #000000;
        --ohif-background-color: #ffffff;
        --ohif-text-color: #000000;
        filter: contrast(150%);
      }
      
      /* Large text mode */
      .ohif-viewer.large-text {
        --ohif-font-size-small: 1.1rem;
        --ohif-font-size-medium: 1.3rem;
        --ohif-font-size-large: 1.6rem;
        --ohif-font-size-xlarge: 2rem;
      }
      
      /* Reduced motion */
      .ohif-viewer.reduced-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      
      /* RTL support */
      .ohif-viewer[dir="rtl"] {
        text-align: right;
      }
      
      .ohif-viewer[dir="rtl"] .ohif-sidebar {
        left: auto;
        right: 0;
      }
    `;
  }

  /**
   * Update customization for organization
   */
  async updateCustomization(
    organizationId: string, 
    updates: Partial<ViewerCustomization>
  ): Promise<ViewerCustomization> {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/customization`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update customization: ${response.statusText}`);
      }

      const updatedCustomization: ViewerCustomization = await response.json();
      
      // Update cache
      this.customizations.set(organizationId, updatedCustomization);
      
      return updatedCustomization;
    } catch (error) {
      console.error('Error updating customization:', error);
      throw error;
    }
  }

  /**
   * Create default customization
   */
  private createDefaultCustomization(): ViewerCustomization {
    return {
      branding: {
        organizationName: 'WebQX Health',
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        accentColor: '#06b6d4',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        linkColor: '#2563eb',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      },
      theme: {
        mode: 'light',
        colors: {
          primary: '#2563eb',
          secondary: '#64748b',
          background: '#ffffff',
          surface: '#f8fafc',
          text: '#1f2937',
          textSecondary: '#6b7280',
          border: '#e5e7eb',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#06b6d4',
        },
        typography: {
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          fontSize: {
            small: '0.875rem',
            medium: '1rem',
            large: '1.125rem',
            xlarge: '1.25rem',
          },
          fontWeight: {
            light: 300,
            regular: 400,
            medium: 500,
            bold: 700,
          },
        },
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
        },
        borderRadius: {
          small: '0.25rem',
          medium: '0.5rem',
          large: '0.75rem',
        },
        shadows: {
          small: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          large: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
      },
      localization: {
        language: 'en',
        region: 'US',
        dateFormat: 'MM/dd/yyyy',
        timeFormat: 'HH:mm',
        numberFormat: 'en-US',
        rtl: false,
        translations: {},
      },
      accessibility: {
        highContrast: false,
        largeText: false,
        reducedMotion: false,
        screenReaderOptimized: false,
        keyboardNavigationEnhanced: false,
        focusIndicatorEnhanced: false,
      },
      features: {
        enableDownload: false, // Restricted for patients
        enablePrint: true,
        enableShare: false, // Controlled sharing only
        enableFullscreen: true,
        enableAnnotations: false, // Disabled for patient portal
        enableMeasurements: false, // Disabled for patient portal
        enableCine: true,
        enableWindowLevel: true,
        enablePresets: true,
        enableThumbnails: true,
        enableSeriesSelector: true,
        enableStudyBrowser: false, // Simplified for patients
      },
      layout: {
        showHeader: true,
        showSidebar: true,
        showToolbar: true,
        showStatusBar: true,
        compactMode: false,
        sidebarPosition: 'left',
        toolbarPosition: 'top',
      },
    };
  }

  /**
   * Validate customization object
   */
  private validateCustomization(customization: ViewerCustomization): ViewerCustomization {
    // Deep merge with defaults to ensure all required properties exist
    return this.deepMerge(this.defaultCustomization, customization);
  }

  /**
   * Apply CSS properties to element
   */
  private applyCSSProperties(theme: ThemeConfig, element: HTMLElement): void {
    const properties = this.generateCSSProperties(theme);
    
    Object.entries(properties).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
  }

  /**
   * Apply branding to element
   */
  private applyBranding(branding: BrandingConfig, element: HTMLElement): void {
    // Update document title
    if (branding.organizationName) {
      document.title = `${branding.organizationName} - Medical Imaging Viewer`;
    }

    // Update favicon if provided
    if (branding.favicon) {
      this.updateFavicon(branding.favicon);
    }

    // Apply branding CSS properties
    element.style.setProperty('--ohif-brand-primary', branding.primaryColor);
    element.style.setProperty('--ohif-brand-secondary', branding.secondaryColor);
    element.style.setProperty('--ohif-brand-accent', branding.accentColor);
    element.style.setProperty('--ohif-brand-background', branding.backgroundColor);
    element.style.setProperty('--ohif-brand-text', branding.textColor);
    element.style.setProperty('--ohif-brand-link', branding.linkColor);
    element.style.setProperty('--ohif-brand-font', branding.fontFamily);
  }

  /**
   * Apply accessibility settings
   */
  private applyAccessibility(accessibility: AccessibilityConfig, element: HTMLElement): void {
    element.classList.toggle('high-contrast', accessibility.highContrast);
    element.classList.toggle('large-text', accessibility.largeText);
    element.classList.toggle('reduced-motion', accessibility.reducedMotion);
    element.classList.toggle('screen-reader-optimized', accessibility.screenReaderOptimized);
    element.classList.toggle('keyboard-navigation-enhanced', accessibility.keyboardNavigationEnhanced);
    element.classList.toggle('focus-indicator-enhanced', accessibility.focusIndicatorEnhanced);
  }

  /**
   * Apply layout settings
   */
  private applyLayout(layout: any, element: HTMLElement): void {
    element.classList.toggle('compact-mode', layout.compactMode);
    element.setAttribute('data-sidebar-position', layout.sidebarPosition);
    element.setAttribute('data-toolbar-position', layout.toolbarPosition);
  }

  /**
   * Update favicon
   */
  private updateFavicon(faviconUrl: string): void {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement || 
                 document.createElement('link');
    link.rel = 'icon';
    link.href = faviconUrl;
    
    if (!link.parentNode) {
      document.head.appendChild(link);
    }
  }

  /**
   * Generate CSS properties from theme
   */
  private generateCSSProperties(theme: ThemeConfig): Record<string, string> {
    return {
      '--ohif-primary-color': theme.colors.primary,
      '--ohif-secondary-color': theme.colors.secondary,
      '--ohif-background-color': theme.colors.background,
      '--ohif-surface-color': theme.colors.surface,
      '--ohif-text-color': theme.colors.text,
      '--ohif-text-secondary-color': theme.colors.textSecondary,
      '--ohif-border-color': theme.colors.border,
      '--ohif-success-color': theme.colors.success,
      '--ohif-warning-color': theme.colors.warning,
      '--ohif-error-color': theme.colors.error,
      '--ohif-info-color': theme.colors.info,
      '--ohif-font-family': theme.typography.fontFamily,
      '--ohif-font-size-small': theme.typography.fontSize.small,
      '--ohif-font-size-medium': theme.typography.fontSize.medium,
      '--ohif-font-size-large': theme.typography.fontSize.large,
      '--ohif-font-size-xlarge': theme.typography.fontSize.xlarge,
    };
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

// Create singleton instance
export const ohifCustomization = OHIFCustomizationService.getInstance();