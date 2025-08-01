# WebQX™ Healthcare Platform Design System

## Overview

This design system provides a comprehensive set of TailwindCSS-based components and utilities specifically designed for healthcare applications. It emphasizes accessibility, professional aesthetics, and user-friendly interfaces for both patients and healthcare providers.

## 🎨 Color Palette

### Primary Colors
- **Primary Blue**: `#3498db` - Main branding color, used for primary actions and highlights
- **Secondary Green**: `#27ae60` - Success states, positive actions, and health indicators
- **Healthcare Light Blue**: `#e3f2fd` - Background accents and information displays

### Extended Palette
```css
primary: {
  50: '#f0f9ff',   /* Lightest blue for backgrounds */
  100: '#e0f3fe',  /* Light blue for subtle highlights */
  500: '#3498db',  /* Main primary color */
  600: '#2980b9',  /* Darker blue for hover states */
  900: '#1e293b',  /* Darkest blue for text */
}

secondary: {
  50: '#f0fdf4',   /* Lightest green */
  500: '#27ae60',  /* Main secondary color */
  600: '#229954',  /* Darker green for hover states */
}

medical: {
  pristine: '#ffffff',  /* Pure white for cards */
  clean: '#f8f9fa',     /* Light gray background */
  neutral: '#e9ecef',   /* Border colors */
  subtle: '#dee2e6',    /* Subtle borders */
  muted: '#6c757d',     /* Muted text */
  text: '#2c3e50',      /* Primary text color */
}
```

## 🔤 Typography

### Font Families
- **Sans**: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- **Medical**: `'Inter', 'system-ui', sans-serif`

### Medical-Specific Font Sizes
- `medical-sm`: 0.875rem with line-height 1.6
- `medical-base`: 1rem with line-height 1.6  
- `medical-lg`: 1.125rem with line-height 1.6

## 🧱 Core Components

### Medical Cards
```html
<div class="medical-card">
  <div class="medical-card-header">
    <h3 class="medical-card-title">Card Title</h3>
  </div>
  <div class="section-content">
    <!-- Card content -->
  </div>
</div>
```

### Buttons
```html
<!-- Primary Button -->
<button class="btn-primary">Primary Action</button>

<!-- Secondary Button -->
<button class="btn-secondary">Secondary Action</button>

<!-- Outline Button -->
<button class="btn-outline">Outline Button</button>

<!-- Ghost Button -->
<button class="btn-ghost">Ghost Button</button>
```

### Forms
```html
<div class="form-group">
  <label class="form-label">Field Label</label>
  <input class="form-input" type="text" placeholder="Enter value">
  <div class="form-help">Helper text</div>
  <div class="form-error hidden">Error message</div>
</div>
```

### Status Indicators
```html
<span class="status-success">Active</span>
<span class="status-warning">Pending</span>
<span class="status-error">Error</span>
<span class="status-info">Information</span>
```

### Alerts
```html
<div class="alert success">Success message</div>
<div class="alert error">Error message</div>
<div class="alert warning">Warning message</div>
<div class="alert info">Information message</div>
```

## 🏥 Healthcare-Specific Components

### Portal Layout
```html
<body class="portal-layout">
  <div class="portal-container">
    <header class="portal-header">
      <h1 class="portal-title">Page Title</h1>
      <p class="portal-tagline">Subtitle or tagline</p>
    </header>
    <!-- Main content -->
  </div>
</body>
```

### Medical Sections
```html
<section class="medical-section">
  <div class="section-header">
    <h2 class="section-title">Section Title</h2>
  </div>
  <div class="section-content">
    <!-- Section content -->
  </div>
</section>
```

### Medical Lists
```html
<div class="medical-list">
  <div class="medical-list-item">
    <span class="text-2xl">🏥</span>
    <div class="flex-1">
      <span class="text-medical-text font-medium">List Item</span>
    </div>
  </div>
</div>
```

