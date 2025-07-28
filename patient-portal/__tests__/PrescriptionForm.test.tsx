import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrescriptionForm from '../components/PrescriptionForm';

describe('PrescriptionForm', () => {
  test('renders prescription form with search input', () => {
    render(<PrescriptionForm />);
    
    expect(screen.getByText('Medication Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search for medications...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  test('updates search query when typing in input', () => {
    render(<PrescriptionForm />);
    
    const searchInput = screen.getByPlaceholderText('Search for medications...');
    fireEvent.change(searchInput, { target: { value: 'ibuprofen' } });
    
    expect(searchInput).toHaveValue('ibuprofen');
  });

  test('shows loading state when search button is clicked with valid input', () => {
    render(<PrescriptionForm />);
    
    const searchInput = screen.getByPlaceholderText('Search for medications...');
    const searchButton = screen.getByRole('button', { name: 'Search' });
    
    fireEvent.change(searchInput, { target: { value: 'test medication' } });
    fireEvent.click(searchButton);
    
    // Check for loading state immediately
    expect(screen.getByText('🔄 Searching for medications...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔄 Searching...' })).toBeDisabled();
  });

  test('does not search with empty query', () => {
    render(<PrescriptionForm />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    fireEvent.click(searchButton);
    
    // Should not show loading or results with empty query
    expect(screen.queryByText('🔄 Searching for medications...')).not.toBeInTheDocument();
    expect(screen.queryByText('Search Results:')).not.toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<PrescriptionForm className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('prescription-form');
    expect(container.firstChild).toHaveClass('custom-class');
  });

  test('has proper accessibility attributes', () => {
    render(<PrescriptionForm />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  test('input supports keyboard navigation', () => {
    render(<PrescriptionForm />);
    
    const searchInput = screen.getByPlaceholderText('Search for medications...');
    
    // Test that input can receive focus and accept keyboard input
    searchInput.focus();
    expect(searchInput).toHaveFocus();
    
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput).toHaveValue('test');
  });

  test('search button is properly labeled for screen readers', () => {
    render(<PrescriptionForm />);
    
    const searchButton = screen.getByRole('button', { name: 'Search' });
    expect(searchButton).toBeInTheDocument();
    expect(searchButton).toHaveTextContent('Search');
  });

  test('component has proper structure and headings', () => {
    render(<PrescriptionForm />);
    
    expect(screen.getByText('Medication Search')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});