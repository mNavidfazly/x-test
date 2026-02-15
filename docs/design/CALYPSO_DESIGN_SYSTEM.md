# Calypso Design System -- X-Crude

> Comprehensive design language documentation for the X-Crude crude oil logistics platform by Calypso Commodities. This document captures every visual pattern, spacing value, color, animation, and interaction used across the application.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Brand & Logo](#2-brand--logo)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Layout Architecture](#5-layout-architecture)
6. [Top Header Bar](#6-top-header-bar)
7. [Left Sidebar Navigation](#7-left-sidebar-navigation)
8. [Breadcrumbs / Location Indicator](#8-breadcrumbs--location-indicator)
9. [Page Transitions](#9-page-transitions)
10. [Cards & Containers](#10-cards--containers)
11. [Buttons](#11-buttons)
12. [Form Inputs & Edit Mode](#12-form-inputs--edit-mode)
13. [Dropdowns & Select Components](#13-dropdowns--select-components)
14. [Search Bars](#14-search-bars)
15. [AI Chat Button & Panel](#15-ai-chat-button--panel)
16. [User Menu Dropdown](#16-user-menu-dropdown)
17. [Collapsible Sidebar](#17-collapsible-sidebar)
18. [Content Spacing & Responsive Layout](#18-content-spacing--responsive-layout)
19. [Modals & Overlays](#19-modals--overlays)
20. [Badges & Pills](#20-badges--pills)
21. [Tables](#21-tables)
22. [Animations & Transitions](#22-animations--transitions)
23. [Icons](#23-icons)

---

## 1. Design Philosophy

### Style Classification

The Calypso Design Language combines:

- **Glassmorphism** -- Transparent backgrounds with blur effects on sidebar active states and modals
- **Soft UI** -- Rounded corners (`rounded-xl`), subtle shadows, smooth transitions
- **Data-Dense Dashboard** -- High information density without chaos
- **Trading Terminal (modernized)** -- Semantic colors (green/red), tabular numbers, KPI banners

### Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Information Density with Clarity** | Many data points on screen, structured by whitespace and cards |
| **Color = Meaning** | Every color is semantic, never purely decorative |
| **Progressive Disclosure** | Collapsible sections, hover for details, expandable rows |
| **Numbers as First-Class Citizens** | Always `tabular-nums`, large bold KPIs, color-coded positive/negative |
| **Desktop-First** | Optimized for large screens, functional on mobile |

### Design References

| Reference | What We Take |
|-----------|-------------|
| **Linear** | Card shadows, hover lifts, clean typography |
| **Stripe Dashboard** | Data density, KPI banners |
| **Notion** | Collapsible sections, progressive disclosure |
| **Raycast** | Dark panels, keyboard-first interaction |
| **Bloomberg Terminal** | Color semantics (green/red), modernized |

### Anti-Patterns

- No skeuomorphism (no textures or "real" objects)
- No Material Design (no ripple effects, no FABs)
- No brutalism (no harsh contrasts)
- We USE shadows and depth (not pure flat design)

---

## 2. Brand & Logo

### The "X" Brand Mark

The brand identity is **entirely text-based** -- no image logos exist. The distinctive "X" character is the primary brand mark, always rendered in **italic bold teal**.

### Logo Placements

| Location | Text | X Size | X Color | Glow | Shimmer | Tagline | When Visible |
|----------|------|--------|---------|------|---------|---------|-------------|
| **Sidebar Top (expanded)** | "X-Crude by Calypso" | 20px (`text-xl`) | `teal-300` (#5eead4) | Yes (10s pulse) | Yes (5s sweep) | "by Calypso" (white/70) | Desktop, expanded |
| **Sidebar Top (collapsed)** | "X" | 24px (`text-2xl`) | `teal-300` (#5eead4) | Yes | Yes | None | Desktop, collapsed |
| **Sidebar Bottom** | "X-Crude v0.1.0" | 10px | `teal-400` (#2dd4bf) | No | No | None | Desktop, expanded only |
| **Header Breadcrumb** | "X-Crude / [Page]" | 14px (`text-sm`) | `teal-600` (#0d9488) | No | No | None | Always |
| **Auth Pages (Login, etc.)** | "X-Crude" + tagline | 48px (`text-5xl`) | `teal-400` (#2dd4bf) | No | No | "by Calypso Commodities" | Auth screens |
| **Browser Tab** | Favicon "X" | 28px (SVG) | `teal-600` (#0d9488) | No | No | Title: "X-Crude \| Calypso Commodities" | Always |

### Brand Typography Rules

- The "X" is **always italic**, always **bold (700)**, always **teal**
- "-Crude" is always **non-italic**, same weight, neutral color (white on dark, gray-800 on light)
- The teal shade varies by background: lighter teal (300/400) on dark backgrounds, darker teal (600) on light backgrounds

### Sidebar Logo Gradient

```css
.sidebar-logo-gradient {
  background: linear-gradient(135deg, #14B8A6 0%, #0F766E 100%);
}
```

- Direction: 135 degrees (top-left to bottom-right)
- Start: `#14B8A6` (teal-500)
- End: `#0F766E` (teal-700)
- Height: 56px (`h-14`), matching header height
- Has a shimmer overlay animation (5s sweep)

### X-Glow Animation

```css
@keyframes x-glow {
  0%, 55%, 100% { text-shadow: none; filter: brightness(1); }
  65%  { text-shadow: 0 0 10px rgba(45,212,191,0.4), 0 0 20px rgba(20,184,166,0.2); filter: brightness(1.1); }
  75%  { text-shadow: 0 0 25px rgba(45,212,191,0.9), 0 0 50px rgba(20,184,166,0.6), 0 0 80px rgba(20,184,166,0.3); filter: brightness(1.4); }
  85%  { text-shadow: 0 0 15px rgba(45,212,191,0.5), 0 0 30px rgba(20,184,166,0.3); filter: brightness(1.15); }
}
.x-glow { animation: x-glow 10s ease-in-out infinite; }
```

- 10-second infinite cycle
- Idle for 55%, then pulses to peak brightness at 75%, fades back
- Only applied to the "X" in the sidebar (both states)

---

## 3. Color System

### Primary Brand: Teal

Teal is the signature color. It signals primary actions, active/selected states, focus rings, and brand identity.

```
primary-50:  #f0fdfa    primary-300: #5eead4    primary-600: #0d9488    primary-900: #134e4a
primary-100: #ccfbf1    primary-400: #2dd4bf    primary-700: #0f766e    primary-950: #042f2e
primary-200: #99f6e4    primary-500: #14b8a6    primary-800: #115e59
```

### Semantic Colors

| Meaning | Color Family | Token | Hex | Usage |
|---------|-------------|-------|-----|-------|
| **Positive / Success** | Emerald (Green) | `success-500` | `#10b981` | Valid states, positive values |
| **Negative / Error** | Rose (Red) | `error-500` | `#f43f5e` | Errors, delete actions, negative values |
| **Warning / Attention** | Amber (Orange) | `warning-500` | `#f59e0b` | Deadlines, warnings, pending states |
| **Info / Reference** | Blue | -- | -- | Links, info badges |
| **Long / Buy** | Blue | `long` | `#3b82f6` | Buy-side indicators |
| **Short / Sell** | Purple | `short` | `#a855f7` | Sell-side indicators |

### Neutral Palette

The app uses Tailwind's `slate` palette as the primary neutral:

- **Backgrounds:** `slate-50` (#f8fafc), `slate-100` (#f1f5f9 -- main app bg)
- **Borders:** `slate-200` (#e2e8f0), `slate-300` (#cbd5e1)
- **Muted text:** `slate-400` (#94a3b8), `slate-500` (#64748b)
- **Body text:** `slate-600` (#475569), `slate-700` (#334155)
- **Headings:** `slate-800` (#1e293b), `slate-900` (#0f172a)

### UI Element Color Mapping

| Element | Background | Text | Border |
|---------|-----------|------|--------|
| App background | `slate-100` | -- | -- |
| Cards | `white` | `slate-900` | `slate-200` |
| Header bar | `white` | `gray-800` | `slate-200` (bottom) |
| Sidebar body | `white` | `gray-500` | `slate-200` (right) |
| Sidebar logo area | Teal gradient | `white` | `slate-200` (bottom) |
| Active nav item | Teal gradient (15% opacity) | `teal-700` | `teal` (20% opacity) |
| Form inputs | `white` | `slate-900` | `slate-300` |
| Focus ring | -- | -- | `teal-500` |
| Disabled inputs | `slate-50` | `slate-500` | `slate-200` |
| Error state | -- | `rose-500` | `rose-500` |

---

## 4. Typography

### Font

**Inter** -- loaded via Google Fonts with weights 300, 400, 500, 600, 700.

```css
font-family: 'Inter', system-ui, sans-serif;
```

### Type Scale

| Element | Size | Weight | Color | Extra |
|---------|------|--------|-------|-------|
| Auth page brand | `text-5xl` (48px) | 700 (bold) | teal + white | Italic X |
| Page titles | `text-2xl` (24px) | 700 (bold) | `slate-900` | -- |
| Section headers (cards) | `text-sm` (14px) | 600 (semibold) | `slate-800` | -- |
| Section subtitles | `text-xs` (12px) | 400 | `slate-500` | -- |
| Sidebar section labels | `text-xs` (12px) | 600 (semibold) | `slate-400` | `uppercase tracking-wider` |
| Nav items | `text-sm` (14px) | 500 (medium) | `gray-500` / `teal-700` active | -- |
| Form labels | `text-sm` (14px) | 500 (medium) | `slate-700` | -- |
| Form inputs | `text-sm` (14px) | 400 | `slate-900` | -- |
| Placeholders | `text-sm` (14px) | 400 | `slate-400` | -- |
| Help text | `text-xs` (12px) | 400 | `slate-500` | -- |
| Error messages | `text-xs`-`text-sm` | 400 | `rose-500`/`rose-600` | -- |
| Breadcrumb page name | `text-sm` (14px) | 500 (medium) | `slate-600` | -- |
| Table headers | `text-xs` (12px) | 600 (semibold) | `slate-500` | `uppercase tracking-wider` |
| Table cells | `text-sm` (14px) | 400-500 | `slate-600`-`slate-900` | -- |
| Badge text | `text-xs` (12px) | 500-600 | varies | `rounded-full` pill |
| Version footer | 10px | 400 | `teal-400` / `gray-300` | -- |

### Number Formatting

- **Always `tabular-nums`** for column alignment in tables and numeric inputs
- **KPI numbers**: Large, bold, prominent position
- **Positive values**: Green
- **Negative values**: Red
- **Unknown/TBD**: Orange/amber

---

## 5. Layout Architecture

### Overall Structure

```
h-screen flex (horizontal)
+-- Sidebar (w-64 expanded / w-16 collapsed)
|   +-- Logo area (h-14, teal gradient)
|   +-- Navigation (scrollable)
|   +-- Footer (collapse button + version)
+-- Right Section (flex-1, flex vertical)
    +-- Header (h-14, white, shrink-0)
    +-- Main Content (flex-1, overflow-auto)
        +-- Content wrapper (p-6)
            +-- <router-outlet />
```

### Key Dimensions

| Element | Value | Tailwind |
|---------|-------|----------|
| Viewport | 100vh | `h-screen` |
| Header height | 56px | `h-14` |
| Sidebar expanded | 256px | `w-64` |
| Sidebar collapsed | 64px | `w-16` |
| Content padding | 24px all sides | `p-6` |
| Card section gap | 24px | `space-y-6` |
| Chat panel (default) | 400px | Custom signal |
| Chat panel (min) | 300px | -- |
| Chat panel (max) | 800px | -- |

### Positioning

- **No fixed/sticky elements** -- everything uses flexbox flow
- Sidebar and header are flex children, not fixed positioned
- Main content scrolls independently (`overflow-auto`)
- Chat panel uses `margin-right` on the outer container (animated with `transition-[margin] duration-300`)

---

## 6. Top Header Bar

### Specifications

| Property | Value |
|----------|-------|
| Height | 56px (`h-14`) |
| Background | `white` (#ffffff) |
| Bottom border | 1px solid `slate-200` (#e2e8f0) |
| Shadow | None |
| Gradient | None |
| Horizontal padding | 16px (`px-4`) |
| Layout | `flex items-center justify-between` |
| Position | Static flex child (`shrink-0`) |

### Content Layout

```
[Hamburger (mobile only)] [X-Crude / Page Name]    ...space...    [AI Button] [User Menu]
```

- **Left group**: `flex items-center gap-2` (hamburger + breadcrumbs)
- **Right group**: `flex items-center gap-2` (AI button + user menu)
- Hamburger visible only below `lg` (1024px): `lg:hidden`

---

## 7. Left Sidebar Navigation

### Sidebar Container

| Property | Value |
|----------|-------|
| Background | `white` (#ffffff) |
| Right border | 1px solid `slate-200` (#e2e8f0) |
| Shadow | None |
| Width (expanded) | 256px (`w-64`) |
| Width (collapsed) | 64px (`w-16`) |
| Position | Static flex child |

### Navigation Structure

```
Logo Area (h-14, teal gradient + shimmer)
-------------------------------------
Dashboard                    (standalone link)
--- gap (mb-4) ---
BASE DATA (section header)
  Contracts
  Fleet
  Locations
  Export Configs
--- gap (mb-4) ---
PORTFOLIO (section header)
  Portfolios
--- gap (mb-4) ---
ADMIN (section header, admin-only)
  Users
-------------------------------------
Footer (collapse button + version)
```

### Nav Item Styling

**Base classes:**
```
sidebar-nav-item flex items-center gap-3 py-2.5 px-3 rounded-xl
text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium text-sm
```

**Transition:** `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`

### Three States

| State | Background | Text | Border | Backdrop | Shadow | Animation |
|-------|-----------|------|--------|----------|--------|-----------|
| **Default** | transparent | `gray-500` | none | none | none | none |
| **Hover** | `rgba(0,0,0,0.04)` | `gray-700` | none | none | none | none |
| **Active** | Teal gradient (10-15% opacity) | `teal-700` | 1px `teal` (20% opacity) | `blur(8px)` | Teal glow + white inset | 5s shimmer sweep |

### Active State (Glassmorphism) Detail

```css
.sidebar-item-active {
  background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(15,118,110,0.1));
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(20,184,166,0.15), inset 0 1px 0 rgba(255,255,255,0.5);
  border: 1px solid rgba(20,184,166,0.2);
  color: rgb(15,118,110);
}
```

Plus a `::before` pseudo-element shimmer overlay (5s infinite sweep of translucent white).

### Section Headers

| State | Display |
|-------|---------|
| Expanded | `text-xs font-semibold text-slate-400 uppercase tracking-wider` with `px-6 py-2` |
| Collapsed | Thin divider line: `mx-3 my-2 border-t border-slate-200` |

### Collapsed Mode

- Icons only (20x20 Lucide icons), centered
- Tooltips via `title` attribute on hover
- Logo shows only "X" (24px)
- Section headers become divider lines
- Footer shows only collapse icon, no version text

---

## 8. Breadcrumbs / Location Indicator

### Format

```
X-Crude / [Section Name]
```

This is a **flat, single-depth** location indicator -- NOT a multi-level breadcrumb.

### Typography

| Segment | Style |
|---------|-------|
| "X" | `text-sm font-semibold text-teal-600 italic` |
| "-Crude" | `text-sm font-semibold text-gray-800` |
| Separator "/" | `text-slate-400` with `gap-2` (8px) spacing |
| Page name | `text-sm font-medium text-slate-600` |

### Route Mapping

| URL Pattern | Displayed Name |
|-------------|---------------|
| `/dashboard` | Dashboard |
| `/contracts` (and sub-routes) | Contracts |
| `/fleet` (and sub-routes) | Fleet |
| `/locations` (and sub-routes) | Locations |
| `/export-vessel-configs` (and sub-routes) | Export Configs |
| `/portfolios` (and sub-routes) | Portfolios |
| `/admin/users` | Users |

### Behavior

- **Not clickable** -- purely visual indicator (plain `<span>` elements)
- Uses prefix matching: `/contracts/abc/edit` resolves to "Contracts"
- No entity-specific names shown (never "Contract: Brent Q2")
- Hidden when on unrecognized routes
- Hardcoded map in `HeaderComponent` -- no route `data` metadata used

---

## 9. Page Transitions

### CSS-Only Slide-Up Animation

```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter { animation: page-enter 0.3s ease-out; }
```

| Parameter | Value |
|-----------|-------|
| Type | Slide up + fade in |
| Duration | 300ms |
| Easing | `ease-out` |
| Displacement | 20px upward |
| Opacity | 0 to 1 |

### How It Works

- Every routed page has `.page-enter` on its root `<div>`
- No `@angular/animations` used -- pure CSS
- New component DOM creation triggers the animation automatically
- **No exit animation** -- old pages are removed instantly
- Applied to all 19 page components

### Template Pattern

```html
<div class="space-y-6 page-enter">
  <!-- Page content -->
</div>
```

---

## 10. Cards & Containers

### Card Variants

| Class | Background | Border | Radius | Shadow (rest) | Shadow (hover) | Glass |
|-------|-----------|--------|--------|---------------|----------------|-------|
| **`form-card`** | `white` | `slate-200` | `rounded-xl` (12px) | `shadow-sm` | `shadow-md` | No |
| **`card-solid`** | `white` | `slate-200` | `rounded-xl` | `shadow-sm` | `shadow-md` + teal border | No |
| **`card-glass`** | `rgba(255,255,255,0.85)` | `rgba(255,255,255,0.3)` | `rounded-xl` | `shadow-lg` | -- | Yes (`blur-12px`) |
| **`card-dark`** | Gradient `slate-800->900` | `slate-700` | `rounded-xl` | `shadow-lg` | -- | No |
| **`glass-panel`** | `rgba(255,255,255,0.98)` | None | `rounded-xl` | `shadow-2xl` | -- | Yes (`blur-16px`) |
| **`table-container`** | `white` | `slate-100` | `rounded-2xl` (16px) | `shadow-lg` | `shadow-xl` | No |

### `form-card` (Primary Card -- 35+ Usages)

```css
.form-card {
  @apply bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden
         transition-all duration-200 hover:shadow-md;
}
.form-card:focus-within {
  border-color: #5eead4; /* teal-300 */
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.08);
}
```

**Key behaviors:**
- Hover: shadow deepens from `shadow-sm` to `shadow-md`
- Focus-within: entire card gets teal-300 border + 4px teal glow ring when any child input is focused
- `overflow-hidden` clips gradient headers

### Card Section Headers

**With icon (form pages):**
```css
.form-section-icon-header {
  @apply flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}
```
- 40x40 rounded icon container (`bg-slate-100 rounded-xl`)
- Title: `text-sm font-semibold text-slate-800`
- Subtitle: `text-xs text-slate-500`

**Without icon (detail pages):**
```css
.form-section-header {
  @apply px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}
```

### How Cards Float

Cards float via **shadow + background contrast**, NOT via position or transform:
- White cards on `bg-slate-100` (light gray) background
- Content wrapper has `p-6` (24px) padding creating space around cards
- Cards stack with `space-y-6` (24px) vertical gaps
- No `hover:scale` or `hover:-translate-y` on cards

### Custom Tailwind Shadows

```javascript
boxShadow: {
  soft:  '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  glass: '0 8px 32px rgba(0,0,0,0.08)',
  lift:  '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
}
```

---

## 11. Buttons

### Button System Architecture

All buttons compose from a shared `.btn-base` class:

```css
.btn-base {
  @apply inline-flex items-center justify-center gap-2
         rounded-lg font-medium transition-all duration-200
         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95;
}
```

### Button Variants

| Variant | Background | Text | Border | Shadow | Hover |
|---------|-----------|------|--------|--------|-------|
| **`.btn-primary`** | `teal-600` | white | transparent | `shadow-md` | `teal-700`, `shadow-lg`, `border-teal-400` |
| **`.btn-secondary`** | white | `slate-700` | `slate-300` | `shadow-sm` | `slate-50`, `border-teal-400`, `shadow-md` |
| **`.btn-ghost`** | transparent | `slate-600` | none | none | `bg-slate-100`, `text-slate-900` |
| **`.btn-accent`** | Slate gradient (#475569->#334155) | white | transparent | Strong slate glow | Darker gradient, `translateY(-1px)` |
| **`.btn-danger`** | `rose-50` | `rose-700` | `rose-200` | `shadow-sm` | `rose-100`, `border-rose-400` |
| **`.btn-warning`** | `amber-600` | white | transparent | `shadow-md` | `amber-700`, `shadow-lg` |

### Button Sizes

| Size | Padding | Font |
|------|---------|------|
| Default | `px-4 py-2` (16px/8px) | `text-sm` (14px) |
| Small (`.btn-sm`) | `px-3 py-1.5` (12px/6px) | `text-xs` (12px) |

### Icon-Only Buttons

```css
.btn-icon        { @apply btn-base p-2 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700; }
.btn-icon-danger { @apply btn-base p-2 bg-transparent text-rose-500 hover:bg-rose-50 hover:text-rose-700; }
```

### Inline Table Action Buttons (Ad-hoc)

```html
<button class="p-1 hover:bg-slate-200 rounded text-slate-600">  <!-- Edit -->
<button class="p-1 hover:bg-red-100 rounded text-red-600">      <!-- Delete -->
<button class="p-1 hover:bg-teal-100 rounded text-teal-600">    <!-- Sync -->
```

### Detail Page Toolbar Buttons (Ad-hoc)

```html
<!-- Standard -->
class="flex items-center gap-1 sm:gap-2 rounded-lg border border-slate-300 bg-white px-2 sm:px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"

<!-- Danger -->
class="... border-rose-300 text-rose-700 hover:bg-rose-50"

<!-- Teal accent -->
class="... border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
```

Responsive: `<span class="hidden sm:inline">` hides text on mobile (icon-only).

### Special Buttons

| Button | Style |
|--------|-------|
| **Login** | Teal gradient (`135deg, #14b8a6 -> #0d9488`), `translateY(-1px)` on hover, teal glow shadow |
| **Save and Optimise** | `bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5` |
| **Back navigation** | Ghost style: `text-slate-600 hover:text-slate-900` with arrow icon |
| **Pagination** | `rounded-lg border-slate-200 bg-white shadow-sm hover:border-teal-400` |

### Icon Placement

All buttons use **left icon + text** pattern with `gap-2` (8px):
```html
<lucide-icon [img]="PlusIcon" class="w-4 h-4"></lucide-icon>
Add Contract
```

---

## 12. Form Inputs & Edit Mode

### Standard Input Field

```css
/* Inline Tailwind (used in all forms): */
class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
       focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
```

| Property | Default | Focus (The Teal Highlight) |
|----------|---------|---------------------------|
| Border | 1px `slate-300` (#cbd5e1) | `teal-500` (#14b8a6) |
| Ring | None | 1px `teal-500` |
| Outline | Default | Removed |
| Background | `white` | No change |
| Border radius | `rounded-lg` (8px) | No change |
| Padding | `px-3 py-2` (12px/8px) | No change |
| Transition | `transition-colors duration-200` | Smooth 200ms |

### Global CSS Variants

```css
/* Standard input */
.input-field { ... focus:ring-1 focus:ring-teal-500 focus:border-teal-500 ... }

/* Enhanced input (gradient background) */
.input-enhanced { ... bg-gradient-to-b from-white to-slate-50/50 ... focus:ring-2 focus:ring-teal-500/20 focus:shadow-md ... }
```

### Labels

```html
<label class="block text-sm font-medium text-slate-700 mb-1">
  Field Name <span class="text-rose-500">*</span>
</label>
```

- Position: Block, ABOVE the input (not floating)
- Gap below label: `mb-1` (4px)
- Required asterisk: `text-rose-500`

### Input Types

| Type | Specifics |
|------|----------|
| **Text** | Standard styling above |
| **Number** | Add `tabular-nums`, right-aligned unit suffix (`absolute right-3`, `text-slate-500`) with extra right padding (`pr-12`-`pr-16`) |
| **Date** | Browser-native picker, same styling as text |
| **Textarea** | Same styling, `rows="2"` default |
| **Checkbox** | `h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500` (teal fill when checked) |
| **Readonly** | `bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200` |

### Validation Error State

```html
<!-- Border turns rose -->
[class.border-rose-500]="field?.invalid && field?.touched"

<!-- Error message below -->
<p class="mt-1 text-xs text-rose-500">Field is required</p>
```

### Inline Editing (Tables/Expandable Rows)

| Context | Padding | Radius | Focus Ring |
|---------|---------|--------|------------|
| **Full forms** | `px-3 py-2` | `rounded-lg` | `ring-1 ring-teal-500` |
| **Expanded row edits** | `px-3 py-2` | `rounded-lg` | `ring-2 ring-teal-500` |
| **Compact table edits** | `px-2 py-1.5` | `rounded` | `ring-1 ring-teal-500` |
| **Cargo inline edits** | `px-2 py-1` | `rounded` | None (simpler) |
| **Discharge section add/edit rows** | `px-2 py-1` | `rounded` | `ring-1 ring-teal-500` |

Active edit rows use `bg-teal-50` background to indicate edit mode.

### Login Form (Dark Theme Variant)

```css
/* Default */
background: rgba(15, 23, 42, 0.8);
border: 1px solid rgba(100, 116, 139, 0.4);

/* Focus (signal-driven) */
border: 2px solid #14b8a6;
box-shadow: 0 0 0 3px rgba(20,184,166,0.15), 0 0 15px rgba(20,184,166,0.1);
```

Larger padding (`px-4 py-3`), white text, prominent teal glow on focus.

### Form Layout

```html
<form class="space-y-6">
  <div class="form-card">
    <div class="form-section-icon-header">...</div>
    <div class="p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Fields -->
      </div>
    </div>
  </div>
</form>
```

- Cards separated by `space-y-6` (24px)
- Fields in responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Internal card padding: `p-6` (24px)
- Nested sections divided by `mt-6 pt-6 border-t border-slate-200`

---

## 13. Dropdowns & Select Components

### Custom Select Dropdown (`SelectDropdownComponent`)

A custom-built dropdown (NOT native `<select>`) using a DOM portal.

**Trigger:**
```html
<button class="btn-secondary w-full justify-between min-w-[140px]">
  <span>{{ selectedLabel() }}</span>
  <lucide-icon [img]="ChevronDownIcon" class="w-4 h-4 text-slate-400 transition-transform duration-200"
    [class.rotate-180]="isOpen()">
  </lucide-icon>
</button>
```

- Uses `btn-secondary` styling (white bg, slate border)
- Chevron rotates 180 degrees when open
- Placeholder text: `text-slate-400`, selected value: `text-slate-700`

**Dropdown panel:**
- Rendered on `document.body` as a portal (z-index 99999)
- Container: `bg-white border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto`
- Selected option: `bg-slate-100 text-slate-900 font-medium` + teal check icon
- Unselected: `text-slate-700 hover:bg-slate-50`
- Empty state: `text-slate-400 italic` "No options available"
- Smart positioning: opens upward if insufficient viewport space below

### Native Select (Used in Compact Contexts)

```html
<select class="w-full px-2 py-1.5 text-sm border border-slate-300 rounded
               focus:ring-1 focus:ring-teal-500 focus:border-teal-500">
```

Used in cargo manager and event manager inline edits.

---

## 14. Search Bars

### List Page Search

```html
<div class="relative flex-1 max-w-md">
  <lucide-icon [img]="SearchIcon"
    class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
  </lucide-icon>
  <input type="text"
    class="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm
           text-slate-900 placeholder:text-slate-400
           focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500" />
</div>
```

| Property | Value |
|----------|-------|
| Icon | Lucide `Search`, 16px, `slate-400`, left-positioned |
| Max width | `max-w-md` (448px) |
| Left padding | `pl-10` (40px, to clear icon) |
| Border | `border-slate-300`, focus `border-teal-500` |
| Background | `bg-white` |
| Focus ring | `ring-1 ring-teal-500` |
| Clear button | None |

### Modal Search (Simpler)

```html
<input type="text" class="w-full px-3 py-2 border rounded-lg
       focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
```

- No search icon
- Thicker focus ring (`ring-2`)
- Wrapped in `p-4 border-b` section

### Behavior

- **No debounce** -- filtering happens immediately on every keystroke
- List pages: re-query API (Supabase) on each change
- Modal searches: client-side filtering via computed signals

---

## 15. AI Chat Button & Panel

### Header AI Button

The AI chat button is inline in the header (no floating FAB):

```css
.ai-header-button {
  @apply px-3 py-1.5 rounded-xl flex items-center gap-1.5
         transition-all font-semibold text-sm;
}
.ai-header-button:not(.active) {
  @apply bg-gray-100 text-gray-600 hover:bg-gray-200;
}
.ai-header-button.active {
  @apply text-white shadow-lg;
  background: linear-gradient(135deg, #14B8A6, #0F766E);
  box-shadow: 0 4px 14px rgba(15, 118, 110, 0.35);
}
```

| State | Background | Text | Shadow |
|-------|-----------|------|--------|
| Inactive | `gray-100` | `gray-600` | None |
| Active | Teal gradient | White | Teal glow |

- Shape: `rounded-xl` (12px), pill-like
- Icon: Lucide `Sparkles` (16px)
- Content: icon + "AI" text
- Toggle: `Cmd/Ctrl + K`
- Position: Header right side, left of user menu

### Chat Panel

- Width: 400px default (300-800px resizable)
- On desktop: pushes content via `margin-right`
- On mobile (<768px): full-screen overlay
- Header has `.ai-header-gradient` with shimmer animation

---

## 16. User Menu Dropdown

### Trigger Button

```html
<button class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
```

| Element | Style |
|---------|-------|
| Container | `rounded-full bg-slate-100 hover:bg-slate-200` |
| Name | `text-sm text-slate-700` (hidden on mobile: `hidden sm:flex`) |
| Role | `text-xs text-slate-500 capitalize` |
| Separator | centered dot (`·`) in `text-slate-400` |
| Avatar | 32px circle, `bg-violet-500`, white User icon |
| Chevron | 16px, `text-slate-500` |

### Dropdown Panel

| Property | Value |
|----------|-------|
| Trigger | Click to toggle (not hover) |
| Position | `absolute right-0 top-full mt-2` |
| Width | 224px (`w-56`) |
| Background | `white` |
| Border | `border-slate-200` |
| Radius | `rounded-lg` (8px) |
| Shadow | `shadow-lg` |
| Z-index | 50 |
| Animation | None (instant show/hide) |
| Backdrop | Transparent fullscreen at z-40 for click-away |

### Menu Items

| Section | Items | Text Color |
|---------|-------|-----------|
| Header | Email + role | `slate-700` / `slate-500` |
| Actions | Profile, Settings (placeholder) | `slate-600`, hover `slate-900` |
| Sign Out | Logout button | `rose-600`, hover `rose-700` bg `rose-50` |

---

## 17. Collapsible Sidebar

### Toggle Mechanism

| Trigger | Location | Visibility |
|---------|----------|-----------|
| Footer chevron button | Sidebar bottom | Desktop only (`lg:flex`) |
| Hamburger menu icon | Header left | Mobile/tablet only (`lg:hidden`) |
| Keyboard shortcut | `Cmd/Ctrl + B` | Desktop only (>= 768px) |

### Desktop Collapse

| Property | Expanded | Collapsed |
|----------|----------|-----------|
| Width | 256px (`w-64`) | 64px (`w-16`) |
| Nav items | Icon + label | Icon only (centered, with `title` tooltip) |
| Section headers | Uppercase text labels | Thin divider lines |
| Logo | "X-Crude by Calypso" | Just "X" (24px) |
| Footer | "Collapse" + chevron | Chevron icon only |
| Version text | Visible | Hidden |

- Animation: `transition-[width] duration-300`
- Content area adjusts automatically via flexbox `flex-1`

### Mobile Overlay

| Property | Value |
|----------|-------|
| Sidebar | `fixed inset-y-0 left-0 z-50`, always 256px wide |
| Backdrop | `fixed inset-0 bg-black/50 z-40` |
| Animation | `transition-transform duration-300` (slide from `-translate-x-full`) |
| Auto-close | On any nav item click |
| Header | Shows "Navigation" title + X close button |

### State Persistence

- Saved to `localStorage` key `"sidebar-collapsed"`
- Restored on service initialization
- Defaults to expanded if no saved state

### Section Headers (NOT Collapsible)

Section headers (Base Data, Portfolio, Admin) are **always expanded** -- there are no per-section collapse/expand toggles or chevrons. They are static labels only.

---

## 18. Content Spacing & Responsive Layout

### Desktop Content Area

```
+-----------------------------------------------+
| Header (h-14 = 56px)                          |
+-----------------------------------------------+
|  +------------------------------------------+ |
|  |                                          | | <-- p-6 (24px)
|  |  Card 1 (form-card)                      | |
|  |                                          | |
|  +------------------------------------------+ | <-- space-y-6 (24px)
|  |                                          | |
|  |  Card 2 (form-card)                      | |
|  |                                          | |
|  +------------------------------------------+ |
|                                               | <-- p-6 (24px)
+-----------------------------------------------+
```

| Spacing | Value | Tailwind |
|---------|-------|----------|
| Content wrapper padding | 24px all sides | `p-6` |
| Section gap (vertical) | 24px | `space-y-6` |
| Card body padding | 24px | `p-6` |
| Card section header | 24px H / 16px V | `px-6 py-4` |
| Form grid gap | 24px | `gap-6` |
| Dashboard welcome padding | 32px | `p-8 mb-8` |

### No Max-Width

Content has **no max-width constraint** -- it stretches to fill all available width. Only search inputs (`max-w-md`), modals (`max-w-2xl`/`max-w-lg`), and login forms (`max-w-md`) have max-width.

### Responsive Breakpoints

| Breakpoint | Tailwind | Behavior |
|-----------|----------|----------|
| < 640px (`sm`) | -- | User menu hides name/role text |
| < 768px (`md`) | -- | Chat panel goes full-screen, sidebar closes by default |
| < 1024px (`lg`) | -- | Hamburger shows, collapse button hides, sidebar becomes overlay |
| >= 1024px | -- | Full desktop layout |

### Mobile Adjustments

- Content padding stays `p-6` (24px) on all screen sizes -- **no responsive change**
- Toolbar buttons: `px-2 sm:px-3`, text hidden on mobile (`hidden sm:inline`)
- Form grids collapse: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Chat panel: Full-screen overlay below 768px
- Sidebar: Slide-in overlay below 1024px

---

## 19. Modals & Overlays

### Modal Architecture

```html
<!-- Backdrop -->
<div class="modal-backdrop">
  <!-- Panel -->
  <div class="glass-panel max-w-2xl w-full max-h-[85vh]">
    <!-- Header (teal gradient) -->
    <div class="modal-header-gradient">
      <div class="modal-shimmer absolute inset-0 pointer-events-none"></div>
      <h2 class="text-lg font-semibold text-white">Title</h2>
      <button class="p-1 hover:bg-white/10 text-white/70 rounded">X</button>
    </div>
    <!-- Body -->
    <div class="p-6 overflow-y-auto">...</div>
    <!-- Footer -->
    <div class="flex justify-end gap-3 px-6 py-4 border-t bg-gradient-to-r from-slate-50/50 to-white">
      <button class="btn-ghost">Cancel</button>
      <button class="btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

### Glass Panel

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  @apply rounded-xl shadow-2xl;
}
```

### Modal Header Gradient

```css
.modal-header-gradient {
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #0d9488 100%);
}
```

With a 5-second shimmer animation overlay.

### Modal Sizes

| Modal | Max Width |
|-------|-----------|
| Share dialog | `max-w-lg` (512px) |
| Validation checklist | `max-w-2xl` (672px) |
| Select modals (vessel, contract) | `max-w-2xl` (672px) |
| Sync diff preview | `max-w-2xl` (672px) |
| Warning modals | `max-w-md` (448px) |
| Confirmation dialog | `max-w-md` (448px) |

---

## 20. Badges & Pills

### Badge Variants

| Tone | Background | Text | Usage |
|------|-----------|------|-------|
| **Neutral** | `slate-100` | `slate-700` | Default info |
| **Success** | `emerald-100` | `emerald-700` | Valid, done, profit |
| **Warning** | `amber-100` | `amber-700` | Pending, attention |
| **Error** | `rose-100` | `rose-700` | Invalid, loss, urgent |
| **Primary** | `teal-100` | `teal-700` | Highlighted, best |
| **Info** | `blue-100` | `blue-700` | Links, references |

### Style

- Shape: `rounded-full` (pill)
- Size: `text-xs font-medium px-2 py-0.5`
- Some use `uppercase` for status badges

---

## 21. Tables

### Data Table Container

```css
.table-container {
  @apply overflow-hidden rounded-2xl bg-white shadow-lg border border-slate-100
         transition-shadow duration-200;
}
.table-container:hover { @apply shadow-xl; }
```

### Table Header

```css
.table-header-row {
  @apply bg-gradient-to-r from-slate-50 to-white;
}
.table-header-cell {
  @apply px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider;
}
```

### Table Rows

```css
.table-row {
  @apply border-t border-slate-100 hover:bg-slate-50 transition-colors duration-150;
}
.table-cell {
  @apply px-4 py-3.5 text-sm text-slate-600;
}
```

### Expandable Rows

```css
.expand-panel {
  @apply bg-slate-50/80 border-t border-slate-100;
}
```

---

## 22. Animations & Transitions

### Animation Reference

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| **Page enter** | 300ms | `ease-out` | All page components (slide up 20px + fade) |
| **Nav item transitions** | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Sidebar hover/active |
| **Sidebar collapse** | 300ms | default | Width transition (desktop) |
| **Sidebar slide** | 300ms | default | Mobile overlay slide |
| **Chat margin** | 300ms | `ease-in-out` | Content push when chat opens |
| **Shimmer sweep** | 5s | `ease-in-out` infinite | Modal headers, sidebar logo, active nav item |
| **X-glow pulse** | 10s | `ease-in-out` infinite | Sidebar "X" character |
| **Toast slide-in** | 200ms | `ease-out` | Notification from right |
| **Button press** | -- | -- | `active:scale-95` |
| **Button hover lift** | -- | -- | `hover:-translate-y-0.5` (accent, login) |
| **Card hover shadow** | 200ms | `transition-all` | Shadow deepens on hover |
| **Focus ring** | 200ms | `transition-colors` | Teal ring on input focus |
| **Sparkle float** | 3s | `ease-in-out` infinite | Chat empty state icon |

### Transition Defaults

```css
/* Most UI elements */
transition-all duration-200

/* Sidebar width */
transition-[width] duration-300

/* Layout margin (chat) */
transition-[margin] duration-300 ease-in-out
```

---

## 23. Icons

### Library

**Lucide Angular** (`lucide-angular`)

### Common Icons

| Icon | Usage |
|------|-------|
| `FileText` | Contracts |
| `Ship` | Fleet/Vessels |
| `MapPin` | Locations |
| `Settings` | Export Configs |
| `Folder` | Portfolios |
| `Users` | Admin |
| `LayoutDashboard` | Dashboard |
| `Search` | Search bars |
| `Plus` | Add/Create actions |
| `Pencil` / `PenSquare` | Edit |
| `Trash2` | Delete |
| `ChevronDown/Up/Left/Right` | Expand/collapse, navigation |
| `ArrowLeft` | Back navigation |
| `X` | Close/cancel |
| `Share2` | Sharing |
| `History` | Version history |
| `Copy` | Copy/duplicate |
| `Download/Upload` | Sync into/from |
| `ClipboardCheck` | Validation |
| `Sparkles` | AI chat |
| `User` | User avatar |
| `LogOut` | Sign out |
| `Menu` | Hamburger menu |
| `AlertTriangle` | Warnings |
| `Check` | Success/confirmed |
| `RefreshCw` | Refresh/sync |

### Icon Sizing

| Context | Size |
|---------|------|
| Nav items | `w-5 h-5` (20px) |
| Buttons | `w-4 h-4` (16px) |
| Inline table actions | `[size]="16"` |
| Header hamburger | `w-6 h-6` (24px) |
| Form section headers | `w-5 h-5` in 40x40 container |

---

## File Reference

| File | What It Defines |
|------|----------------|
| `frontend/src/styles.css` | All global CSS classes (cards, buttons, inputs, animations, sidebar styles) |
| `frontend/tailwind.config.js` | Custom colors (primary/teal), shadows, fonts, backdrop blur |
| `frontend/src/app/layout/sidebar/` | Sidebar component (nav structure, collapse, states) |
| `frontend/src/app/layout/header/` | Header component (breadcrumbs, AI button, hamburger) |
| `frontend/src/app/layout/user-menu/` | User menu dropdown |
| `frontend/src/app/layout/layout-shell/` | Main layout orchestrator (flex layout, chat panel margin) |
| `frontend/src/app/shared/components/select-dropdown/` | Custom dropdown component |
| `frontend/src/app/shared/components/data-table/` | Reusable data table |
| `frontend/src/app/features/chat/` | Chat panel, chat button, message components |
