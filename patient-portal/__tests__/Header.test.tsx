import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../components/Header';
import { SupportedLanguage } from '../types/localization';
import { getTranslations } from '../utils/localization';

// Mock texts for testing
const mockTexts = getTranslations('en');

describe('Header Component', () => {
  const defaultProps = {
    language: 'en' as SupportedLanguage,
    onLanguageChange: jest.fn(),
    texts: mockTexts,
    patientName: 'John Doe'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with correct structure and landmarks', () => {
    render(<Header {...defaultProps} />);
    
    // Check main header landmark
    expect(screen.getByRole('banner')).toBeInTheDocument();
    
    // Check main title
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(mockTexts.portalTitle)).toBeInTheDocument();
    
    // Check tagline
    expect(screen.getByText(mockTexts.portalTagline)).toBeInTheDocument();
  });

  it('displays personalized welcome message with default patient name', () => {
    render(<Header {...defaultProps} />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, John Doe! 👋');
  });

  it('displays personalized welcome message with Patient as default', () => {
    render(<Header {...defaultProps} patientName={undefined} />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, Patient! 👋');
  });

  it('applies custom className to header element', () => {
    const { container } = render(<Header {...defaultProps} className="custom-header-class" />);
    const headerElement = container.querySelector('header');
    
    expect(headerElement).toHaveClass('portal-header');
    expect(headerElement).toHaveClass('custom-header-class');
  });

  describe('Language Selector', () => {
    it('renders language selector with proper accessibility attributes', () => {
      render(<Header {...defaultProps} />);
      
      // Check label
      const label = screen.getByLabelText(mockTexts.languageLabel);
      expect(label).toBeInTheDocument();
      
      // Check select element
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('id', 'language-selector');
      expect(select).toHaveAttribute('aria-labelledby', 'language-selector-label');
      expect(select).toHaveAttribute('aria-describedby', 'language-selector-description');
      
      // Check screen reader description contains the language label text
      const description = screen.getByText((content, element) => {
        return element?.id === 'language-selector-description' && content.includes(mockTexts.languageLabel);
      });
      expect(description).toBeInTheDocument();
    });

    it('displays all available language options', () => {
      render(<Header {...defaultProps} />);
      
      const select = screen.getByRole('combobox');
      
      // Check that all language options are present (simplified - native names only)
      expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '中文' })).toBeInTheDocument();
    });

    it('shows the current language as selected', () => {
      render(<Header {...defaultProps} language="es" />);
      
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('es');
      
      // Check that the current language is reflected in the description
      expect(screen.getByText(/Current selection: Español/)).toBeInTheDocument();
    });

    it('calls onLanguageChange when language is changed', async () => {
      const user = userEvent.setup();
      const mockOnLanguageChange = jest.fn();
      
      render(<Header {...defaultProps} onLanguageChange={mockOnLanguageChange} />);
      
      const select = screen.getByRole('combobox');
      
      // Change language to Spanish
      await user.selectOptions(select, 'es');
      
      // Wait for the timeout delay using act
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(mockOnLanguageChange).toHaveBeenCalledWith('es');
      expect(mockOnLanguageChange).toHaveBeenCalledTimes(1);
    });

    it('handles multiple language changes correctly', async () => {
      const user = userEvent.setup();
      const mockOnLanguageChange = jest.fn();
      
      render(<Header {...defaultProps} onLanguageChange={mockOnLanguageChange} />);
      
      const select = screen.getByRole('combobox');
      
      // Change to different languages with delays
      await user.selectOptions(select, 'fr');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      await user.selectOptions(select, 'de');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      await user.selectOptions(select, 'zh');
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(mockOnLanguageChange).toHaveBeenCalledTimes(3);
      expect(mockOnLanguageChange).toHaveBeenNthCalledWith(1, 'fr');
      expect(mockOnLanguageChange).toHaveBeenNthCalledWith(2, 'de');
      expect(mockOnLanguageChange).toHaveBeenNthCalledWith(3, 'zh');
    });

    it('shows loading state during language change', async () => {
      const user = userEvent.setup();
      const mockOnLanguageChange = jest.fn();
      
      render(<Header {...defaultProps} onLanguageChange={mockOnLanguageChange} />);
      
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
  });

  describe('Localization', () => {
    it('displays content in English by default', () => {
      const englishTexts = getTranslations('en');
      render(<Header {...defaultProps} texts={englishTexts} />);
      
      expect(screen.getByText(englishTexts.portalTitle)).toBeInTheDocument();
      expect(screen.getByText(englishTexts.portalTagline)).toBeInTheDocument();
    });

    it('displays content in Spanish when Spanish texts are provided', () => {
      const spanishTexts = getTranslations('es');
      render(<Header {...defaultProps} language="es" texts={spanishTexts} />);
      
      expect(screen.getByText(spanishTexts.portalTitle)).toBeInTheDocument();
      expect(screen.getByText(spanishTexts.portalTagline)).toBeInTheDocument();
      
      // Check for welcome message with flexible text matcher
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('Bienvenido de nuevo, John Doe! 👋');
    });

    it('displays content in French when French texts are provided', () => {
      const frenchTexts = getTranslations('fr');
      render(<Header {...defaultProps} language="fr" texts={frenchTexts} />);
      
      expect(screen.getByText(frenchTexts.portalTitle)).toBeInTheDocument();
      expect(screen.getByText(frenchTexts.portalTagline)).toBeInTheDocument();
      
      // Check for welcome message with flexible text matcher
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('Bon retour, John Doe! 👋');
    });

    it('displays content in German when German texts are provided', () => {
      const germanTexts = getTranslations('de');
      render(<Header {...defaultProps} language="de" texts={germanTexts} />);
      
      expect(screen.getByText(germanTexts.portalTitle)).toBeInTheDocument();
      expect(screen.getByText(germanTexts.portalTagline)).toBeInTheDocument();
      
      // Check for welcome message with flexible text matcher
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('Willkommen zurück, John Doe! 👋');
    });

    it('displays content in Chinese when Chinese texts are provided', () => {
      const chineseTexts = getTranslations('zh');
      render(<Header {...defaultProps} language="zh" texts={chineseTexts} />);
      
      expect(screen.getByText(chineseTexts.portalTitle)).toBeInTheDocument();
      expect(screen.getByText(chineseTexts.portalTagline)).toBeInTheDocument();
      
      // Check for welcome message with flexible text matcher
      const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
      expect(welcomeRegion).toHaveTextContent('欢迎回来, John Doe! 👋');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure with required landmarks', () => {
      render(<Header {...defaultProps} />);
      
      // Check that header has banner role
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Check that main heading exists and is unique
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
    });

    it('provides screen reader only content for accessibility', () => {
      render(<Header {...defaultProps} />);
      
      // Check portal description
      expect(screen.getByText(/Your comprehensive healthcare management platform/)).toBeInTheDocument();
      
      // Check language selector description contains the language label text
      const description = screen.getByText((content, element) => {
        return element?.id === 'language-selector-description' && content.includes(mockTexts.languageLabel);
      });
      expect(description).toBeInTheDocument();
    });

    it('uses appropriate ARIA attributes for language selector', () => {
      render(<Header {...defaultProps} />);
      
      const select = screen.getByRole('combobox');
      const label = screen.getByText(mockTexts.languageLabel);
      
      // Check ARIA relationships
      expect(select).toHaveAttribute('aria-labelledby', 'language-selector-label');
      expect(select).toHaveAttribute('aria-describedby', 'language-selector-description');
      expect(label).toHaveAttribute('id', 'language-selector-label');
    });

    it('maintains focus management for keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Header {...defaultProps} />);
      
      const select = screen.getByRole('combobox');
      
      // Focus the select element
      await user.click(select);
      expect(select).toHaveFocus();
      
      // Use keyboard to change selection
      await user.keyboard('{ArrowDown}');
      expect(select).toHaveFocus();
    });
  });

  describe('Integration with Parent Component', () => {
    it('properly integrates with state management', async () => {
      const user = userEvent.setup();
      let currentLanguage: SupportedLanguage = 'en';
      const mockOnLanguageChange = jest.fn((newLang: SupportedLanguage) => {
        currentLanguage = newLang;
      });
      
      const { rerender } = render(
        <Header {...defaultProps} onLanguageChange={mockOnLanguageChange} />
      );
      
      const select = screen.getByRole('combobox');
      
      // Change language
      await user.selectOptions(select, 'es');
      
      // Wait for the timeout delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify callback was called
      expect(mockOnLanguageChange).toHaveBeenCalledWith('es');
      
      // Re-render with new language and texts
      const spanishTexts = getTranslations('es');
      rerender(
        <Header 
          {...defaultProps} 
          language="es" 
          texts={spanishTexts}
          onLanguageChange={mockOnLanguageChange} 
        />
      );
      
      // Verify content updated
      expect(screen.getByText(spanishTexts.portalTitle)).toBeInTheDocument();
    });
  });
});