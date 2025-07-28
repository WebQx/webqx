/*
 * Copyright (c) 2025 WebQx. All rights reserved.
 * Unauthorized copying of this file, via any medium, is strictly prohibited.
 * Proprietary and confidential.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentCard from '../components/AppointmentCard';

describe('AppointmentCard Component', () => {
  const defaultProps = {
    title: 'Annual Checkup',
    datetime: 'March 15, 2024 at 10:00 AM',
    provider: 'Dr. Smith',
    details: 'Annual physical examination',
    className: 'test-class'
  };

  it('renders correctly with provided props', () => {
    render(<AppointmentCard {...defaultProps} />);
    
    expect(screen.getByText('Annual Checkup')).toBeInTheDocument();
    expect(screen.getByText('📅 March 15, 2024 at 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
    expect(screen.getByText('Annual physical examination')).toBeInTheDocument();
  });

  it('renders with default props when no props are provided', () => {
    render(<AppointmentCard />);
    
    expect(screen.getByText('Upcoming Appointment')).toBeInTheDocument();
    expect(screen.getByText('📅 No appointments scheduled')).toBeInTheDocument();
    expect(screen.getByText(/WebQX Health/)).toBeInTheDocument();
    expect(screen.getByText(/Schedule your next appointment/)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<AppointmentCard {...defaultProps} />);
    
    const appointmentCard = screen.getByRole('article', { name: /Appointment: Annual Checkup/ });
    expect(appointmentCard).toBeInTheDocument();
    
    const datetimeElement = screen.getByLabelText(/Date and time: March 15, 2024 at 10:00 AM/);
    expect(datetimeElement).toBeInTheDocument();
  });

  it('applies custom className correctly', () => {
    const { container } = render(<AppointmentCard className="custom-class" />);
    const appointmentCard = container.querySelector('.appointment-card');
    
    expect(appointmentCard).toHaveClass('custom-class');
  });

  it('displays provider information correctly', () => {
    render(<AppointmentCard {...defaultProps} />);
    
    expect(screen.getByText('Provider:')).toBeInTheDocument();
    expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
  });

  it('applies proper CSS class for enhanced hover states', () => {
    const { container } = render(<AppointmentCard {...defaultProps} />);
    const appointmentCard = container.querySelector('.appointment-card');
    
    expect(appointmentCard).toHaveClass('appointment-card');
  });

  it('maintains focus accessibility for keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<AppointmentCard {...defaultProps} />);
    
    const appointmentCard = screen.getByRole('article', { name: /Appointment: Annual Checkup/ });
    
    // Should be focusable via keyboard
    await user.tab();
    expect(appointmentCard).toHaveFocus();
  });
});