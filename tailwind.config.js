/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./patient-portal/**/*.{html,js}",
    "./auth/**/*.{html,js}",
    "./admin-console/**/*.{html,js}",
    "./modules/**/*.{html,js}",
    "./services/**/*.{html,js}",
    "./components/**/*.{html,js}",
    "./demo/**/*.{html,js}",
    "./*-demo.html",
    "./demo-*.html"
  ],
  theme: {
    extend: {
      colors: {
        // WebQx Healthcare Brand Colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f3fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#3498db', // Primary blue
          600: '#2980b9',
          700: '#1f4e79',
          800: '#1e3a8a',
          900: '#1e293b',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#27ae60', // Primary green
          600: '#229954',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        healthcare: {
          blue: '#3498db',
          green: '#27ae60',
          lightBlue: '#e3f2fd',
          darkBlue: '#2c3e50',
          accent: '#f39c12',
          warning: '#e74c3c',
          success: '#27ae60',
          info: '#3498db',
        },
        medical: {
          pristine: '#ffffff',
          clean: '#f8f9fa',
          neutral: '#e9ecef',
          subtle: '#dee2e6',
          muted: '#6c757d',
          text: '#2c3e50',
        }
      },
      fontFamily: {
        'sans': ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        'medical': ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        'medical-sm': ['0.875rem', { lineHeight: '1.6' }],
        'medical-base': ['1rem', { lineHeight: '1.6' }],
        'medical-lg': ['1.125rem', { lineHeight: '1.6' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '104': '26rem',
        '120': '30rem',
      },
      borderRadius: {
        'medical': '8px',
        'card': '12px',
        'section': '16px',
      },
      boxShadow: {
        'medical': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.15)',
        'hover': '0 8px 25px rgba(52, 152, 219, 0.4)',
        'focus': '0 0 0 3px rgba(52, 152, 219, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [
    // Add custom utilities for healthcare components
    function({ addUtilities }) {
      const newUtilities = {
        '.transition-medical': {
          'transition': 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '.transition-hover': {
          'transition': 'transform 0.2s ease, box-shadow 0.2s ease',
        },
        '.hover-lift': {
          '&:hover': {
            'transform': 'translateY(-2px)',
            'box-shadow': '0 8px 25px rgba(52, 152, 219, 0.4)',
          },
        },
        '.focus-medical': {
          '&:focus': {
            'outline': 'none',
            'box-shadow': '0 0 0 3px rgba(52, 152, 219, 0.2)',
          },
        },
        '.text-gradient-medical': {
          'background': 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text',
        },
        '.bg-gradient-medical': {
          'background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        '.bg-gradient-success': {
          'background': 'linear-gradient(135deg, #27ae60, #229954)',
        },
        '.bg-gradient-primary': {
          'background': 'linear-gradient(135deg, #3498db, #2980b9)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}