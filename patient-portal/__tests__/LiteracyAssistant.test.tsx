import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LiteracyAssistant from '../components/LiteracyAssistant';

describe('LiteracyAssistant Component', () => {
  it('renders with toggle button initially collapsed', () => {
    render(<LiteracyAssistant />);
    
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    
    // Content should not be visible initially
    expect(screen.queryByRole('region', { name: /Medical terms glossary/ })).not.toBeInTheDocument();
  });

  it('expands when toggle button is clicked', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant />);
    
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    await user.click(toggleButton);
    
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /Medical terms glossary/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search medical terms...')).toBeInTheDocument();
  });

  it('can be initially expanded', () => {
    render(<LiteracyAssistant initiallyExpanded={true} />);
    
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /Medical terms glossary/ })).toBeInTheDocument();
  });

  it('displays medical terms when expanded', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant />);
    
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    await user.click(toggleButton);
    
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    expect(screen.getByText('High blood pressure')).toBeInTheDocument();
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.getByText('Prescription')).toBeInTheDocument();
    expect(screen.getByText('Laboratory')).toBeInTheDocument();
  });

  it('filters medical terms based on search input', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant initiallyExpanded={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search medical terms...');
    await user.type(searchInput, 'diabetes');
    
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.getByText('A condition where blood sugar levels are too high')).toBeInTheDocument();
    
    // Other terms should not be visible
    expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
    expect(screen.queryByText('Prescription')).not.toBeInTheDocument();
  });

  it('shows no results message when search yields no matches', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant initiallyExpanded={true} />);
    
    const searchInput = screen.getByPlaceholderText('Search medical terms...');
    await user.type(searchInput, 'xyz123');
    
    expect(screen.getByText('No medical terms found matching your search.')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant />);
    
    // Check main region
    const mainRegion = screen.getByRole('region', { name: 'Health Literacy Assistant' });
    expect(mainRegion).toBeInTheDocument();
    
    // Check toggle button accessibility
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    expect(toggleButton).toHaveAttribute('aria-controls', 'literacy-assistant-content');
    
    // Expand and check content accessibility
    await user.click(toggleButton);
    
    const searchInput = screen.getByLabelText('Search medical terms');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('aria-describedby', 'search-help');
    
    const termsList = screen.getByRole('list');
    expect(termsList).toBeInTheDocument();
  });

  it('applies custom className correctly', () => {
    const { container } = render(<LiteracyAssistant className="custom-class" />);
    const assistantDiv = container.querySelector('.literacy-assistant');
    
    expect(assistantDiv).toHaveClass('custom-class');
  });

  it('collapses when toggle button is clicked again', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant initiallyExpanded={true} />);
    
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    
    await user.click(toggleButton);
    
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: /Medical terms glossary/ })).not.toBeInTheDocument();
  });

  it('applies proper CSS classes for enhanced hover and focus states', () => {
    const { container } = render(<LiteracyAssistant initiallyExpanded={true} />);
    
    // Check toggle button has correct class
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    expect(toggleButton).toHaveClass('literacy-toggle-btn');
    
    // Check search input has correct class
    const searchInput = screen.getByPlaceholderText('Search medical terms...');
    expect(searchInput).toHaveClass('literacy-search-input');
    
    // Check term items have correct class
    const termItems = container.querySelectorAll('.literacy-term-item');
    expect(termItems.length).toBeGreaterThan(0);
    termItems.forEach(item => {
      expect(item).toHaveClass('literacy-term-item');
    });
  });

  it('maintains focus accessibility for keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<LiteracyAssistant initiallyExpanded={true} />);
    
    // Focus should work on toggle button
    const toggleButton = screen.getByRole('button', { name: /Health Literacy Assistant/ });
    await user.tab();
    expect(toggleButton).toHaveFocus();
    
    // Focus should move to search input
    await user.tab();
    const searchInput = screen.getByPlaceholderText('Search medical terms...');
    expect(searchInput).toHaveFocus();
  });
});