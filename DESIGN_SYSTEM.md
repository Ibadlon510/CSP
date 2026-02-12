# CSP ERP Design System

## Modern SaaS Design - 2026 Edition

This document outlines the complete design system for the CSP ERP platform, redesigned with a modern, sleek aesthetic inspired by leading SaaS applications like Linear, Vercel, Notion, and Stripe.

---

## 🎨 Design Philosophy

### Core Principles
1. **Minimalism** - Clean, uncluttered interfaces with purposeful use of space
2. **Clarity** - Clear visual hierarchy and intuitive information architecture
3. **Consistency** - Uniform patterns across all pages and components
4. **Performance** - Fast, smooth interactions with optimized animations
5. **Accessibility** - WCAG compliant with proper contrast and focus states

---

## 🌈 Color System

### Neutral Palette (Foundation)
```css
Background Primary:   #fafafa  /* Main page background */
Background Secondary: #ffffff  /* Cards, elevated surfaces */
Background Tertiary:  #f5f5f5  /* Subtle backgrounds, hover states */

Text Primary:         #171717  /* Headlines, body text */
Text Secondary:       #525252  /* Subheadings, labels */
Text Tertiary:        #737373  /* Supporting text */
Text Quaternary:      #a3a3a3  /* Placeholder text, disabled */

Border Primary:       #e5e5e5  /* Default borders */
Border Secondary:     #f5f5f5  /* Subtle dividers */
```

### Brand Colors
```css
Primary Black:        #171717  /* Primary actions, emphasis */
Accent Blue:          #0066ff  /* Interactive elements, links */
Accent Purple:        #8b5cf6  /* Secondary accent */
Accent Pink:          #ec4899  /* Tertiary accent */
```

### Semantic Colors
```css
Success:  #22c55e  /* Confirmations, positive states */
Warning:  #f59e0b  /* Warnings, attention needed */
Danger:   #ef4444  /* Errors, destructive actions */
Info:     #3b82f6  /* Informational messages */
```

---

## 📐 Layout & Spacing

### Grid System
- **Container Max Width**: Fluid (no max-width constraint)
- **Content Padding**: 32-40px on main content areas
- **Grid Gaps**: 16px (default), 20px (spacious), 12px (compact)

### Spacing Scale
```css
XS:  4px
SM:  8px
MD:  12px
LG:  16px
XL:  24px
2XL: 32px
3XL: 48px
4XL: 64px
```

---

## 🔤 Typography

### Font Family
```css
Primary: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif
Features: cv11, ss01, ss03 (stylistic alternates)
```

### Type Scale
```css
h1: 36px / 800 weight / -0.025em tracking
h2: 28px / 700 weight / -0.022em tracking
h3: 22px / 700 weight / -0.022em tracking
h4: 18px / 600 weight / -0.014em tracking
h5: 16px / 600 weight / -0.011em tracking
h6: 14px / 600 weight / -0.011em tracking

Body:   14px / 500 weight / 1.6 line-height
Small:  13px / 500 weight
XSmall: 12px / 500 weight
```

### Special Typography
- **Page Title**: 32px, 800 weight, -0.025em tracking
- **Stat Value**: 32px, 700 weight, -0.025em tracking
- **Stat Label**: 13px, 600 weight, uppercase, 0.05em tracking

---

## 🧩 Components

### Buttons

#### Primary (Black)
```css
Background: #171717
Color: #ffffff
Padding: 10px 20px
Border Radius: 8px
Font Weight: 500
Hover: Scale(0.98), box-shadow
```

#### Secondary (Outlined)
```css
Background: #ffffff
Color: #171717
Border: 1px solid #e5e5e5
Hover: Background #f5f5f5
```

#### Ghost (Minimal)
```css
Background: transparent
Color: #525252
Hover: Background #f5f5f5
```

#### Accent (Blue)
```css
Background: #0066ff
Color: #ffffff
Hover: #0052cc + glow shadow
```

### Cards

#### Standard Card
```css
Background: #ffffff
Border: 1px solid #e5e5e5
Border Radius: 16px
Padding: 24px
Shadow: 0 1px 3px rgba(0,0,0,0.04)
Hover: Enhanced shadow + border color change
```

#### Stat Card
```css
Special Features:
- Top gradient bar (appears on hover)
- Larger padding for metrics
- Enhanced hover animation (translateY)
```

### Badges

```css
Border Radius: 9999px (fully rounded)
Padding: 4px 10px
Font Size: 12px
Font Weight: 600
Border: 1px solid (semantic color)

Types:
- Primary, Accent, Success, Warning, Danger, Info, Neutral
- Dot variant (with colored dot indicator)
```

### Form Inputs

```css
Padding: 10px 14px
Border: 1px solid #e5e5e5
Border Radius: 8px
Font Size: 14px
Transitions: All 150ms ease

Focus State:
- Border: #171717
- Shadow: 0 0 0 3px rgba(0,102,255,0.08)
- Background: #ffffff

Hover State:
- Border: #d4d4d4
```

