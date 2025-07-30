/**
 * OpenEMR Integration Example
 * 
 * This example demonstrates how to set up and use the OpenEMR integration
 */

import { OpenEMRIntegration, createOpenEMRConfig } from '../index';

async function main() {
  // Create configuration
  const config = createOpenEMRConfig({
    baseUrl: 'https://demo.openemr.io',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://yourapp.com/callback',
    enableFHIR: true
  });

  // Create integration instance
  const openemr = new OpenEMRIntegration(config);

  try {
    // Initialize the integration
    await openemr.initialize();
    console.log('OpenEMR integration initialized successfully');

    // Get authorization URL for user authentication
    const authUrl = openemr.getAuthorizationUrl();
    console.log('Authorization URL:', authUrl);

    // After user authorizes and you get the code, exchange it for tokens
    // const tokens = await openemr.exchangeCodeForTokens(authCode);

    // Example: Get patient data
    // const patient = await openemr.getPatient('patient-123');
    // console.log('Patient:', patient);

    // Example: Search patients
    // const patients = await openemr.searchPatients({
    //   family: 'Smith',
    //   given: 'John',
    //   birthdate: '1980-01-01'
    // });
    // console.log('Search results:', patients);

    // Example: Book appointment
    // const appointment = await openemr.bookAppointment({
    //   patient: 'patient-123',
    //   practitioner: 'practitioner-456',
    //   start: '2024-01-15T10:00:00Z',
    //   duration: 30,
    //   serviceType: 'General Consultation',
    //   reason: 'Annual checkup'
    // });
    // console.log('Appointment booked:', appointment);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main as openemrExample };