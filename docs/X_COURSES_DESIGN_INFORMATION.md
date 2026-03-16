# X-Courses Design System

Complete reference for the X-Courses visual design system — colors, typography, components, animations, layout patterns, and usage conventions.

---

## Table of Contents

1. [Design Tokens (CSS Custom Properties)](#1-design-tokens)
2. [Typography & Font Setup](#2-typography--font-setup)
3. [Color Palette](#3-color-palette)
4. [Tailwind Configuration](#4-tailwind-configuration)
5. [CSS @apply Class Inventory](#5-css-apply-class-inventory)
6. [Shared Angular Components](#6-shared-angular-components)
7. [Layout Shell](#7-layout-shell)
8. [Page Entry Animations](#8-page-entry-animations)
9. [Icon System (Lucide)](#9-icon-system-lucide)
10. [Card Patterns](#10-card-patterns)
11. [Modal & Dialog System](#11-modal--dialog-system)
12. [Toast Notification System](#12-toast-notification-system)
13. [Auth Pages (Dark Theme)](#13-auth-pages-dark-theme)
14. [Responsive & Mobile Patterns](#14-responsive--mobile-patterns)
15. [Accessibility](#15-accessibility)
16. [XP Levels & Gamification UI](#16-xp-levels--gamification-ui)
17. [Critical Rules & Anti-Patterns](#17-critical-rules--anti-patterns)

---

## 1. Design Tokens

Defined in `:root` at the top of `frontend/src/styles.scss`:

```css
:root {
  /* Brand Colors (reference — Tailwind classes used in practice) */
  --color-primary: theme('colors.teal.600');
  --color-primary-hover: theme('colors.teal.700');
  --color-primary-ring: theme('colors.teal.500');
  --color-primary-light: theme('colors.teal.100');
  --color-danger: theme('colors.rose.600');
  --color-danger-light: theme('colors.rose.100');

  /* Custom Shadows */
  --shadow-soft: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.08);
  --shadow-lift: 0 10px 25px rgba(0, 0, 0, 0.1);

  /* Z-index Scale (prevents collisions) */
  --z-sidebar: 10;
  --z-header: 20;
  --z-overlay: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-toast: 60;
  --z-tooltip: 70;

  /* Transition Presets */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

---

## 2. Typography & Font Setup

**Font:** Inter (Google Fonts), 4 weights: 400, 500, 600, 700.

Loaded in `frontend/src/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=optional"
      rel="stylesheet">
```

- **`display=optional`** prevents FOIT/FOUT — falls back silently if font doesn't load in time
- **`tabular-nums`** applied globally on `body` via `@layer base` — all numbers are monospaced
- Tailwind alias: `font-sans` maps to `Inter, system-ui, sans-serif` (see Tailwind config)

**Text tokens:**

```css
.section-label { @apply text-xs font-semibold uppercase tracking-wide text-slate-500; }
.page-title    { @apply text-2xl font-bold text-slate-900; }
```

---

## 3. Color Palette

### Primary (Teal)

| Token | Usage |
|-------|-------|
| `teal-600` | Buttons, links, active states, mini-player progress, icon highlights |
| `teal-700` | Hover states, sidebar gradient end, modal header gradient |
| `teal-500` | Focus rings, progress fills, active borders, sidebar gradient start |
| `teal-400` | Auth brand "X" letter, auth-btn gradient start |
| `teal-100` | Primary badge bg, level badge bg, avatar fallback bg |

### Semantic Colors

| Category | Background | Text | Border |
|----------|-----------|------|--------|
| **Success** (Emerald) | `emerald-100` / `emerald-50` | `emerald-700` | `emerald-200` |
| **Error** (Rose) | `rose-100` / `rose-50` | `rose-700` | `rose-200` |
| **Warning** (Amber) | `amber-100` / `amber-50` | `amber-700` | `amber-200` |
| **Info** (Blue) | `blue-100` / `blue-50` | `blue-700` | `blue-200` |
| **Neutral** (Slate) | `slate-100` | `slate-600` | `slate-200` |
| **Purple** | `purple-100` | `purple-700` | — |

### Neutral (Slate) Scale Usage

| Shade | Usage |
|-------|-------|
| `slate-900` | Auth page backgrounds, `page-title` text |
| `slate-800` | Sidebar active text |
| `slate-700` | `form-label`, secondary button text |
| `slate-600` | Body text, `table-cell` text |
| `slate-500` | `section-label`, muted text, placeholder-like |
| `slate-400` | Icon default color, auth input placeholder |
| `slate-300` | Input borders, secondary button border |
| `slate-200` | Card borders, table borders, dividers, skeleton pulse |
| `slate-100` | Hover backgrounds, table row hover, skeleton bar |
| `slate-50` | Section headers, body/main background |

---

## 4. Tailwind Configuration

File: `frontend/tailwind.config.js`

```javascript
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glass: 'var(--shadow-glass)',
        lift: 'var(--shadow-lift)',
      },
      keyframes: {
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-slide-in': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'notification-slide-in': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'select-slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'level-up-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 0.3s ease-out',
        'toast-slide-in': 'toast-slide-in 0.2s ease-out',
        'notification-slide-in': 'notification-slide-in 0.2s ease-out',
        'select-slide-down': 'select-slide-down 150ms ease-out',
        'level-pop': 'level-up-pop 0.5s ease-out',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],  // .prose class for Tiptap/markdown
};
```

---

## 5. CSS @apply Class Inventory

All classes defined in `frontend/src/styles.scss` inside `@layer components` (and one in `@layer utilities`).

### 5.1 Buttons

**Base class (no standalone use):**

```css
.btn-base {
  @apply inline-flex items-center gap-2 rounded-lg font-medium
         transition-[background-color,border-color,box-shadow,color,transform]
         duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500
         focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
         active:scale-95;
}
```

**Variants:**

```css
.btn-primary      { @apply btn-base justify-center bg-teal-600 text-white px-4 py-2
                           text-sm font-semibold shadow-sm hover:bg-teal-700 hover:shadow-md; }
.btn-primary-full { @apply btn-primary w-full; }
.btn-secondary    { @apply btn-base justify-center bg-white border border-slate-300
                           text-slate-700 px-4 py-2 hover:bg-slate-50
                           hover:border-teal-400 hover:shadow-md; }
.btn-danger       { @apply btn-base justify-center bg-rose-50 text-rose-600
                           border border-rose-200 px-4 py-2
                           hover:bg-rose-100 hover:border-rose-400; }
.btn-danger-solid { @apply btn-base justify-center bg-rose-600 text-white
                           px-3 py-1.5 hover:bg-rose-700; }
.btn-ghost        { @apply btn-base text-slate-600 px-3 py-1.5
                           hover:bg-slate-100 hover:text-slate-900; }
.btn-link         { @apply text-xs text-slate-500 underline hover:text-slate-700
                           focus:outline-none focus:ring-2 focus:ring-teal-500; }
.btn-icon         { @apply btn-base p-1.5 bg-transparent text-slate-400
                           hover:bg-slate-100 hover:text-slate-700; }
.btn-icon-danger  { @apply btn-base p-2 bg-transparent text-rose-500
                           hover:bg-rose-50 hover:text-rose-700; }
```

```css
/* @layer utilities — for composition with other btn-* classes */
.btn-sm { @apply px-3 py-1.5 text-xs; }
```

**Usage examples:**

```html
<!-- Primary action -->
<button class="btn-primary">Save Course</button>

<!-- Full-width submit -->
<button class="btn-primary-full" [disabled]="saving()">Create Account</button>

<!-- Cancel / secondary -->
<button class="btn-secondary" (click)="cancel()">Cancel</button>

<!-- Small danger -->
<button class="btn-danger-solid btn-sm">Remove</button>

<!-- Icon-only -->
<button class="btn-icon" (click)="edit()">
  <lucide-icon [img]="icons.Pencil" [size]="16"></lucide-icon>
</button>

<!-- Ghost with icon + text -->
<button class="btn-ghost">
  <lucide-icon [img]="icons.Plus" [size]="16" class="text-teal-600"></lucide-icon>
  Add Module
</button>
```

### 5.2 Form Controls

```css
.input-field    { @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500; }
.select-field   { @apply rounded-lg border border-slate-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500; }
.search-input   { @apply w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500; }
.checkbox-field { @apply rounded border-slate-300 text-teal-600 focus:ring-teal-500; }
.form-label     { @apply block text-sm font-medium text-slate-700 mb-1; }
.field-error    { @apply text-xs text-rose-600 mt-1; }
```

**Usage example:**

```html
<label class="form-label">Course Title</label>
<input class="input-field" [(ngModel)]="title" placeholder="Enter title..." />
@if (errors.title) {
  <p class="field-error">{{ errors.title }}</p>
}
```

### 5.3 Badges

```css
/* Base (not used alone) */
.badge { @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold; }

/* Variants */
.badge-success { @apply badge bg-emerald-100 text-emerald-700; }
.badge-warning { @apply badge bg-amber-100 text-amber-700; }
.badge-error   { @apply badge bg-rose-100 text-rose-700; }
.badge-info    { @apply badge bg-blue-100 text-blue-700; }
.badge-neutral { @apply badge bg-slate-100 text-slate-600; }
.badge-primary { @apply badge bg-teal-100 text-teal-700; }
.badge-purple  { @apply badge bg-purple-100 text-purple-700; }
```

**Usage (via StatusBadgeComponent or directly):**

```html
<!-- Via shared component -->
<app-status-badge [variant]="'success'">Active</app-status-badge>

<!-- Direct CSS class -->
<span class="badge-warning">Pending Review</span>
```

### 5.4 Cards & Containers

```css
.card       { @apply bg-white border border-slate-200 rounded-xl shadow-sm; }
.form-card  { @apply card transition-[border-color,box-shadow] duration-200
                     hover:shadow-md focus-within:border-teal-300
                     focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.1)]; }
.card-solid { @apply card transition-[border-color,box-shadow] duration-200
                     hover:shadow-md hover:border-slate-300; }
.card-glass { @apply rounded-xl shadow-lg bg-[rgba(255,255,255,0.85)]
                     border border-[rgba(255,255,255,0.3)]
                     backdrop-filter backdrop-blur-[12px]; }
.stat-card  { @apply card px-4 py-3; }
```

**Usage examples:**

```html
<!-- Basic card -->
<div class="card p-6">
  <h3 class="text-lg font-semibold">Quiz Results</h3>
  <!-- ... -->
</div>

<!-- Interactive card (hover lift) -->
<div class="card-solid overflow-hidden cursor-pointer">
  <img [src]="course.thumbnail" class="w-full h-40 object-cover" />
  <div class="p-4">{{ course.title }}</div>
</div>

<!-- Form card (focus glow) -->
<div class="form-card px-6 py-5 mb-6">
  <input class="input-field" placeholder="Search users..." />
</div>

<!-- Glass card (enrollment CTA) -->
<div class="card-glass p-4 max-w-md">
  <p>Enroll in this course to access all modules.</p>
</div>
```

### 5.5 Section Headers

```css
.form-section-header {
  @apply px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}
.form-section-icon-header {
  @apply flex items-center gap-3 px-6 py-4
         bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}
```

### 5.6 Tables

```css
.table-container { @apply card overflow-hidden overflow-x-auto rounded-2xl shadow-lg border-slate-100; }
.table-header    { @apply bg-gradient-to-r from-slate-50 to-white border-b border-slate-200; }
.th              { @apply px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500; }
.table-row       { @apply border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50; }
.table-cell      { @apply px-4 py-3.5 text-sm text-slate-600; }
.expand-panel    { @apply bg-slate-50/80 border-t border-slate-100; }
```

**Usage example:**

```html
<div class="table-container">
  <table class="w-full">
    <thead class="table-header">
      <tr>
        <th class="th">Name</th>
        <th class="th">Status</th>
      </tr>
    </thead>
    <tbody>
      @for (user of users(); track user.id) {
        <tr class="table-row">
          <td class="table-cell">{{ user.name }}</td>
          <td class="table-cell">
            <app-status-badge [variant]="'success'">Active</app-status-badge>
          </td>
        </tr>
      }
    </tbody>
  </table>
</div>
```

### 5.7 Modals

```css
.modal-backdrop {
  @apply fixed inset-0 flex items-center justify-center bg-black/50;
  z-index: var(--z-modal-backdrop);
}
.glass-panel {
  @apply bg-[rgba(255,255,255,0.98)] backdrop-blur-[16px] rounded-xl shadow-2xl;
  z-index: var(--z-modal);
}
.modal-header-gradient {
  @apply relative overflow-hidden px-6 py-4 flex items-center justify-between rounded-t-xl;
  background: linear-gradient(135deg, theme('colors.teal.700'), theme('colors.teal.500'), theme('colors.teal.600'));
}
```

### 5.8 Alerts

```css
.alert-error   { @apply rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700; }
.alert-success { @apply rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700; }
.alert-warning { @apply rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700; }
```

### 5.9 Sidebar

```css
.sidebar-logo-gradient {
  background: linear-gradient(135deg, theme('colors.teal.500'), theme('colors.teal.700'));
}
.sidebar-nav-active {
  background: linear-gradient(90deg, rgba(20,184,166,0.15), rgba(15,118,110,0.1));
  box-shadow: inset 3px 0 0 theme('colors.teal.500'),
              inset 0 0 20px rgba(20,184,166,0.05);
  @apply border-l-0 text-teal-800;
}
.sidebar-desktop-collapsed {
  @media (min-width: 1024px) { width: 64px; }
}
```

### 5.10 Auth (Dark Theme)

```css
.auth-background  { @apply min-h-screen flex items-center justify-center px-4;
                    background: linear-gradient(135deg, #0f172a, #1e293b, #0f172a); }
.auth-card        { @apply bg-[rgba(255,255,255,0.98)] backdrop-blur-[16px] rounded-2xl shadow-2xl p-8; }
.auth-input       { @apply w-full rounded-lg px-4 py-3 text-sm text-white
                           bg-[rgba(15,23,42,0.8)] border border-[rgba(100,116,139,0.4)]
                           placeholder:text-slate-400 disabled:opacity-50
                           focus:outline-none focus:border-teal-500
                           focus:shadow-[0_0_0_2px_rgba(20,184,166,0.3)]; }
.auth-btn-primary { @apply btn-base w-full justify-center rounded-lg px-4 py-3 font-semibold
                           text-white shadow-lg hover:-translate-y-px active:scale-[0.98];
                    background: linear-gradient(135deg, theme('colors.teal.500'), theme('colors.teal.600'));
                    box-shadow: 0 4px 15px rgba(20,184,166,0.3); }
.auth-label       { @apply block text-sm font-medium text-slate-600 mb-1.5; }
```

### 5.11 UI Patterns

```css
.option-card          { @apply cursor-pointer rounded-xl border-2 border-slate-200
                               bg-white p-4 transition-[border-color,box-shadow] duration-200
                               hover:border-slate-300 hover:shadow-sm; }
.option-card-selected { @apply border-teal-500 bg-teal-50/50 shadow-sm; }
.progress-track       { @apply w-full h-2 bg-slate-200 rounded-full overflow-hidden; }
.progress-fill        { @apply h-full bg-teal-500 rounded-full
                               transition-[width] duration-500 ease-out; }
.skeleton-bar         { @apply animate-pulse bg-slate-200 rounded; }
.skeleton-circle      { @apply animate-pulse bg-slate-200 rounded-full; }
.skeleton-card        { @apply animate-pulse bg-white border border-slate-200 rounded-xl p-4; }
.back-link            { @apply inline-flex items-center gap-1 text-sm text-slate-500
                               hover:text-slate-700; }
.dashed-action-btn    { @apply w-full rounded-xl border-2 border-dashed border-slate-300 py-3
                               text-sm hover:border-teal-400 hover:text-teal-600
                               hover:bg-teal-50/30; }
.confirm-panel        { @apply bg-amber-50 border border-amber-200 rounded-lg p-4; }
.drop-zone            { @apply rounded-xl border-2 border-dashed border-slate-300 p-8 text-center; }
.drop-zone-active     { @apply border-teal-400 bg-teal-50/30; }
```

### 5.12 Animations

```css
.page-enter         { animation: page-enter 0.3s ease-out; }
.toast-enter        { animation: toast-slide-in 0.2s ease-out; }
.notification-enter { animation: notification-slide-in 0.2s ease-out; }
.level-pop          { animation: level-up-pop 0.5s ease-out; }
```

### 5.13 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. Shared Angular Components

All in `frontend/src/app/shared/components/`. Use these instead of duplicating HTML patterns.

### LoadingSpinnerComponent

```typescript
// Selector: app-loading-spinner
// Input: message (default 'Loading...')

// Usage:
<app-loading-spinner />
<app-loading-spinner message="Loading courses..." />
```

Renders a centered Loader2 icon with `animate-spin` (wrapped in `<span>`) + message text.

### ErrorAlertComponent

```typescript
// Selector: app-error-alert
// Input: message (required)

<app-error-alert [message]="error()" />
```

Renders `<div class="alert-error" role="alert">`.

### EmptyStateComponent

```typescript
// Selector: app-empty-state
// Inputs: icon (LucideIconData, required), message (string, required)

<app-empty-state [icon]="icons.BookOpen" message="No courses available yet." />
```

Renders a centered icon (size 40, slate-300) + message.

### StatCardComponent

```typescript
// Selector: app-stat-card
// Inputs: label (required), value (required string|number), color (default 'text-slate-900')

<app-stat-card label="Total Courses" [value]="courseCount()" />
<app-stat-card label="Completion" [value]="'85%'" color="text-teal-600" />
```

Renders `.stat-card` with `.section-label` + large bold value.

### StatusBadgeComponent

```typescript
// Selector: app-status-badge
// Input: variant (BadgeVariant: 'success'|'warning'|'error'|'info'|'neutral'|'primary'|'purple')

<app-status-badge [variant]="'success'">Active</app-status-badge>
<app-status-badge [variant]="'warning'">Pending</app-status-badge>
```

### ConfirmDialogComponent

Global singleton — placed once in `MainLayoutComponent`. Driven by `ConfirmDialogService`:

```typescript
// In any component:
readonly #confirmDialog = inject(ConfirmDialogService);

async onDelete() {
  const confirmed = await this.#confirmDialog.confirm({
    title: 'Delete Course',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    variant: 'danger',  // 'danger' | 'default'
  });
  if (confirmed) {
    await this.#courseService.deleteCourse(id);
  }
}
```

### ProgressRingComponent

```typescript
// Selector: app-progress-ring
// Inputs: percent (number), size ('sm'|'md'|'lg'), showLabel (boolean)

<app-progress-ring [percent]="75" size="md" [showLabel]="true" />
```

SVG circle — teal-500 stroke (emerald-500 at 100%), centered label.

### UserAvatarComponent

```typescript
// Selector: app-user-avatar
// Inputs: src (string|null), name (string), size ('xs'|'sm'|'md'|'lg'), color ('teal'|'slate')

<app-user-avatar [src]="profile.avatar_url" [name]="profile.full_name" size="md" />
```

Shows image with loading pulse, or initials fallback with colored circle.

### CustomSelectComponent

Fully accessible dropdown with keyboard navigation (Arrow keys, Enter, Escape, Tab). ARIA `combobox`/`listbox` roles. Uses `custom-select-*` CSS classes.

### FileUploadComponent

Drop zone with drag-and-drop, file type/size validation, progress bar. Uses `.drop-zone` and `.drop-zone-active`.

### TiptapEditorComponent

Rich text editor with toolbar (bold, italic, strike, headings, lists, code block, image upload, undo/redo). Uses `prose prose-slate prose-sm` from `@tailwindcss/typography`.

---

## 7. Layout Shell

### Overall Structure

```
┌─────────────────────────────────────────────┐
│ flex h-screen bg-slate-50                   │
│ ┌──────────┬───────────────────────────────┐│
│ │ Sidebar  │ flex-1 flex flex-col          ││
│ │ w-64     │ ┌───────────────────────────┐ ││
│ │ bg-white │ │ Header  h-14  bg-white    │ ││
│ │ border-r │ ├───────────────────────────┤ ││
│ │          │ │ <main>                    │ ││
│ │          │ │ flex-1 overflow-y-auto    │ ││
│ │          │ │ p-3 lg:p-4               │ ││
│ │          │ │                           │ ││
│ │          │ │   <router-outlet />       │ ││
│ │          │ │                           │ ││
│ │          │ ├───────────────────────────┤ ││
│ │          │ │ MiniPlayer (if active)    │ ││
│ │          │ └───────────────────────────┘ ││
│ └──────────┴───────────────────────────────┘│
│ ToastContainer (fixed, top-20 right)        │
│ ConfirmDialog (fixed, centered modal)       │
└─────────────────────────────────────────────┘
```

### Sidebar

- **Desktop:** static, `w-64`, white bg, collapsible to `64px` via `sidebar-desktop-collapsed`
- **Mobile:** overlay with `bg-black/50` backdrop, slides in/out via `translate-x`
- **Brand:** `"X"` (italic, white) + `"-Courses"` (white/80), collapses to just `"X"`
- **Nav items:** `rounded-xl py-2.5 text-sm slate-600`, active: `sidebar-nav-active` via `routerLinkActive`
- **Collapse toggle:** `Cmd/Ctrl+B` keyboard shortcut (desktop only), persisted to localStorage

### Header

- **Height:** `h-14`, white bg, bottom border
- **Left:** hamburger (mobile only, `lg:hidden`) + breadcrumb nav (desktop only, `hidden lg:flex`)
- **Right:** notification bell (with rose-500 unread count badge), LevelBadge, user avatar+menu
- **Breadcrumb:** Brand mark + route names from `ROUTE_NAME_MAP` + course/module titles

### MiniPlayer

Fixed at bottom of main content area (inside layout flex). White bg, `border-t`, `shadow-lg`. 1px progress bar. Responsive controls (time/prev/next hidden on mobile).

---

## 8. Page Entry Animations

Every routed page component applies the `page-enter` animation via host binding:

```typescript
@Component({
  selector: 'app-course-list-page',
  host: { class: 'block page-enter' },
  // ...
})
```

**Animation:** opacity 0 + translateY(20px) → normal, 0.3s ease-out.

Applied on **23 page components** including: dashboard, course-list-page, course-detail-page, course-form-page, module-viewer-page, profile-page, all admin pages, teaching pages, etc.

**Toast animation:**

```html
<div class="toast-enter flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border ..."
     role="alert">
```

Slides in from right: opacity 0 + translateX(100%) → normal, 0.2s ease-out.

**Notification popup animation:**

```html
<div class="notification-enter fixed top-4 left-4 right-4 z-50 ...">
```

Slides in from top: opacity 0 + translateY(-20px) → normal, 0.2s ease-out.

**Level-up celebration:**

```html
<button [class.level-pop]="showLevelUp()">
```

Pop: scale(1) → scale(1.2) → scale(1), 0.5s ease-out.

---

## 9. Icon System (Lucide)

### Import Pattern

```typescript
import { LucideAngularModule, BookOpen, Plus, Trash2, Loader2 } from 'lucide-angular';

@Component({
  imports: [LucideAngularModule],
  // ...
})
export class MyComponent {
  readonly icons = { BookOpen, Plus, Trash2, Loader2 };
}
```

Always use `readonly icons = { ... }` object — **NOT** `Record<string, LucideIconData>`.

### Size Conventions

| Size | Usage |
|------|-------|
| `14` | Toolbar buttons, close dismiss, select check marks |
| `16` | Button icons, form actions, navigation, most common |
| `18` | Sidebar nav items, sidebar collapse toggle |
| `20` | Header actions (menu, bell), mini-player controls |
| `24` | Loading spinner |
| `32` | Auth callback spinner |
| `40` | Empty state icons |
| `48` | Success confirmation (CheckCircle) |

### Template Usage

```html
<!-- Standard icon in button -->
<button class="btn-primary">
  <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
  Add Module
</button>

<!-- Icon-only button -->
<button class="btn-icon">
  <lucide-icon [img]="icons.Pencil" [size]="16"></lucide-icon>
</button>
```

### CRITICAL: Spinner Pattern

**NEVER put `animate-spin` directly on `<lucide-icon>`** — lucide-angular copies host classes to the inner SVG, causing double rotation.

```html
<!-- CORRECT -->
<span class="inline-flex animate-spin">
  <lucide-icon [img]="icons.Loader2" [size]="16" class="text-white"></lucide-icon>
</span>

<!-- WRONG — causes double rotation -->
<lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin text-white"></lucide-icon>
```

Move `animate-spin` + spacing classes to the `<span>`. Keep color/size on the `<lucide-icon>`. All 39+ spinner instances in the codebase use this wrapper.

---

## 10. Card Patterns

### `.card` (base) — most common

```html
<div class="card p-6">...</div>       <!-- standard padding -->
<div class="card p-4">...</div>       <!-- compact -->
<div class="card overflow-hidden">    <!-- for images that bleed -->
```

### `.card-solid` (hover elevation) — interactive cards

```html
<!-- Course cards -->
<div class="card-solid overflow-hidden cursor-pointer">
  <img ... class="w-full h-40 object-cover" />
  <div class="p-4">...</div>
</div>

<!-- Dashboard "Continue Learning" with left accent border -->
<div class="card-solid p-4 border-l-4 border-l-teal-500">...</div>

<!-- Dashboard action card with group hover -->
<div class="card-solid p-4 flex items-center gap-4 group">...</div>
```

### `.form-card` (focus glow) — admin forms

```html
<div class="form-card px-6 py-5 mb-6">
  <input class="input-field" ... />  <!-- focus triggers teal glow on card -->
</div>
```

### `.card-glass` (glassmorphism) — selective use

```html
<div class="card-glass p-4 max-w-md">
  <!-- Enrollment CTA -->
</div>
```

### `.stat-card` — always via `<app-stat-card>` component

---

## 11. Modal & Dialog System

### ConfirmDialogService (Promise-based)

```typescript
readonly #confirmDialog = inject(ConfirmDialogService);

// Danger variant (red confirm button)
const confirmed = await this.#confirmDialog.confirm({
  title: 'Delete Module',
  message: 'Are you sure you want to delete this module? This action cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep Module',
  variant: 'danger',
});

// Default variant (teal confirm button)
const confirmed = await this.#confirmDialog.confirm({
  title: 'Reset Progress',
  message: 'This will reset all progress for this learner.',
  confirmLabel: 'Reset',
  variant: 'default',
});
```

### Visual Structure

```
modal-backdrop (fixed inset-0, bg-black/50)
  └── glass-panel (bg-white/98, blur, rounded-xl, shadow-2xl)
       ├── modal-header-gradient (teal gradient, white text, close X button)
       ├── Body (p-6, text-sm slate-600)
       └── Actions (px-6 pb-6, flex justify-end gap-3)
            ├── btn-secondary (Cancel — auto-focused)
            └── btn-primary or btn-danger-solid (Confirm)
```

### User Menu Dropdown (Header)

Uses `fixed inset-0 z-40` invisible overlay for click-outside dismiss, plus `absolute right-0 top-full mt-1 w-56 bg-white border rounded-lg shadow-lg z-50` for the panel.

---

## 12. Toast Notification System

### ToastService

```typescript
readonly #toast = inject(ToastService);

this.#toast.success('Course saved successfully');
this.#toast.error('Failed to load modules');
this.#toast.info('Your session will expire in 5 minutes');
this.#toast.warning('This quiz has no questions yet');
```

### Configuration

| Type | Auto-dismiss | Color |
|------|-------------|-------|
| `success` | 4s | emerald-50 bg, emerald-200 border, emerald-800 text, CheckCircle2 icon |
| `error` | 8s | rose-50 bg, rose-200 border, rose-800 text, XCircle icon |
| `warning` | 6s | amber-50 bg, amber-200 border, amber-800 text, AlertTriangle icon |
| `info` | 5s | blue-50 bg, blue-200 border, blue-800 text, Info icon |

- **Max 5 toasts visible** (FIFO overflow)
- `persistent` option prevents auto-dismiss
- Each toast uses `toast-enter` slide-in animation
- Container: `fixed top-20 left-4 right-4 z-50 sm:left-auto sm:max-w-sm`

---

## 13. Auth Pages (Dark Theme)

All 4 auth pages share the same dark background structure:

```html
<div class="auth-background">
  <div class="w-full max-w-md">
    <!-- Brand mark -->
    <div class="text-center mb-8">
      <h1 class="text-5xl font-bold">
        <span class="italic text-teal-400">X</span>
        <span class="text-white/80">-Courses</span>
      </h1>
      <p class="text-slate-400 text-sm mt-2">by Calypso Commodities</p>
    </div>

    <!-- Glass card -->
    <div class="auth-card">
      <label class="auth-label">Email</label>
      <input class="auth-input" type="email" placeholder="you@company.com" />
      <button class="auth-btn-primary mt-6">Continue</button>
    </div>
  </div>
</div>
```

**4 auth pages:** Login (3-step: email → methods → OTP), Reset Password (3-step), Access Request, Auth Callback (spinner only).

---

## 14. Responsive & Mobile Patterns

### Breakpoints

| Breakpoint | Width | Primary Usage |
|------------|-------|--------------|
| `sm:` | 640px+ | Show/hide elements, toast width |
| `md:` | 768px+ | Grid column changes |
| `lg:` | 1024px+ | Sidebar behavior, padding |

### Key Responsive Patterns

```html
<!-- Layout padding -->
<main class="p-3 lg:p-4">

<!-- Sidebar: overlay on mobile, static on desktop -->
<!-- Mobile hamburger hidden on desktop -->
<button class="lg:hidden">☰</button>
<!-- Breadcrumb hidden on mobile -->
<nav class="hidden lg:flex">...</nav>

<!-- Stats grid: 2 cols mobile, 4 cols tablet+ -->
<div class="grid grid-cols-2 md:grid-cols-4 gap-4">

<!-- Toast: full-width mobile, right-aligned desktop -->
<div class="fixed top-20 left-4 right-4 z-50 sm:left-auto sm:max-w-sm">

<!-- User name: hidden on small screens -->
<span class="hidden sm:flex flex-col">{{ userName }}</span>

<!-- Module nav buttons: icon-only on mobile, icon+text on desktop -->
<button class="btn-ghost">
  <lucide-icon [img]="icons.ChevronLeft" [size]="20" class="sm:hidden"></lucide-icon>
  <lucide-icon [img]="icons.ChevronLeft" [size]="16" class="hidden sm:block"></lucide-icon>
  <span class="hidden sm:inline">Previous</span>
</button>

<!-- Mini-player: time and prev/next hidden on mobile -->
<span class="hidden sm:block text-xs tabular-nums">{{ currentTime }}</span>
```

---

## 15. Accessibility

### Skip Navigation

```html
<!-- In index.html -->
<a href="#main-content" class="skip-nav">Skip to main content</a>

<!-- In main-layout -->
<main id="main-content">...</main>
```

The `.skip-nav` class is `sr-only` by default, revealed on `:focus` at top-left with z-100.

### Color Scheme

```html
<meta name="color-scheme" content="light">
```

No global dark mode — dark surfaces are selective accent panels only (auth pages, modal headers).

### ARIA Patterns

- `role="alert"` on toasts and error messages
- `role="dialog"` on confirm dialog
- `role="combobox"` + `role="listbox"` on custom select
- `aria-expanded`, `aria-activedescendant` on dropdowns
- `routerLinkActive` provides `aria-current="page"` on sidebar nav

### WCAG Placeholder Contrast

Auth inputs use `placeholder:text-slate-400` (meets WCAG 3:1 ratio for placeholder text).

### Reduced Motion

All animations and transitions are neutralized via `prefers-reduced-motion: reduce` media query (see Section 5.13).

---

## 16. XP Levels & Gamification UI

### 10 Levels

| Level | Name | XP Threshold | Color |
|-------|------|-------------|-------|
| 1 | Newcomer | 0 | slate |
| 2 | Explorer | 50 | blue |
| 3 | Learner | 150 | cyan |
| 4 | Student | 350 | teal |
| 5 | Scholar | 650 | emerald |
| 6 | Specialist | 1,100 | amber |
| 7 | Expert | 1,700 | orange |
| 8 | Master | 2,500 | rose |
| 9 | Champion | 3,500 | purple |
| 10 | Legend | 5,000 | gradient amber-400 → yellow-500 |

### LevelBadgeComponent (Header)

- Positioned between notification bell and user avatar
- Shows level icon, mini progress bar (desktop only)
- Click opens popover with 5-category XP breakdown
- Floating "+N XP" animation on XP gain (ease-out cubic, 400ms)
- `level-pop` animation on level-up

### XP Triggers

| Action | XP |
|--------|----|
| Complete a module | +10 |
| Pass a quiz | +25 |
| Fail a quiz (attempt) | +15 |
| Quiz score bonus | +points earned |
| Knowledge check correct | +5 |

---

## 17. Critical Rules & Anti-Patterns

### DO

- Use `@apply` classes from `styles.scss` for buttons, inputs, badges, cards, tables, alerts
- Use shared components (`LoadingSpinner`, `ErrorAlert`, `EmptyState`, `StatCard`, `StatusBadge`) for common patterns
- Use explicit `transition-[props] duration-200` for transitions
- Wrap `animate-spin` icons in `<span class="inline-flex animate-spin">`
- Use Lucide icons for all UI indicators — never emojis
- Apply `page-enter` on all routed page components via `host: { class: 'block page-enter' }`

### DON'T

- **Never use `transition-all`** — causes unnecessary repaints and interferes with `will-change` optimization
- **Never use emojis in UI** — use Lucide icons instead (Check, X, AlertTriangle, Clock, Info, etc.)
- **Never put `animate-spin` on `<lucide-icon>`** — causes double rotation
- **Never write inline Tailwind** for patterns that have @apply classes (e.g., don't write `bg-teal-600 text-white rounded-lg px-4 py-2` when `btn-primary` exists)
- **Never add contradictory inline Tailwind** to @apply class elements
- **Never create shared components for high-variation patterns** (tables, filter bars) — use CSS classes instead
- **Never use `[class]="..."` binding** on elements with static `class="..."` — it overrides the static class. Use `[class.x]="condition"` instead
