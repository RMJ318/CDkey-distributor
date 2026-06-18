---
name: Violet Protocol
colors:
  surface: '#f9f9ff'
  surface-dim: '#d4daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e8eeff'
  surface-container-high: '#e3e8f9'
  surface-container-highest: '#dde2f3'
  on-surface: '#161c27'
  on-surface-variant: '#444653'
  inverse-surface: '#2a303d'
  inverse-on-surface: '#ecf0ff'
  outline: '#757684'
  outline-variant: '#c5c5d5'
  surface-tint: '#3c55bf'
  primary: '#3953bd'
  on-primary: '#ffffff'
  primary-container: '#546cd7'
  on-primary-container: '#fffbff'
  inverse-primary: '#b9c3ff'
  secondary: '#754aa1'
  on-secondary: '#ffffff'
  secondary-container: '#ce9ffd'
  on-secondary-container: '#5a3086'
  tertiary: '#835100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a56600'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b9c3ff'
  on-primary-fixed: '#001356'
  on-primary-fixed-variant: '#1f3ba6'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#dcb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#5c3187'
  tertiary-fixed: '#ffddb9'
  tertiary-fixed-dim: '#ffb964'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#663e00'
  background: '#f9f9ff'
  on-background: '#161c27'
  surface-variant: '#dde2f3'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  cdkey-display:
    fontFamily: Courier Prime
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  container-max: 1280px
---

## Brand & Style

The design system is centered on the concept of high-velocity digital distribution. It targets a professional audience of resellers, developers, and enterprise managers who require a high-density, data-driven environment that remains visually engaging. 

The aesthetic is a hybrid of **Corporate Modern** and **Glassmorphism**. It utilizes the requested purple gradient (#667eea to #764ba2) not just as a decorative element, but as a functional indicator of "active" states and primary actions. The UI must evoke a sense of precision and security, balancing the vibrancy of the gradients with a strict, high-contrast workspace to ensure maximum legibility for long-form data management.

## Colors

The palette is anchored by a sophisticated purple-to-violet linear gradient used for primary calls-to-action, progress bars, and header highlights. 

- **Primary:** The signature gradient represents the flow of data and successful transactions.
- **Surface & Background:** A light-mode default using a cool-gray background (#f7fafc) ensures that the white rounded cards pop with clarity.
- **Status Colors:** Success, Danger, and Warning colors are highly saturated to ensure they are immediately distinguishable against the neutral canvas. 
- **Contrast:** Text is rendered in deep charcoal (#1a202c) to maintain high accessibility standards against light surfaces.

## Typography

The typography system prioritizes clarity and a technical edge. 

- **Primary Typeface:** **Hanken Grotesk** is used for all UI elements, offering a sharp, contemporary feel that remains legible in high-density tables.
- **Specialized Typeface:** **Courier Prime** (a modern alternative to Courier New) is reserved exclusively for CDKey strings, serial numbers, and monospaced data. This distinction ensures users can immediately identify sensitive key data.
- **Scale:** Headlines use a tight letter-spacing for a "tech-editorial" look. Labels are small, bold, and uppercase to act as clear signposts for data categories.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy for dashboard views to maintain data alignment, transitioning to a fluid model for mobile browsers.

- **Grid:** A 12-column grid with 24px gutters is the standard for desktop. 
- **Rhythm:** Spacing follows an 8px base unit. 
- **Responsive Behavior:** 
    - **Desktop (1024px+):** Sidebar navigation (240px) with a centered fluid-width content container.
    - **Tablet (768px - 1023px):** Sidebar collapses to icons; margins reduce to 16px.
    - **Mobile (<768px):** Single-column stack; horizontal scrolling enabled specifically for data tables to preserve CDKey legibility.

## Elevation & Depth

Hierarchy is established through a combination of subtle depth and color-blocking:

- **Surface Tiers:** Background is the lowest level. Cards sit on Level 1. Modals and dropdowns sit on Level 2.
- **Shadows:** Use a "soft-tech" shadow profile. Instead of pure black, use a low-opacity tint of the primary color: `0px 10px 15px -3px rgba(118, 75, 162, 0.1), 0px 4px 6px -2px rgba(118, 75, 162, 0.05)`.
- **Active State:** The primary gradient is used to "lift" elements visually without adding height, creating a focal point through color intensity.

## Shapes

The design system utilizes a "Rounded" shape language to soften the technical nature of the software.

- **Cards:** Use a standard 16px (`rounded-xl`) corner radius to create a distinct containerized look.
- **Buttons & Inputs:** Use an 8px (`rounded-md`) radius for a professional, sturdy appearance.
- **Status Tags:** Use a fully pill-shaped (`rounded-full`) radius to differentiate them from interactive buttons.

## Components

### Buttons
- **Primary:** Background is the #667eea to #764ba2 gradient. White text. Subtle hover lift (2px translateY).
- **Secondary:** White background with a 1px border using #667eea. Text uses the primary color.
- **Danger/Success:** Solid fills using the respective status colors with white text.

### CDKey Cards
- Essential for this system. These feature a light-gray monospaced background block for the key itself, using **Courier Prime**.
- Includes a "Click to Copy" icon button on the right-hand side.

### Data Tables
- Clean, no vertical borders. 
- Header row uses `label-sm` typography with a subtle bottom border.
- Alternating row highlights (zebra striping) using a 2% opacity of the primary color.

### Status Chips
- Small, pill-shaped indicators.
- Use a "Soft Fill" style: 10% opacity of the status color for the background, and 100% opacity for the text.

### Input Fields
- 8px rounded corners.
- 1px border (#e2e8f0). 
- On focus, the border transitions to #667eea with a 3px soft outer glow.