### Appointment Cards
```html
<div class="appointment-card pending">
  <!-- Pending appointment -->
</div>

<div class="appointment-card confirmed">
  <!-- Confirmed appointment -->
</div>

<div class="appointment-card cancelled">
  <!-- Cancelled appointment -->
</div>
```

## 🎭 Animations & Interactions

### Custom Utilities
- `transition-medical`: Smooth transitions for healthcare components
- `hover-lift`: Subtle lift effect on hover
- `focus-medical`: Accessible focus states
- `loading-spinner`: Animated loading indicator

### Animations
- `fade-in`: Gentle fade-in animation
- `slide-up`: Slide up from bottom
- `slide-down`: Slide down from top
- `pulse-slow`: Slow pulse animation
- `bounce-gentle`: Gentle bounce effect

## 🌈 Specialty Color Coding

### Medical Specialties
- `specialty-cardiology`: Red accent (`border-l-red-500`)
- `specialty-radiology`: Purple accent (`border-l-purple-500`)
- `specialty-primary-care`: Blue accent (`border-l-blue-500`)
- `specialty-pediatrics`: Pink accent (`border-l-pink-500`)
- `specialty-oncology`: Orange accent (`border-l-orange-500`)
- `specialty-psychiatry`: Indigo accent (`border-l-indigo-500`)

## ♿ Accessibility Features

### Focus Management
- Custom focus rings with `focus-medical` utility
- High contrast mode support
- Reduced motion support for users with vestibular disorders

### Screen Reader Support
- `sr-only` utility for screen reader only content
- Semantic HTML structure
- Proper ARIA labels and roles

### Color Contrast
- All color combinations meet WCAG AA standards
- High contrast mode alternatives provided

## 📱 Responsive Design

### Breakpoint Strategy
- Mobile-first approach
- Responsive grid layouts using CSS Grid
- Flexible component sizing

### Grid Layouts
```html
<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Grid items -->
</div>
```

## 🛠️ Custom CSS Properties

### Gradients
- `bg-gradient-medical`: Primary healthcare gradient
- `bg-gradient-success`: Success state gradient  
- `bg-gradient-primary`: Primary button gradient
- `text-gradient-medical`: Text gradient for branding

### Shadows
- `shadow-medical`: Standard component shadow
- `shadow-card`: Enhanced card shadow
- `shadow-hover`: Hover state shadow
- `shadow-focus`: Focus state shadow

## 📋 Usage Guidelines

### Do's
- ✅ Use medical-card for content containers
- ✅ Apply hover-lift for interactive elements
- ✅ Use status indicators for state communication
- ✅ Maintain consistent spacing with the medical color palette
- ✅ Test all components in high contrast mode

### Don'ts
- ❌ Mix custom CSS with TailwindCSS utility classes
- ❌ Override TailwindCSS variables without updating the design system
- ❌ Use colors outside the defined healthcare palette
- ❌ Ignore accessibility guidelines
- ❌ Create inconsistent button or form styling

## 🔧 Development

### Building CSS
```bash
# Development build with watch
npm run build:css

# Production build (minified)
npm run build:css:prod
```

### Configuration
The design system is configured in `tailwind.config.js` with healthcare-specific:
- Color palette extensions
- Custom component utilities
- Animation definitions
- Responsive breakpoints

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

## 📚 Examples

### Complete Patient Card
```html
<div class="medical-card specialty-primary-care">
  <div class="medical-card-header">
    <h3 class="medical-card-title flex items-center gap-2">
      👤 Patient Information
    </h3>
  </div>
  <div class="section-content">
    <div class="medical-list">
      <div class="medical-list-item">
        <span class="text-2xl">📧</span>
        <div class="flex-1">
          <span class="text-medical-text">Email: patient@example.com</span>
        </div>
      </div>
    </div>
  </div>
</div>
```

### Interactive Button Group
```html
<div class="flex gap-3">
  <button class="btn-primary hover-lift">Primary Action</button>
  <button class="btn-outline">Secondary Action</button>
  <button class="btn-ghost">Cancel</button>
</div>
```

---

*This design system is maintained by the WebQX development team. For questions or contributions, please refer to the project's contributing guidelines.*