### Tables

```css
Container:
- Background: #ffffff
- Border: 1px solid #e5e5e5
- Border Radius: 16px

Header:
- Background: #f5f5f5
- Text: 12px, 700 weight, uppercase
- Color: #737373

Rows:
- Padding: 16px 20px
- Border Bottom: 1px solid #f5f5f5
- Hover: Background #f5f5f5
```

---

## 🎭 Iconography

### Icon System
We use **Feather Icons** via inline SVG for:
- Consistent stroke width (2px)
- Perfect alignment
- Color inheritance
- Scalable sizing

### Common Icons
- **Navigation**: Dashboard, Users, Contacts, Wallets, Projects
- **Actions**: Plus, Arrow Right, Upload, Download, Edit, Delete
- **Status**: Check, Alert Triangle, X Circle
- **UI**: Search, Filter, Menu, Settings

---

## 🌊 Animations & Transitions

### Transition Speeds
```css
Fast: 150ms
Base: 200ms
Slow: 300ms
Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### Common Animations

#### Button Press
```css
Active: scale(0.98)
Duration: 150ms
```

#### Card Hover
```css
Transform: translateY(-2px)
Shadow: Enhanced
Duration: 200ms
```

#### Loading Spinner
```css
Animation: rotate 0.6s linear infinite
Border: 2px solid
Border-top-color: currentColor
```

#### Skeleton Loader
```css
Background: Linear gradient shimmer
Animation: 1.5s infinite
Direction: -200% to 200%
```

---

## 📱 Layout Components

### Sidebar Navigation
```css
Width: 260px
Background: #ffffff
Border Right: 1px solid #e5e5e5
Position: Sticky
Height: 100vh

Active Item:
- Background: #f0f0f0
- Left Border: 3px solid #171717
- Font Weight: 600
```

### Page Header
```css
Margin Bottom: 32px
Display: Flex (space-between)

Components:
- Page Title (32px, 800 weight)
- Page Subtitle (15px, tertiary color)
- Actions (buttons, filters)
```

### Stats Grid
```css
Display: Grid
Grid: repeat(auto-fit, minmax(260px, 1fr))
Gap: 16px

Responsive: 1-4 columns based on viewport
```

---

## 🎯 Page-Specific Patterns

### Dashboard
- **Welcome Message**: Time-based greeting with first name
- **Stat Cards**: 4-column grid with key metrics
- **Quick Actions**: Prominent primary buttons
- **Activity Feed**: Card-based recent activity

### List Pages (Contacts, Wallets, Projects)
- **Search Bar**: Left-aligned with icon
- **Filters**: Horizontal chip/dropdown layout
- **Table**: Full-width with hover states
- **Empty States**: Centered with illustration-style icons
- **Pagination**: Bottom-aligned counter

### Detail Pages
- **Header**: Entity name + quick actions
- **Tabs**: Horizontal navigation for sections
- **Cards**: Grouped related information
- **Action Buttons**: Fixed or sticky positioning

### Forms
- **Layout**: Single column, max 600px width
- **Labels**: Above inputs, 13px, 600 weight
- **Validation**: Inline error messages with icons
- **Submit**: Full-width primary button

---

## 🌐 Responsive Design

### Breakpoints
```css
Mobile:  < 640px
Tablet:  640px - 1024px
Desktop: > 1024px
```

### Mobile Adaptations
- Sidebar: Collapsible/overlay
- Grid: 1-2 columns max
- Tables: Horizontal scroll
- Font sizes: Slightly reduced
- Padding: Reduced (24px → 16px)

---

## ♿ Accessibility

### Focus States
All interactive elements have visible focus indicators:
```css
Outline: 2px solid #0066ff
Outline Offset: 2px
```

### Contrast Ratios
- **Text on Background**: 7:1 (AAA)
- **Interactive Elements**: 4.5:1 (AA)
- **Disabled States**: 3:1 minimum

### Keyboard Navigation
- Tab order follows visual flow
- Escape closes modals/dropdowns
- Arrow keys for list navigation
- Enter/Space activates buttons

### Screen Reader Support
- Semantic HTML (main, nav, article, etc.)
- ARIA labels for icon-only buttons
- Status announcements for dynamic content
- Form labels properly associated

---

## 🚀 Performance Optimizations

### CSS
- CSS custom properties for theme values
- Minimal use of box-shadow and blur
- Hardware-accelerated transforms
- Efficient transitions (transform, opacity)

### Images & Icons
- Inline SVG for icons (no HTTP requests)
- WebP format for images when available
- Lazy loading for below-fold content
- Responsive images with srcset

### Fonts
- Self-hosted Inter font
- Font-display: swap
- Subset loading (Latin only)
- Preload font files

---

## 🎨 Design Tokens (CSS Variables)

All design tokens are defined in `globals.css`:

```css
/* Backgrounds */
--bg-primary, --bg-secondary, --bg-tertiary

