# PharmacyLocator Component

A comprehensive React TypeScript component for displaying pharmacy information with medication pricing, distance, and availability data.

## 🚀 Features

### ✅ All Requirements Implemented

1. **TypeScript Enhancements**
   - Strongly-typed `PharmacyStore` interface for store data
   - Typed `PharmacyLocatorProps` interface for component props
   - Full TypeScript coverage with strict typing

2. **Error Handling**
   - Robust error handling in `fetchMockPharmacyOptions` function
   - User-friendly error messages for API/network failures
   - Graceful handling of both Error objects and string exceptions

3. **Loading State**
   - Loading spinner with accessibility support
   - ARIA attributes for screen readers
   - Smooth loading animations

4. **Accessibility Improvements**
   - Semantic HTML structure (header, list, regions)
   - Comprehensive ARIA labels and roles
   - Keyboard navigation support (Enter and Space keys)
   - Live regions for dynamic content announcements
   - Focus management and indicators
   - High contrast mode support
   - Reduced motion preferences support

5. **UI Enhancements**
   - Smart highlighting for best prices (bottom 25%)
   - Distance-based highlighting (closest pharmacies)
   - Responsive design for all screen sizes
   - Hover effects and visual feedback
   - Color-coded status indicators
   - Professional styling with CSS Grid/Flexbox

6. **Testing**
   - Comprehensive test suite with 24 test cases
   - Tests for all component states (loading, error, empty, success)
   - User interaction testing (click, keyboard navigation)
   - Accessibility testing
   - Props and configuration testing

## 📁 File Structure

```
patient-portal/
├── components/
│   └── PharmacyLocator.tsx      # Main component
├── __tests__/
│   └── PharmacyLocator.test.tsx # Test suite
├── styles/
│   └── PharmacyLocator.css      # Component styles
└── demo/
    └── PharmacyLocator-demo.html # Demo documentation
```

## 🏗️ TypeScript Interfaces

```typescript
interface PharmacyStore {
  name: string;        // Pharmacy name
  rxcui: string[];     // RxCUI identifiers
  price: string;       // Medication price
  distance: number;    // Distance in miles
  status: string;      // Availability status
}

interface PharmacyLocatorProps {
  rxcui?: string;      // Medication identifier
  className?: string;  // Custom CSS class
  onPharmacySelect?: (pharmacy: PharmacyStore) => void;
}
```

## 📋 Usage

```tsx
import PharmacyLocator from './components/PharmacyLocator';

// Basic usage
<PharmacyLocator rxcui="12345" />

// With callback and styling
<PharmacyLocator 
  rxcui="12345"
  className="my-custom-class"
  onPharmacySelect={(pharmacy) => {
    console.log('Selected pharmacy:', pharmacy);
  }}
/>
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run only PharmacyLocator tests
npm test -- PharmacyLocator

# Run with coverage
npm run test:coverage

# Type checking
npm run type-check
```

### Test Coverage Summary

- **24 total tests** covering all scenarios
- **Loading State**: 2 tests
- **Error State**: 3 tests  
- **Empty State**: 2 tests
- **Successful Data Display**: 4 tests
- **User Interactions**: 4 tests
- **Accessibility**: 3 tests
- **Props and Configuration**: 2 tests
- **Data Handling**: 2 tests
- **Integration**: 2 tests

## ♿ Accessibility Features

- **Semantic HTML**: Proper heading hierarchy and landmark regions
- **ARIA Labels**: Descriptive labels for all interactive elements
- **Live Regions**: Screen reader announcements for dynamic updates
- **Keyboard Navigation**: Full keyboard support with tab order
- **Focus Management**: Clear focus indicators and proper tab flow
- **Screen Reader Support**: Comprehensive screen reader compatibility
- **High Contrast**: Support for high contrast display modes
- **Motion Preferences**: Respects user's reduced motion settings

## 🎨 UI Features

### Smart Highlighting
- **Best Price**: Automatically highlights pharmacies in bottom 25% of prices
- **Closest Distance**: Highlights pharmacies in bottom 25% of distances
- **Visual Indicators**: Clear badges for highlighted features

### Responsive Design
- **Mobile-first**: Optimized for mobile devices
- **Breakpoints**: Responsive design for tablets and desktops
- **Grid Layout**: Flexible grid system for pharmacy details
- **Touch-friendly**: Appropriate touch targets for mobile

### Visual Feedback
- **Hover Effects**: Subtle animations on hover
- **Focus States**: Clear focus indicators for keyboard users
- **Loading Animations**: Smooth loading spinner
- **Status Colors**: Color-coded availability status

## 🔧 Technical Implementation

### State Management
- React hooks for component state
- Proper dependency arrays for effects
- Efficient re-rendering optimization

### Error Handling
- Try-catch blocks for API calls
- Graceful degradation on failures
- User-friendly error messages

### Performance
- Minimal re-renders
- Efficient highlighting calculations
- Optimized CSS with modern properties

### Data Flow
1. Component mounts → triggers useEffect
2. Loading state activated
3. fetchMockPharmacyOptions called
4. Success → display pharmacies with highlighting
5. Error → show error state with retry guidance

## 📊 Sample Data

```json
[
  {
    "name": "HealthMart Orlando",
    "rxcui": ["12345"],
    "price": "18.99",
    "distance": 1.2,
    "status": "Available"
  },
  {
    "name": "CVS Downtown",
    "rxcui": ["12345"],
    "price": "22.50",
    "distance": 2.0,
    "status": "In Stock"
  },
  {
    "name": "Walgreens Main St",
    "rxcui": ["12345"],
    "price": "16.75",
    "distance": 3.5,
    "status": "Available"
  }
]
```

## 🚀 Future Enhancements

- Integration with real pharmacy APIs
- Geolocation-based distance calculation
- Filtering and sorting options
- Pharmacy details modal
- Medication availability alerts
- Price comparison charts

## 📈 Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ with polyfills
- Mobile browsers (iOS Safari, Android Chrome)
- Screen readers (NVDA, JAWS, VoiceOver)

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run type-check

# Build for production
npm run build
```

---

*This component was built following accessibility guidelines, TypeScript best practices, and comprehensive testing strategies.*