import React from 'react';
import PharmacyLocator from '../components/PharmacyLocator';
import { Pharmacy } from '../types/pharmacy';

// Sample data for demonstration
const samplePharmacies: Pharmacy[] = [
  {
    id: '1',
    name: 'CVS Pharmacy',
    availability: 'open',
    price: '$$',
    distance: 0.5,
    address: '123 Main St, Springfield, IL 62701',
    phone: '(555) 123-4567',
    services: ['Prescriptions', 'Vaccinations', 'Health Screenings', 'Blood Pressure Checks']
  },
  {
    id: '2',
    name: 'Walgreens',
    availability: 'open-24h',
    price: '$',
    distance: 1.2,
    address: '456 Oak Ave, Springfield, IL 62702',
    phone: '(555) 987-6543',
    services: ['Prescriptions', 'Photo Services', 'Vaccinations']
  },
  {
    id: '3',
    name: 'Local Health Pharmacy',
    availability: 'closed',
    price: '$$$',
    distance: 0.3,
    address: '789 Pine Rd, Springfield, IL 62703',
    phone: '(555) 555-0123',
    services: ['Prescriptions', 'Compounding', 'Medical Equipment']
  },
  {
    id: '4',
    name: 'Community Care Pharmacy',
    availability: 'open',
    price: '$$',
    distance: 2.1,
    address: '321 Elm Street, Springfield, IL 62704',
    phone: '(555) 444-7890',
    services: ['Prescriptions', 'Diabetes Care', 'Immunizations']
  },
  {
    id: '5',
    name: 'Express Rx',
    availability: 'open-24h',
    price: '$',
    distance: 1.8,
    address: '654 Maple Drive, Springfield, IL 62705',
    phone: '(555) 333-2468'
  }
];

/**
 * Demo page for PharmacyLocator component
 */
export const PharmacyLocatorDemo: React.FC = () => {
  const handlePharmacySelect = (pharmacy: Pharmacy) => {
    console.log('Selected pharmacy:', pharmacy);
    alert(`You selected: ${pharmacy.name}\nDistance: ${pharmacy.distance} miles\nPhone: ${pharmacy.phone || 'N/A'}`);
  };

  return (
    <div className="portal">
      <div className="portal-header">
        <h1 className="portal-title">PharmacyLocator Demo</h1>
        <p className="portal-tagline">Enhanced pharmacy listing with sorting and accessibility features</p>
      </div>
      
      <div className="portal-content">
        <section className="demo-section">
          <PharmacyLocator 
            stores={samplePharmacies}
            onPharmacySelect={handlePharmacySelect}
            className="demo-pharmacy-locator"
          />
        </section>
        
        <section className="demo-section">
          <h2 className="section-title">Empty State Demo</h2>
          <PharmacyLocator stores={[]} />
        </section>
      </div>
      
      <div className="portal-footer">
        <div className="footer-content">
          <p>PharmacyLocator Component Demo - WebQX Healthcare Platform</p>
        </div>
      </div>
    </div>
  );
};

export default PharmacyLocatorDemo;