/* Text */
--text-primary, --text-secondary, --text-tertiary, --text-quaternary

/* Borders */
--border-primary, --border-secondary, --border-focus, --border-hover

/* Brand */
--brand-primary, --accent-blue, --accent-purple, --accent-pink

/* Semantic */
--success, --warning, --danger, --info (+ -light, -hover, -border variants)

/* Shadows */
--shadow-xs, --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl

/* Radius */
--radius-xs (4px) through --radius-xl (16px), --radius-full (9999px)

/* Transitions */
--transition-fast, --transition-base, --transition-slow

/* Z-index */
--z-dropdown (1000) through --z-tooltip (1070)
```

---

## 📚 Component Library

### Utility Classes

```css
/* Flexbox */
.flex, .flex-col, .items-center, .justify-between

/* Spacing */
.gap-2 (8px), .gap-3 (12px), .gap-4 (16px), .gap-6 (24px)
.mb-2, .mb-4, .mb-6, .mt-2, .mt-4, .mt-6

/* Typography */
.font-medium (500), .font-semibold (600), .font-bold (700)
.text-xs (12px), .text-sm (13px), .text-base (14px)
.text-muted, .truncate

/* Display */
.loading-spinner, .skeleton, .empty-state
```

---

## 🎬 Interaction Patterns

### Hover States
- **Links**: Color change to accent-blue
- **Buttons**: Scale down slightly + shadow enhancement
- **Cards**: Lift effect (translateY -2px) + shadow
- **Table Rows**: Background color change

### Click/Active States
- **Buttons**: Scale(0.98)
- **Inputs**: Focus ring + border color
- **Checkboxes/Radio**: Fill animation

### Loading States
- **Buttons**: Spinner + "Loading..." text
- **Pages**: Centered spinner
- **Lists**: Skeleton shimmer animation

### Empty States
- **Icon**: Large (48px), muted opacity
- **Title**: 18px, semi-bold
- **Description**: 14px, tertiary color
- **Action**: Primary button if applicable

---

## 🔄 Migration Guide

### Old → New Conversions

```css
/* Colors */
Old: var(--primary) → New: var(--brand-primary)
Old: var(--text) → New: var(--text-primary)
Old: var(--text-light) → New: var(--text-tertiary)
Old: var(--border) → New: var(--border-primary)

/* Buttons */
Old: .btn-primary → New: Same, but updated styles
Old emoji icons → New: SVG icons

/* Cards */
Old: .card → New: Same, but enhanced hover
Old: .stat-card → New: With gradient top bar

/* Badges */
Old: .badge-primary → New: Updated colors
Added: .badge-accent, .badge-neutral, .badge-dot
```

---

## ✅ Implementation Checklist

- [x] Updated color system to modern neutral palette
- [x] Redesigned sidebar with icon system
- [x] Modernized all button variants
- [x] Enhanced card components with hover effects
- [x] Updated badge system with new variants
- [x] Redesigned form inputs with better states
- [x] Improved table styling and empty states
- [x] Created icon component system
- [x] Updated login/register pages
- [x] Redesigned dashboard page
- [x] Updated contacts list page
- [x] Updated wallets page
- [x] Added loading states and spinners
- [x] Implemented utility classes
- [x] Ensured responsive design
- [x] Added accessibility features

---

## 🎓 Best Practices

### Component Creation
1. Use CSS custom properties for theming
2. Include hover/focus/active states
3. Add loading states where applicable
4. Implement empty states for lists
5. Use semantic HTML elements
6. Add ARIA labels for accessibility

### Styling Approach
1. Prefer utility classes for common patterns
2. Use inline styles for component-specific values
3. Leverage CSS transitions for smooth interactions
4. Keep specificity low for easier overrides
5. Use rem/em for scalable sizing

### Icon Usage
1. Use the Icon component for all icons
2. Match icon size to text size (14-18px common)
3. Ensure proper color inheritance
4. Add descriptive labels for accessibility

---

## 📖 Resources

- **Design Inspiration**: Linear, Vercel, Notion, Stripe
- **Icon Library**: Feather Icons (via SVG paths)
- **Font**: Inter (Google Fonts)
- **Color System**: Neutral-first palette
- **Component Patterns**: Modern SaaS applications

---

## 🚀 Future Enhancements

- [ ] Dark mode support
- [ ] Advanced animations (page transitions)
- [ ] Micro-interactions
- [ ] Customizable themes
- [ ] Component Storybook
- [ ] Design system documentation site

---

**Last Updated**: February 2026  
**Version**: 2.0 (Modern SaaS Redesign)  
**Maintained by**: CSP ERP Team
