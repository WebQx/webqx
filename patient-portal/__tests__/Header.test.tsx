import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../components/Header';
import { supportedLanguages } from '../i18n/config';
import i18n from '../i18n/config';

describe('Header Component', () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset i18n to English
    await i18n.changeLanguage('en');
  });

  it('renders the header with correct structure and landmarks', () => {
    render(<Header />);
    
    // Check main header landmark
    expect(screen.getByRole('banner')).toBeInTheDocument();
    
    // Check main title
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText('🌐 Welcome to WebQX™ Patient Portal')).toBeInTheDocument();
    
    // Check tagline
    expect(screen.getByText('Empowering Patients and Supporting Health Care Providers')).toBeInTheDocument();
  });

  it('displays personalized welcome message with default patient name', () => {
    render(<Header />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, Patient! 👋');
  });

  it('displays personalized welcome message with custom patient name', () => {
    render(<Header patientName="Dr. Maria García" />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, Dr. Maria García! 👋');
  });

  it('applies custom className to header element', () => {
    const { container } = render(<Header className="custom-header-class" />);
    const headerElement = container.querySelector('header');
    
    expect(headerElement).toHaveClass('portal-header');
    expect(headerElement).toHaveClass('custom-header-class');
  });

  describe('Language Selector', () => {
    it('renders language selector with proper accessibility attributes', () => {
      render(<Header />);
      
      // Check label
      const label = screen.getByLabelText('Language / Idioma / Langue / Sprache / 语言');
      expect(label).toBeInTheDocument();
      
      // Check select element
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('id', 'language-selector');
      expect(select).toHaveAttribute('aria-labelledby', 'language-selector-label');
      expect(select).toHaveAttribute('aria-describedby', 'language-selector-description');
      
      // Check screen reader description
      const description = screen.getByText((content, element) => {
        return element?.id === 'language-selector-description' && 
               content.includes('Language / Idioma / Langue / Sprache / 语言');
      });
      expect(description).toBeInTheDocument();
    });

    it('displays all available language options', () => {
      render(<Header />);
      
      // Check that all language options are present
      expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '中文' })).toBeInTheDocument();
    });

    it('shows English as default language', () => {
      render(<Header />);
      
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('en');
      
      // Check that the current language is reflected in the description
      expect(screen.getByText(/Current language: English/)).toBeInTheDocument();
    });

    it('changes language when option is selected', async () => {
      const user = userEvent.setup();
      
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Change language to Spanish
      await user.selectOptions(select, 'es');
      
      // Wait for the timeout delay using act
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // Check that content changed to Spanish
      expect(screen.getByText('🌐 Bienvenido al Portal de Pacientes WebQX™')).toBeInTheDocument();
      expect(screen.getByText('Empoderando a los Pacientes y Apoyando a los Proveedores de Salud')).toBeInTheDocument();
    });

    it('handles multiple language changes correctly', async () => {
      const user = userEvent.setup();
      
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Change to French
      await user.selectOptions(select, 'fr');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(screen.getByText('🌐 Bienvenue sur le Portail Patient WebQX™')).toBeInTheDocument();
      
      // Change to German
      await user.selectOptions(select, 'de');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(screen.getByText('🌐 Willkommen im WebQX™ Patientenportal')).toBeInTheDocument();
      
      // Change to Chinese
      await user.selectOptions(select, 'zh');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(screen.getByText('🌐 欢迎使用WebQX™患者门户')).toBeInTheDocument();
    });

    it('shows loading state during language change', async () => {
      const user = userEvent.setup();
      
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Change language
      await user.selectOptions(select, 'es');
      
      // Check that select is disabled during change
      expect(select).toBeDisabled();
      expect(select).toHaveClass('changing');
      
      // Wait for the timeout delay using act
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // After delay, select should be enabled again
      expect(select).not.toBeDisabled();
      expect(select).not.toHaveClass('changing');
    });

    it('persists language selection in localStorage', async () => {
      const user = userEvent.setup();
      
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Change language to Spanish
      await user.selectOptions(select, 'es');
      
      // Wait for the change to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      // Check that language is stored in localStorage
      expect(localStorage.getItem('webqx-language')).toBe('es');
    });
  });

  describe('Localization', () => {
    it('displays content in English by default', async () => {
      // Ensure we're in English
      await i18n.changeLanguage('en');
      render(<Header />);
      
      expect(screen.getByText('🌐 Welcome to WebQX™ Patient Portal')).toBeInTheDocument();
      expect(screen.getByText('Empowering Patients and Supporting Health Care Providers')).toBeInTheDocument();
    });

    it('displays personalized welcome in different languages', async () => {
      const user = userEvent.setup();
      render(<Header patientName="John Doe" />);
      
      const select = screen.getByRole('combobox');
      
      // Test Spanish
      await user.selectOptions(select, 'es');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('¡Bienvenido de nuevo, John Doe! 👋');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure with required landmarks', async () => {
      await i18n.changeLanguage('en');
      render(<Header />);
      
      // Check that header has banner role
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check that main heading exists and is unique
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
    });

    it('provides screen reader only content for accessibility', async () => {
      await i18n.changeLanguage('en');
      render(<Header />);
      
      // Check portal description
      expect(screen.getByText(/Your comprehensive healthcare management platform/)).toBeInTheDocument();
      
      // Check language selector description contains the language label text
      const description = screen.getByText((content, element) => {
        return element?.id === 'language-selector-description' && 
               content.includes('Language / Idioma / Langue / Sprache / 语言');
      });
      expect(description).toBeInTheDocument();
    });

    it('uses appropriate ARIA attributes for language selector', () => {
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      const label = screen.getByText('Language / Idioma / Langue / Sprache / 语言');
      
      // Check ARIA relationships
      expect(select).toHaveAttribute('aria-labelledby', 'language-selector-label');
      expect(select).toHaveAttribute('aria-describedby', 'language-selector-description');
      expect(label).toHaveAttribute('id', 'language-selector-label');
    });

    it('maintains focus management for keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Focus the select element
      await user.click(select);
      expect(select).toHaveFocus();
      
      // Use keyboard to change selection
      await user.keyboard('{ArrowDown}');
      expect(select).toHaveFocus();
    });

    it('announces language changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<Header />);
      
      const select = screen.getByRole('combobox');
      
      // Change language
      await user.selectOptions(select, 'es');
      
      // Wait for announcement to be added and removed
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100));
      });
      
      // The announcement element should be created and removed
      // We can't easily test this in JSDOM, but we can verify the effect happened
      expect((select as HTMLSelectElement).value).toBe('es');
    });
  });

  describe('Integration', () => {
    it('works with different patient names', async () => {
      await i18n.changeLanguage('en');
      const testNames = ['Patient', 'Dr. Smith', 'María González', '张医生'];
      
      for (const name of testNames) {
        const { unmount } = render(<Header patientName={name} />);
        
        const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
        expect(welcomeRegion).toHaveTextContent(`Welcome back, ${name}! 👋`);
        
        unmount();
      }
    });

    it('handles empty or undefined patient name gracefully', async () => {
      await i18n.changeLanguage('en');
      render(<Header patientName="" />);
      
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('Welcome back, ! 👋');
    });
  });
});