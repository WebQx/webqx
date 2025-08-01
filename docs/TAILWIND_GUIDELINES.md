# WebQX™ TailwindCSS Development Guidelines

## Quick Start

1. **Install dependencies**: `npm install`
2. **Build CSS**: `npm run build:css:prod`
3. **Start development**: `npm run dev`

## File Structure

```
webqx/
├── styles/
│   ├── tailwind-input.css    # Main Tailwind input file
│   └── output.css            # Generated CSS (do not edit)
├── tailwind.config.js        # Tailwind configuration
├── postcss.config.js         # PostCSS configuration
└── docs/
    └── DESIGN_SYSTEM.md      # Design system documentation
```

## CSS Building Process

### Development
```bash
npm run build:css    # Watch mode for development
```

### Production
```bash
npm run build:css:prod    # Minified for production
```

## HTML File Integration

### Standard Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WebQX™ - Page Title</title>
    <link href="styles/output.css" rel="stylesheet">
</head>
<body class="portal-layout">
    <div class="portal-container">
        <!-- Page content -->
    </div>
</body>
</html>
```

## Component Usage Examples

### Medical Card Layout
```html
<section class="medical-section">
    <div class="section-header">
        <h2 class="section-title">
            🏥 Section Title
        </h2>
    </div>
    <div class="section-content">
        <!-- Content here -->
    </div>
</section>
```

### Button Patterns
```html
<!-- Primary actions -->
<button class="btn-primary hover-lift">Submit</button>

<!-- Secondary actions -->
<button class="btn-outline">Cancel</button>

<!-- Full-width buttons -->
<button class="btn-primary w-full">Full Width Action</button>
```

### Form Patterns
```html
<div class="form-group">
    <label class="form-label">Field Label</label>
    <input class="form-input" type="text" required>
    <div class="form-help">Optional help text</div>
</div>
```

### Loading States
```html
<div class="flex items-center gap-2">
    <div class="loading-spinner"></div>
    <span>Loading...</span>
</div>
```

## Responsive Design

### Grid Layouts
```html
<!-- Mobile-first responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <div class="medical-card">Card 1</div>
    <div class="medical-card">Card 2</div>
    <div class="medical-card">Card 3</div>
</div>
```

### Responsive Text
```html
<h1 class="text-2xl md:text-4xl lg:text-5xl">Responsive Heading</h1>
```

## Accessibility Guidelines

### Focus Management
```html
<!-- Always include focus-medical for interactive elements -->
<button class="btn-primary focus-medical">Accessible Button</button>
```

### Screen Reader Support
```html
<span class="sr-only">Screen reader only text</span>
```

### Color Contrast
- Use only colors from the defined healthcare palette
- Test in high contrast mode
- Ensure text meets WCAG AA standards

## Animation Best Practices

### Hover Effects
```html
<div class="medical-card hover-lift transition-medical">
    Hoverable card
</div>
```

### Loading Animations
```html
<div class="loading-spinner" aria-label="Loading"></div>
```

### Reduced Motion
The design system automatically respects `prefers-reduced-motion` settings.

## Common Patterns

### Status Indicators
```html
<span class="status-success">Active</span>
<span class="status-warning">Pending</span>
<span class="status-error">Error</span>
```

### Alert Messages
```html
<div class="alert success">Success message</div>
<div class="alert error">Error occurred</div>
```

### Specialty Coding
```html
<div class="medical-card specialty-cardiology">Cardiology content</div>
<div class="medical-card specialty-radiology">Radiology content</div>
```

## Performance Tips

1. **Use production build**: Always use `npm run build:css:prod` for production
2. **Minimize custom CSS**: Prefer TailwindCSS utilities over custom CSS
3. **Optimize images**: Use WebP format where possible
4. **Bundle splitting**: Consider code splitting for large applications

## Browser Testing

### Required Testing
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

### Accessibility Testing
- ✅ Screen reader compatibility
- ✅ Keyboard navigation
- ✅ High contrast mode
- ✅ Reduced motion preferences

## Troubleshooting

### CSS Not Loading
1. Check file path: `styles/output.css`
2. Verify build process: `npm run build:css:prod`
3. Clear browser cache

### Styles Not Updating
1. Check if watching: `npm run build:css`
2. Verify Tailwind config includes file paths
3. Restart build process

### Custom Components Not Working
1. Verify class names in `tailwind-input.css`
2. Check for typos in component classes
3. Ensure CSS is rebuilt after changes

## Version Control

### Files to Commit
- ✅ `tailwind.config.js`
- ✅ `styles/tailwind-input.css`
- ✅ `styles/output.css`
- ✅ HTML files using TailwindCSS

### Files to Ignore
- ❌ `node_modules/`
- ❌ Temporary build files
- ❌ IDE-specific files

## Maintenance

### Regular Tasks
1. Update TailwindCSS: `npm update tailwindcss`
2. Review and optimize CSS bundle size
3. Test accessibility compliance
4. Update browser compatibility

### When Adding New Components
1. Define in `styles/tailwind-input.css`
2. Document in `docs/DESIGN_SYSTEM.md`
3. Test across all supported browsers
4. Verify accessibility compliance

---

*For detailed component documentation, see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)*