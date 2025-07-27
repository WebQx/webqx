# WebQX Patient Portal

## Overview

The WebQX Patient Portal is a React TypeScript application that provides patients with comprehensive access to their healthcare information and services. This modular system is designed with accessibility, internationalization, and privacy-first principles.

## Architecture

### Components

#### `Home.tsx` - Main Dashboard Component

The `Home` component serves as the primary landing page for patients accessing the WebQX healthcare platform. It provides a comprehensive overview of available services and quick access to essential healthcare features.

**Features:**
- **Personalized Welcome**: Customizable greeting with patient name
- **Appointment Management**: View upcoming appointments and quick scheduling
- **Health Overview**: Display of recent vitals and health alerts
- **Quick Actions**: Fast access to common tasks (scheduling, messaging, prescriptions)
- **Health Literacy Assistant**: Interactive medical terminology helper
- **Emergency Information**: Always-accessible emergency contact information
- **Accessibility Compliant**: Full ARIA support and semantic HTML
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

**Props:**
```typescript
interface HomeProps {
  patientName?: string;           // Patient's display name for personalization
  className?: string;             // CSS class name for additional styling
  showLiteracyAssistant?: boolean; // Whether to show the literacy assistant
}
```

**Usage:**
```typescript
import Home from './pages/Home';

// Basic usage
<Home />

// With custom patient name
<Home patientName="John Doe" />

// With custom styling and hidden literacy assistant
<Home 
  className="custom-portal-style" 
  patientName="Jane Smith"
  showLiteracyAssistant={false}
/>
```

#### `AppointmentCard.tsx` - Appointment Display Component

Displays individual appointment information with proper accessibility support.

**Props:**
```typescript
interface AppointmentCardProps {
  title?: string;      // The title of the appointment
  datetime?: string;   // The date and time of the appointment
  provider?: string;   // The provider or department name
  details?: string;    // Additional appointment details
  className?: string;  // CSS class name for styling
}
```

#### `LiteracyAssistant.tsx` - Health Education Component

Provides interactive health literacy support with searchable medical terminology.

**Props:**
```typescript
interface LiteracyAssistantProps {
  className?: string;          // CSS class name for styling
  initiallyExpanded?: boolean; // Whether the assistant is initially expanded
}
```

## Styling

The portal uses a comprehensive CSS system located in `styles/portal.css` that includes:

- **Responsive Grid Layout**: Adapts to different screen sizes
- **Accessibility Features**: High contrast support, reduced motion preferences
- **Interactive Elements**: Hover states, focus indicators
- **Color System**: Consistent color palette for healthcare branding
- **Typography**: Clear, readable font hierarchy

### CSS Classes

- `.portal` - Main container class with responsive layout
- `.portal-header` - Header section with title and welcome message
- `.portal-content` - Main content grid area
- `.appointment-card` - Individual appointment card styling
- `.action-button` - Quick action button styling
- `.literacy-assistant` - Health literacy component styling

## Accessibility

The portal is designed with accessibility as a priority:

- **Semantic HTML**: Proper use of landmarks, headings, and ARIA labels
- **Keyboard Navigation**: Full keyboard accessibility for all interactive elements
- **Screen Reader Support**: Comprehensive ARIA labels and descriptions
- **High Contrast Mode**: Support for users with visual impairments
- **Reduced Motion**: Respects user preferences for reduced animations

## Testing

Comprehensive test suite using Jest and React Testing Library:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **Component Rendering**: Ensures all components render correctly
- **Accessibility**: Validates ARIA attributes and semantic structure
- **User Interaction**: Tests button clicks, form inputs, and navigation
- **Props Handling**: Verifies correct prop handling and defaults
- **Integration**: Tests component interaction and data flow

## Development Scripts

```bash
# Type checking
npm run type-check

# Run tests
npm test

# Start development server (main app)
npm run dev
```

## Component Guidelines

### Creating New Components

1. **Use TypeScript**: All components should have proper TypeScript interfaces
2. **Accessibility First**: Include proper ARIA labels and semantic HTML
3. **Comprehensive Testing**: Write tests for rendering, interaction, and accessibility
4. **Documentation**: Include JSDoc comments for props and functionality
5. **Responsive Design**: Ensure components work on all screen sizes

### Code Style

- Use functional components with hooks
- Implement proper error boundaries where needed
- Follow the existing naming conventions
- Include comprehensive prop validation
- Use semantic HTML elements
- Implement proper loading and error states

## Security & Privacy

- **HIPAA Compliance**: Designed with healthcare privacy requirements
- **Data Protection**: No sensitive data stored in client-side code
- **Secure Communication**: All API calls should use HTTPS
- **Access Control**: Implement proper authentication and authorization

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Accessibility Tools**: Compatible with screen readers and assistive technologies

## Performance

- **Code Splitting**: Components can be lazy-loaded as needed
- **Optimized Images**: Use appropriate image formats and sizes
- **Minimal Dependencies**: Keep bundle size optimized
- **Caching**: Implement proper caching strategies for API responses