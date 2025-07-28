import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../pages/Home';

// Mock the child components since we're testing the integration
jest.mock('../components/AppointmentCard', () => {
  return function MockAppointmentCard(props: any) {
    return (
      <div data-testid="appointment-card" className={props.className}>
        {props.title} - {props.datetime} - {props.provider}
      </div>
    );
  };
});

jest.mock('../components/LiteracyAssistant', () => {
  return function MockLiteracyAssistant(props: any) {
    return (
      <div data-testid="literacy-assistant" className={props.className}>
        Health Literacy Assistant {props.initiallyExpanded ? '(expanded)' : '(collapsed)'}
      </div>
    );
  };
});

describe('Home Component', () => {
  it('renders the main portal structure', () => {
    render(<Home />);
    
    // Check main landmarks
    expect(screen.getByRole('main', { name: /WebQX Patient Portal Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    
    // Check main title
    expect(screen.getByText('🌐 Welcome to WebQX™ Patient Portal')).toBeInTheDocument();
    expect(screen.getByText('Empowering Patients and Supporting Health Care Providers')).toBeInTheDocument();
  });

  it('displays personalized welcome message with default patient name', () => {
    render(<Home />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, Patient! 👋');
  });

  it('displays personalized welcome message with custom patient name', () => {
    render(<Home patientName="John Doe" />);
    
    const welcomeRegion = screen.getByRole('region', { name: 'Personalized welcome' });
    expect(welcomeRegion).toBeInTheDocument();
    expect(welcomeRegion).toHaveTextContent('Welcome back, John Doe! 👋');
  });

  it('applies custom className to main portal container', () => {
    const { container } = render(<Home className="custom-portal-class" />);
    const mainElement = container.querySelector('main');
    
    expect(mainElement).toHaveClass('portal');
    expect(mainElement).toHaveClass('custom-portal-class');
  });

  it('renders appointment cards section', () => {
    render(<Home />);
    
    expect(screen.getByRole('region', { name: /appointments/i })).toBeInTheDocument();
    expect(screen.getByText('📅 Your Appointments')).toBeInTheDocument();
    
    // Check that appointment cards are rendered
    const appointmentCards = screen.getAllByTestId('appointment-card');
    expect(appointmentCards).toHaveLength(2);
    expect(appointmentCards[0]).toHaveTextContent('Annual Checkup');
    expect(appointmentCards[1]).toHaveTextContent('Follow-up Visit');
  });

  it('renders quick actions section with navigation', () => {
    render(<Home />);
    
    expect(screen.getByRole('region', { name: /quick actions/i })).toBeInTheDocument();
    expect(screen.getByText('🎯 Quick Actions')).toBeInTheDocument();
    
    // Check navigation buttons
    expect(screen.getByRole('button', { name: /Schedule new appointment/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View test results/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send secure message to provider/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request prescription refill/ })).toBeInTheDocument();
  });

  it('renders health overview section', () => {
    render(<Home />);
    
    expect(screen.getByRole('region', { name: /health overview/i })).toBeInTheDocument();
    expect(screen.getByText('📊 Health Overview')).toBeInTheDocument();
    
    // Check vital signs
    expect(screen.getByRole('group', { name: /Vital signs summary/ })).toBeInTheDocument();
    expect(screen.getByText(/Blood Pressure: 120\/80 mmHg/)).toBeInTheDocument();
    
    // Check health alerts
    expect(screen.getByRole('group', { name: /Health alerts and reminders/ })).toBeInTheDocument();
    expect(screen.getByText(/Annual flu shot due/)).toBeInTheDocument();
  });

  it('renders literacy assistant when showLiteracyAssistant is true', () => {
    render(<Home showLiteracyAssistant={true} />);
    
    expect(screen.getByRole('region', { name: /health education/i })).toBeInTheDocument();
    expect(screen.getByText('📚 Health Education')).toBeInTheDocument();
    expect(screen.getByTestId('literacy-assistant')).toBeInTheDocument();
  });

  it('does not render literacy assistant when showLiteracyAssistant is false', () => {
    render(<Home showLiteracyAssistant={false} />);
    
    expect(screen.queryByRole('region', { name: /health education/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('literacy-assistant')).not.toBeInTheDocument();
  });

  it('renders emergency information section', () => {
    render(<Home />);
    
    expect(screen.getByRole('region', { name: /emergency/i })).toBeInTheDocument();
    expect(screen.getByText('🚨 Emergency Information')).toBeInTheDocument();
    
    // Check emergency contact info
    expect(screen.getByRole('group', { name: /Emergency contact information/ })).toBeInTheDocument();
    expect(screen.getByText(/For medical emergencies, call 911 immediately/)).toBeInTheDocument();
    expect(screen.getByText(/Nurse Hotline: \(555\) 123-HELP/)).toBeInTheDocument();
  });

  it('renders footer with navigation links', () => {
    render(<Home />);
    
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    
    // Check footer navigation
    expect(screen.getByRole('navigation', { name: /Footer navigation/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Privacy policy/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Terms of service/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Help and support/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Accessibility statement/ })).toBeInTheDocument();
  });

  it('has proper semantic structure and accessibility', () => {
    render(<Home />);
    
    // Check main landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    
    // Check that all sections have proper headings
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(5);
    
    // Check that h1 exists and is unique
    const h1Elements = screen.getAllByRole('heading', { level: 1 });
    expect(h1Elements).toHaveLength(1);
    
    // Check navigation elements
    const navigationElements = screen.getAllByRole('navigation');
    expect(navigationElements.length).toBeGreaterThan(0);
  });

  it('quick action buttons have proper accessibility labels', () => {
    render(<Home />);
    
    const buttons = [
      { text: '🗓️ Schedule Appointment', label: 'Schedule new appointment' },
      { text: '🧪 View Lab Results', label: 'View test results' },
      { text: '💬 Message Provider', label: 'Send secure message to provider' },
      { text: '💊 Refill Prescription', label: 'Request prescription refill' }
    ];
    
    buttons.forEach(button => {
      const buttonElement = screen.getByRole('button', { name: button.label });
      expect(buttonElement).toBeInTheDocument();
      expect(buttonElement).toHaveTextContent(button.text);
    });
  });

  it('applies proper CSS classes for enhanced focus and hover states', () => {
    render(<Home />);
    
    // Check that action buttons have the correct class
    const actionButtons = screen.getAllByRole('button', { name: /Schedule|View|Message|Request/ });
    actionButtons.forEach(button => {
      expect(button).toHaveClass('action-button');
    });
  });

  it('maintains keyboard navigation accessibility', async () => {
    const user = userEvent.setup();
    render(<Home />);
    
    // Start tabbing through interactive elements
    const firstButton = screen.getByRole('button', { name: /Schedule new appointment/ });
    
    // Focus should work on buttons
    await user.tab();
    expect(firstButton).toHaveFocus();
    
    // Continue tabbing to next button
    await user.tab();
    const secondButton = screen.getByRole('button', { name: /View test results/ });
    expect(secondButton).toHaveFocus();
  });
});