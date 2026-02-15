# X-Courses v2 — Calypso Design System Styling Approach

> Comprehensive migration plan from current basic Tailwind UI to the Calypso Design System. Based on analysis of `CALYPSO_DESIGN_SYSTEM.md`, `STYLING_GUIDE.md`, the existing 28 `@apply` classes in `styles.scss`, a full audit of all 66 components, and an 11-perspective expert review (architecture, accessibility, performance, tokens, scalability, completeness, elegance, Angular integration, test risk, DX, edge cases).

---

## Table of Contents

1. [Current State & Gap Analysis](#1-current-state--gap-analysis)
2. [Phase S1 — Foundation](#2-phase-s1--foundation-tailwind-config--fonts--animations--favicon)
3. [Phase S2 — Sidebar Redesign](#3-phase-s2--sidebar-redesign)
4. [Phase S3 — Header Redesign](#4-phase-s3--header-redesign)
5. [Phase S4 — Card System](#5-phase-s4--card-system-enhancement)
6. [Phase S5 — Buttons + Forms + Missing Patterns](#6-phase-s5--button--form-input-enhancement--missing-patterns)
7. [Phase S6 — Tables + Modals](#7-phase-s6--table-upgrade--modal-system)
8. [Phase S7 — Page Animations](#8-phase-s7--animations--page-level-polish)
9. [Phase S8 — Login + Brand](#9-phase-s8--login--brand-identity-redesign)
10. [Phase S9 — Cleanup + Documentation](#10-phase-s9--final-cleanup--documentation-sweep)
11. [Summary Statistics](#11-summary-statistics)
12. [Not Applicable to X-Courses](#12-not-applicable-to-x-courses)

---

## 1. Current State & Gap Analysis

### 1.1 What EXISTS Today (28 @apply classes)

| Category | Classes | Count |
|----------|---------|-------|
| Buttons | `btn-primary`, `btn-primary-full`, `btn-secondary`, `btn-danger`, `btn-danger-solid`, `btn-ghost`, `btn-link`, `btn-icon` | 8 |
| Form controls | `input-field`, `select-field`, `search-input`, `checkbox-field`, `form-label` | 5 |
| Badges | `badge`, `badge-success`, `badge-warning`, `badge-error`, `badge-info`, `badge-neutral`, `badge-primary`, `badge-purple` | 8 |
| Cards | `card`, `stat-card` | 2 |
| Tables | `table-container`, `table-header`, `th`, `table-row` | 4 |
| Text | `section-label`, `page-title` | 2 |
| Alerts | `alert-error`, `alert-success`, `alert-warning` | 3 |

### 1.2 What's MISSING for Calypso Design System

| Category | Missing Classes | Priority |
|----------|----------------|----------|
| **Tailwind Config** | Custom fontFamily (Inter), boxShadow (soft/glass/lift), keyframes, animations | **Critical** |
| **Font Loading** | Inter not loaded anywhere — app uses browser default sans-serif | **Critical** |
| **CSS Custom Properties** | `:root` design tokens for brand colors, shadows, z-index, transitions | **Critical** |
| **Z-Index Scale** | Documented z-index hierarchy (sidebar, overlay, modal, toast, tooltip) | **Critical** |
| **Skip Navigation** | `.skip-nav` link for keyboard/screen-reader users | **High** |
| **Buttons** | `btn-base` (composition), `btn-sm`, `btn-icon-danger` | High |
| **Cards** | `form-card` (focus-within glow), `card-solid`, `card-glass` | High |
| **Section Headers** | `form-section-header`, `form-section-icon-header` | Medium |
| **Tables** | `table-cell`, `expand-panel` + upgrade existing table-container/header/th | High |
| **Modals** | `modal-backdrop`, `glass-panel`, `modal-header-gradient` | Medium |
| **Sidebar** | `sidebar-logo-gradient`, `sidebar-nav-active`, `sidebar-desktop-collapsed` | High |
| **Auth** | `auth-background`, `auth-card`, `auth-input`, `auth-btn-primary`, `auth-label` | Medium |
| **Animations** | `page-enter`, `toast-enter`, `notification-enter` | High |
| **Radio / Option Cards** | `.option-card`, `.option-card-selected` (quiz single-choice, type selectors) | **High** |
| **Tabs** | `.tab-active`, `.tab-inactive` (if tab UI is added) | Medium |
| **Pagination** | `.pagination-btn`, `.pagination-active` (course list, notification list) | Medium |
| **Progress Indicators** | `.progress-track`, `.progress-fill` (enrollment progress, module completion) | **High** |
| **Skeleton Loading** | `.skeleton-bar`, `.skeleton-circle`, `.skeleton-card` | **High** |
| **Back Navigation** | `.back-link` (breadcrumb-style back from detail → list) | Medium |
| **Field Validation** | `.field-error` (inline error message below inputs) | Medium |
| **Action Patterns** | `.dashed-action-btn` (add lecture/module placeholder) | Medium |
| **Inline Confirm** | `.confirm-panel` (inline confirm/cancel replacing `window.confirm`) | Medium |
| **File Drop Zone** | `.drop-zone`, `.drop-zone-active` (file upload drag area) | Medium |
| **Favicon** | Default Angular icon → branded teal "X" SVG | Medium |

> **Removed from plan:** `btn-accent`, `btn-warning`, `input-enhanced`, `x-glow`, `sidebar-shimmer`, `modal-shimmer` — no clear use case in LMS context, or decoratively excessive. Can be added later if needed.

### 1.3 Codebase Metrics

| Metric | Count |
|--------|-------|
| Total components | 66 |
| Routed page components | 25 (22 in layout shell + 4 auth) |
| Components using `.card` class | 12 |
| Components with inline card Tailwind (should use `.card`) | ~15 |
| Components using `.table-container` | 11 |
| Inline `<td class="px-3 py-3">` elements | 69 |
| Components with expandable rows | 14 |
| Components with collapsible inline forms | 3 |
| `window.confirm()` usages | 1 |
| Inline `focus:outline-none` on inputs | ~40 |
| Components with inline badge construction | 3 |
| Inline `transition-all` occurrences | ~104 |
| Inline teal-* references in templates | ~153 |

### 1.4 Architectural Decisions (Pre-Made)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CSS custom properties | **Yes** — `:root` vars for brand colors, shadows, z-index, transitions | Single source of truth; eliminates 15+ hardcoded hex/rgba values across classes |
| Font loading | Google Fonts CDN, **`display=optional`** (not `swap`) | `optional` eliminates FOUT; Inter is close to system-ui so invisible fallback is fine |
| Font weights | **400, 500, 600, 700 only** (drop 300) | Weight 300 is unused anywhere in the codebase |
| Global `tabular-nums` | Yes, on `<body>` | Calypso principle: "Always tabular-nums". Inter supports it natively. |
| `<meta name="color-scheme">` | **`content="light"`** on `<meta>` tag | Prevents browser dark-mode flashes; zero risk |
| Primary color aliases | No (`primary-600` etc.) | @apply classes already centralize all color decisions |
| Animations location | `tailwind.config.js` (keyframes + tokens); `styles.scss` only for classes | Keep token layer flat; no `@keyframes` in `styles.scss` |
| Perpetual animations | **None** — no infinite shimmer, glow, or sweep | LMS is a productivity tool, not a trading dashboard. Animations are entrance-only. |
| `btn-base` extraction | Yes — all buttons compose from it (except btn-link) | 6/8 buttons lack focus rings; base fixes this globally |
| `btn-base justify-center` | **Audit before merging** — `justify-center` changes alignment of inline buttons | Only add if all button usages are block-level; otherwise move to `btn-primary-full` only |
| `btn-sm` layer | **`@layer utilities`** (not `components`) | Must compose with component-layer button classes without specificity conflicts |
| `transition-all` policy | **Replace with explicit properties** — `transition-[bg,border,shadow,transform]` | 104 occurrences of `transition-all` cause unnecessary GPU recalculation on every repaint |
| `card-dark` / `glass-panel` | Deferred — add only when consumed | Zero current usages for dark cards |
| Login dark input variant | Yes — premium branded auth experience | First thing users see; sets the tone |
| Sidebar collapse tooltips | **`aria-label`** (not `title` attribute) | `title` has inconsistent screen-reader support, no styling control, and is an accessibility anti-pattern |
| Sidebar body color | White (not dark) | Calypso spec: "Sidebar body: white" |
| `page-title` size | `text-xl` → `text-2xl` | Calypso spec: "Page titles: text-2xl (24px)" |
| Z-index scale | **Defined in `:root`** — sidebar(10), header(20), overlay(30), modal-backdrop(40), modal(50), toast(60), tooltip(70) | Prevents z-50 collision between sidebar, modal, and toast |
| Keyboard shortcut binding | **Angular `host` binding** (not `document.addEventListener`) | Cleaner lifecycle, automatic cleanup, no manual DestroyRef |
| `ROUTE_NAME_MAP` | **`as const` assertion** | Type safety, prevents accidental mutation |
| Sidebar/Auth CSS placement | **Inside `@layer components`** — pseudo-elements work fine in `@layer` | Unlayered CSS has higher specificity, making overrides harder. 12 component-specific classes don't belong in global unlayered scope. |
| Content area padding | **`p-3 lg:p-4`** (12px mobile, 16px desktop) — deviation from Calypso spec (`p-6`) | Calypso was designed for trading dashboards on wide monitors. LMS cards already have p-4–p-6 inner padding; outer `p-6` compounds to 48px+ total and wastes screen space, especially on mobile. |

---

## 2. Phase S1 — Foundation (Tailwind Config + Fonts + Animations + Favicon)

**Goal:** Establish the design token infrastructure that all subsequent phases depend on. Includes CSS custom properties, z-index scale, font loading, animation tokens, skip-nav, and `prefers-reduced-motion`.

**Depends on:** Nothing (first phase).

### 2.1 Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/tailwind.config.js` | MODIFY | Add fontFamily, boxShadow, keyframes, animation |
| `frontend/src/index.html` | MODIFY | Google Fonts links, SVG favicon, title, meta color-scheme, skip-nav |
| `frontend/src/styles.scss` | MODIFY | `:root` vars, @layer base, animation classes, page-title bump, reduced-motion, skip-nav |
| `frontend/public/favicon.svg` | CREATE | Branded teal "X" SVG |
| `frontend/src/app/features/platform/pages/tenant-management-page.component.ts` | MODIFY | Inline title → `.page-title` |
| `frontend/src/app/features/admin/pages/user-management-page.component.ts` | MODIFY | Inline title → `.page-title` |
| `frontend/src/app/features/platform/pages/lecturer-assignment-page.component.ts` | MODIFY | Inline title → `.page-title` |
| `frontend/src/app/layout/main-layout/main-layout.component.ts` | MODIFY | Content area `p-6` → `p-3 lg:p-4`, add `id="main-content"` |
| **20 page components** (see list below) | MODIFY | Remove outer `<div class="p-6">` wrapper padding (double-padding fix) |

### 2.2 Content Area Double-Padding Fix

**Problem:** The layout `<main class="p-6">` adds 24px padding, AND every page component wraps its content in `<div class="p-6">` — resulting in **48px total padding** on all sides.

**Fix:** Keep padding **only in the layout** (`p-3 lg:p-4`), remove it from all 20 page components.

```html
<!-- Step 1: main-layout.component.ts — BEFORE: -->
<main class="flex-1 overflow-y-auto p-6">
<!-- AFTER: -->
<main id="main-content" class="flex-1 overflow-y-auto p-3 lg:p-4">

<!-- Step 2: Every page component — BEFORE: -->
<div class="p-6">
  <!-- page content -->
</div>
<!-- AFTER: -->
<div>
  <!-- page content -->
</div>
<!-- OR remove the wrapper div entirely if it serves no other purpose -->
```

**20 page components to update:**
1. `features/courses/pages/course-list-page.component.ts`
2. `features/courses/pages/course-detail-page.component.ts`
3. `features/courses/pages/course-form-page.component.ts`
4. `features/courses/pages/module-form-page.component.ts`
5. `features/courses/pages/module-viewer-page.component.ts`
6. `features/analytics/pages/progress-dashboard-page.component.ts`
7. `features/admin/pages/user-management-page.component.ts`
8. `features/admin/pages/access-request-page.component.ts`
9. `features/teaching/pages/exam-grading-page.component.ts`
10. `features/teaching/pages/questions-board-page.component.ts`
11. `features/teaching/pages/issue-management-page.component.ts`
12. `features/teaching/pages/teaching-overview-page.component.ts`
13. `features/teaching/pages/staleness-dashboard-page.component.ts`
14. `features/platform/pages/tenant-management-page.component.ts`
15. `features/platform/pages/content-management-page.component.ts`
16. `features/platform/pages/lecturer-assignment-page.component.ts`
17. `features/profile/pages/profile-page.component.ts`
18. `features/issues/pages/my-issues-page.component.ts`
19. `features/questions/pages/my-questions-page.component.ts`
20. `features/notifications/pages/notification-list-page.component.ts`

> **Deviation from Calypso spec:** The Calypso guide specifies `p-6` (24px) on all screen sizes. This was designed for X-Crude (trading platform with wide monitors and dense data). For X-Courses (LMS), cards already have p-4–p-6 inner padding — the outer `p-6` compounds to 48px+ total padding and wastes screen space. `p-3 lg:p-4` (12px mobile / 16px desktop) gives breathing room without excess.

### 2.3 Exact Code — CSS Custom Properties (`:root`)

```scss
/* TOP of styles.scss — before any @layer: */
:root {
  /* Brand colors (reference only — use Tailwind classes, not var() in templates) */
  --color-primary: theme('colors.teal.600');
  --color-primary-hover: theme('colors.teal.700');
  --color-primary-ring: theme('colors.teal.500');
  --color-primary-light: theme('colors.teal.100');
  --color-danger: theme('colors.rose.600');
  --color-danger-light: theme('colors.rose.100');

  /* Shadows */
  --shadow-soft: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-glass: 0 8px 32px rgba(0,0,0,0.08);
  --shadow-lift: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

  /* Z-index scale — documented hierarchy, prevents collisions */
  --z-sidebar: 10;
  --z-header: 20;
  --z-overlay: 30;
  --z-modal-backdrop: 40;
  --z-modal: 50;
  --z-toast: 60;
  --z-tooltip: 70;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
}
```

### 2.3 Exact Code — tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
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
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-slide-in': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'notification-slide-in': {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 0.3s ease-out',
        'toast-slide-in': 'toast-slide-in 0.2s ease-out',
        'notification-slide-in': 'notification-slide-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
```

> **Removed from config:** `shimmer-sweep` and `x-glow` keyframes/animations. LMS does not need perpetual decorative animations. Entrance animations only.

### 2.4 Exact Code — index.html additions

```html
<meta name="color-scheme" content="light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=optional" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<title>X-Courses | Calypso Commodities</title>
```

> **Changes from original plan:** `display=optional` (not `swap`) eliminates FOUT. Weight 300 dropped (unused). `<meta name="color-scheme" content="light">` prevents browser dark flashes.

### 2.5 Exact Code — favicon.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0f172a"/>
  <text x="16" y="24" text-anchor="middle" font-family="Inter,system-ui,sans-serif"
        font-size="28" font-weight="700" font-style="italic" fill="#0d9488">X</text>
</svg>
```

### 2.6 Exact Code — styles.scss additions

```scss
/* BEFORE @layer components: */

/* Skip navigation link (accessibility) */
.skip-nav {
  @apply sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]
         focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg
         focus:text-teal-700 focus:font-medium focus:text-sm;
}

@layer base {
  body {
    @apply tabular-nums;
  }
}

/* INSIDE @layer components — add to Animations section: */
.page-enter {
  @apply animate-page-enter;
}
.toast-enter {
  @apply animate-toast-slide-in;
}
.notification-enter {
  @apply animate-notification-slide-in;
}

/* INSIDE @layer components — update: */
.page-title {
  @apply text-2xl font-bold text-slate-900;  /* was text-xl */
}

/* AFTER all @layer blocks — prefers-reduced-motion (covers ALL animations): */
@media (prefers-reduced-motion: reduce) {
  .page-enter,
  .toast-enter,
  .notification-enter,
  .sidebar-nav-active,
  .sidebar-nav-active::before {
    animation: none !important;
    transition: none !important;
  }
  /* Catch-all: disable all animations and transitions globally */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2.7 Skip Navigation — index.html

```html
<body>
  <a href="#main-content" class="skip-nav">Skip to main content</a>
  <app-root></app-root>
</body>
```

And in `main-layout.component.ts`, add `id="main-content"` to the `<main>` element.

### 2.8 Transition Policy

**Global rule:** Replace `transition-all duration-200` with explicit properties everywhere:

```scss
/* INSTEAD OF: */
@apply transition-all duration-200;

/* USE: */
@apply transition-[background-color,border-color,box-shadow,color,transform] duration-200;
```

This applies to `btn-base`, `input-field`, `card`, `card-solid`, `form-card`, and all other interactive classes. The `transition-all` shorthand forces the browser to watch every CSS property for changes, which is measurably slower on pages with many interactive elements (104 current occurrences).

### 2.9 Checklist — COMPLETED

- [x] Add `:root` CSS custom properties block to top of `styles.scss`
- [x] Update `tailwind.config.js` with fontFamily, boxShadow (using CSS vars), keyframes, animation
- [x] Add `<meta name="color-scheme" content="light">` to `index.html`
- [x] Add Google Fonts `<link>` tags to `index.html` (`display=optional`, weights 400-700 only)
- [x] Add SVG favicon link to `index.html`, update `<title>`
- [x] Create `frontend/public/favicon.svg`
- [x] Add `.skip-nav` class to `styles.scss`
- [x] Add skip-nav `<a>` to `index.html` before `<app-root>`
- [x] Change `<main>` padding from `p-6` → `p-3 lg:p-4` and add `id="main-content"` in `main-layout.component.ts`
- [x] Remove `p-6` from outer wrapper `<div>` in all 20 page components (double-padding fix)
- [x] Add `@layer base { body { @apply tabular-nums; } }` to `styles.scss`
- [x] Update `.page-title` from `text-xl` to `text-2xl`
- [x] Add `.page-enter`, `.toast-enter`, `.notification-enter` classes
- [x] Add comprehensive `@media (prefers-reduced-motion)` with global catch-all
- [x] Migrate 3 inline page-title components to `.page-title` class
- [x] Run `npx vitest run` — 1455/1455 passed, 0 failures
- [x] Run `ng build` — production build OK

---

## 3. Phase S2 — Sidebar Redesign

**Goal:** Teal gradient logo area, premium active nav state, desktop collapse/expand, footer with version. Brand text split with immediate test fix.

**Depends on:** Phase S1 (animation tokens, `:root` z-index).

> **IMPORTANT — Test Breakage Risk:** This phase splits "X-Courses" brand text into `<span>` elements, which breaks `getByText('X-Courses')` in sidebar and main-layout tests. The `aria-label` fix and corresponding test updates MUST be done in this phase, not deferred to S8.

### 3.1 Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/core/services/sidebar.service.ts` | CREATE | Signal-based collapse state + localStorage |
| `frontend/src/app/core/services/sidebar.service.spec.ts` | CREATE | ~5 tests |
| `frontend/src/app/__mocks__/sidebar.mock.ts` | CREATE | Mock factory |
| `frontend/src/styles.scss` | MODIFY | Add 3 sidebar CSS classes (inside `@layer components`) |
| `frontend/src/app/layout/sidebar/sidebar.component.ts` | MODIFY | Full template rewrite (~120 lines) |
| `frontend/src/app/layout/sidebar/sidebar.component.spec.ts` | MODIFY | Update existing + ~8 new tests + **fix `getByText` → `getByLabelText`** |
| `frontend/src/app/layout/main-layout/main-layout.component.ts` | MODIFY | Inject SidebarService, `host` binding for Cmd/Ctrl+B |
| `frontend/src/app/layout/main-layout/main-layout.component.spec.ts` | MODIFY | Mock + shortcut test + **fix `getByText` → `getByLabelText`** |

### 3.2 SidebarService Design

```typescript
@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly #collapsed = signal(this.#readPersistedState());
  readonly collapsed = this.#collapsed.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(this.#collapsed()));
    });
  }

  toggle(): void { this.#collapsed.update(v => !v); }
  collapse(): void { this.#collapsed.set(true); }
  expand(): void { this.#collapsed.set(false); }

  #readPersistedState(): boolean {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
    catch { return false; }
  }
}
```

### 3.3 Exact CSS — Sidebar Classes

```scss
/* INSIDE @layer components: */

.sidebar-logo-gradient {
  background: linear-gradient(135deg, theme('colors.teal.500') 0%, theme('colors.teal.700') 100%);
}

.sidebar-nav-active {
  background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(15,118,110,0.1));
  box-shadow: 0 2px 8px rgba(20,184,166,0.15), inset 0 1px 0 rgba(255,255,255,0.5);
  border: 1px solid rgba(20,184,166,0.2);
  color: theme('colors.teal.800');
  position: relative;
  overflow: hidden;
  /* NO backdrop-filter — invisible over white background, costs GPU for no visual benefit */
}

.sidebar-desktop-collapsed {
  @media (min-width: 1024px) {
    width: 64px;
    /* NO !important — use sufficient specificity instead */
  }
}
```

> **Changes from original plan:**
> - **Moved inside `@layer components`** — pseudo-elements work fine in `@layer`; unlayered CSS was unnecessary and caused specificity issues.
> - **Removed `sidebar-shimmer`** — perpetual shimmer animation is decoratively excessive for an LMS. Entrance-only animations suffice.
> - **Removed `x-glow`** — same rationale. The "X" in the sidebar does not need a pulsing glow.
> - **Removed `sidebar-nav-active::before` shimmer** — active state is visually clear without a perpetual sweep animation.
> - **Removed `backdrop-filter: blur(8px)`** from `sidebar-nav-active` — invisible over white background but costs GPU compositing.
> - **Removed `!important`** from `sidebar-desktop-collapsed` — use specificity or `[class]` attribute selector.
> - **Used `theme()`** references instead of hardcoded hex (`#14B8A6` → `theme('colors.teal.500')`).
> - **Changed teal-300 to teal-500** on sidebar gradient — teal-300 on teal gradient has insufficient contrast (< 3:1).

### 3.4 Sidebar Template Structure (Key Sections)

```
<aside class="... w-64 transition-[width] duration-300" [class.sidebar-desktop-collapsed]="collapsed()"
       [style.z-index]="'var(--z-sidebar)'">
  ┌─ Logo Area (sidebar-logo-gradient h-14) ──────────────────┐
  │  "X" (italic bold text-white, text-xl/text-2xl)           │
  │  "-Courses by Calypso" (expanded) / nothing (collapsed)    │
  │  aria-label="X-Courses"                                    │
  └────────────────────────────────────────────────────────────┘
  ┌─ Navigation (flex-1 overflow-y-auto py-4) ────────────────┐
  │  @for section headers:                                      │
  │    expanded → .section-label                                │
  │    collapsed → <hr class="mx-1 my-2 border-t">            │
  │  @for nav items:                                            │
  │    routerLinkActive="sidebar-nav-active"                    │
  │    base: text-gray-500 rounded-xl py-2.5 px-3 border-transparent │
  │    collapsed → icon only, centered, [attr.aria-label]       │
  └────────────────────────────────────────────────────────────┘
  ┌─ Footer (shrink-0 border-t p-2) ──────────────────────────┐
  │  Toggle button (ChevronsLeft/ChevronsRight, lg:flex only)  │
  │  Version text "X-Courses v0.1.0" (expanded only)           │
  └────────────────────────────────────────────────────────────┘
</aside>
```

> **Key change:** `[attr.title]` → `[attr.aria-label]` on collapsed nav items. `title` has inconsistent screen-reader support and no styling control. `aria-label` is the accessible standard.

### 3.5 Keyboard Shortcut (MainLayout)

```typescript
// Use Angular host binding — NOT document.addEventListener
// This is cleaner, has automatic lifecycle cleanup, no DestroyRef needed.
@Component({
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class MainLayoutComponent {
  #sidebar = inject(SidebarService);

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      if (window.innerWidth >= 1024) this.#sidebar.toggle();
    }
  }
}
```

> **Changed from original plan:** Angular `host` binding replaces `document.addEventListener` + manual `DestroyRef` cleanup. Cleaner, idiomatic Angular 19.

### 3.6 Mobile Behavior

- Mobile sidebar remains `fixed`, always `w-64` (collapsed only applies on `lg:` desktop)
- `.sidebar-desktop-collapsed` uses `@media (min-width: 1024px)` to conditionally set width 64px
- Mobile overlay + backdrop behavior unchanged
- Collapse toggle button hidden on mobile (`hidden lg:flex`)

### 3.7 Brand Text Test Fix (CRITICAL — do in this phase)

When the sidebar brand text changes from `"X-Courses"` to split `<span>` elements, existing tests using `getByText('X-Courses')` will break. Fix immediately:

```typescript
// sidebar.component.spec.ts — BEFORE:
expect(screen.getByText('X-Courses')).toBeTruthy();

// sidebar.component.spec.ts — AFTER:
expect(screen.getByLabelText('X-Courses')).toBeTruthy();
```

Affected test files:
1. `sidebar.component.spec.ts` — brand text assertion
2. `main-layout.component.spec.ts` — sidebar presence check (if any)

### 3.8 Checklist — COMPLETED

- [x] Create `SidebarService` (signal, localStorage, toggle/collapse/expand)
- [x] Create `SidebarService` spec (5 tests: default, toggle, persist, restore, explicit collapse/expand)
- [x] Create mock factory `createMockSidebarService()`
- [x] Add 3 CSS classes to `styles.scss` inside `@layer components` (sidebar-logo-gradient, sidebar-nav-active, sidebar-desktop-collapsed)
- [x] Rewrite sidebar template: logo area, nav items, section headers, collapsed mode, footer
- [x] Use `aria-label` (not `title`) on collapsed nav items
- [x] Add `aria-label="X-Courses"` on brand text container
- [x] Remove `GraduationCap` from sidebar icon imports
- [x] Add `ChevronsLeft`, `ChevronsRight` to sidebar icons
- [x] Add `host: { '(document:keydown)': 'onKeydown($event)' }` in `MainLayoutComponent`
- [x] **Fix tests: `getByText('X-Courses')` → `getByLabelText('X-Courses')` in sidebar + main-layout specs**
- [x] Update sidebar spec: mock SidebarService, 13 tests (was 9) — brand, footer, toggle, collapsed labels
- [x] Update main-layout spec: mock SidebarService, keyboard shortcut test (Cmd+B)
- [x] Run tests — 1465/1465 passed, build OK

---

## 4. Phase S3 — Header Redesign

**Goal:** Location-indicator breadcrumb, redesigned user menu dropdown with ARIA, unified h-14 height, focus indicators.

**Depends on:** Phase S2 (sidebar h-14 alignment).

### 4.1 Files

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/layout/header/header.component.ts` | MODIFY | Breadcrumb, user menu, height, ARIA, focus |
| `frontend/src/app/layout/header/header.component.spec.ts` | MODIFY | ~10 new tests |
| `frontend/src/app/layout/sidebar/sidebar.component.ts` | MODIFY | h-16 → h-14 on brand area |

### 4.2 Route Name Map

```typescript
const ROUTE_NAME_MAP = [
  { prefix: '/dashboard', name: 'Dashboard' },
  { prefix: '/courses', name: 'Courses' },
  { prefix: '/questions', name: 'My Questions' },
  { prefix: '/issues', name: 'My Issues' },
  { prefix: '/notifications', name: 'Notifications' },
  { prefix: '/profile', name: 'Profile' },
  { prefix: '/teaching/courses', name: 'Teaching Overview' },
  { prefix: '/teaching/grading', name: 'Exam Grading' },
  { prefix: '/teaching/questions', name: 'Questions Board' },
  { prefix: '/teaching/issues', name: 'Issue Management' },
  { prefix: '/teaching/staleness', name: 'Content Staleness' },
  { prefix: '/admin/users', name: 'User Management' },
  { prefix: '/admin/access-requests', name: 'Access Requests' },
  { prefix: '/analytics/progress', name: 'Progress Dashboard' },
  { prefix: '/platform/tenants', name: 'Tenant Management' },
  { prefix: '/platform/lecturer-assignments', name: 'Lecturer Assignments' },
  { prefix: '/platform/content', name: 'Content Management' },
] as const;
```

> **Changed:** Added `as const` assertion for type safety and immutability.

### 4.3 Breadcrumb Template

```html
<div class="hidden lg:flex items-center gap-2 text-sm">
  <span>
    <span class="italic font-semibold text-teal-600">X</span>
    <span class="font-semibold text-gray-800">-Courses</span>
  </span>
  <span class="text-slate-400">/</span>
  <span class="font-medium text-slate-600">{{ pageName() }}</span>
</div>
```

- **NOT clickable** — all `<span>` elements, no links
- **Desktop only** — `hidden lg:flex`
- `pageName()` is a `computed()` using `toSignal(router.events)` + prefix matching

### 4.4 User Menu Redesign (with ARIA)

| Element | Current | Target |
|---------|---------|--------|
| Trigger shape | `p-1.5 rounded-lg hover:bg-slate-100` | `px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none` |
| Trigger ARIA | None | `aria-haspopup="true"` + `[attr.aria-expanded]="menuOpen()"` |
| Name display | Name only | Name + role label stack |
| Role label | Not shown | `text-xs text-slate-500` (highest role: PA > TA > Lecturer > CSM > Learner) |
| Dropdown ARIA | None | `role="menu"` + `aria-labelledby="user-menu-button"` |
| Menu items | None | `role="menuitem"` on each link/button |
| Dropdown width | `w-48` | `w-56` |
| Dropdown radius | `rounded-xl` | `rounded-lg` |
| Dropdown margin | `mt-1` | `mt-2` |
| Dropdown header | None | Email + role section with `border-b` |
| Link focus | None | `focus:bg-slate-100 focus:outline-none` on each menu item |
| Link colors | `text-slate-700` | `text-slate-600 hover:text-slate-900` |
| Sign out hover | `hover:bg-rose-50` | `hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50` |

### 4.5 Focus Indicators on Header Elements

All interactive header elements (notification bell, mobile menu toggle, user menu trigger) must have visible focus indicators:

```html
<!-- Notification bell -->
<button class="... focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none rounded-lg">

<!-- Mobile menu toggle -->
<button class="... focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none rounded-lg">
```

### 4.6 New Computed Signals

```typescript
#currentUrl = toSignal(
  this.#router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => e.urlAfterRedirects),
  ),
  { initialValue: this.#router.url },
);

pageName = computed(() => {
  const url = this.#currentUrl();
  return ROUTE_NAME_MAP.find(r => url.startsWith(r.prefix))?.name ?? null;
});

roleLabel = computed(() => {
  const roles = this.#auth.roles();
  if (roles.includes('platform_admin')) return 'Platform Admin';
  if (roles.includes('tenant_admin')) return 'Tenant Admin';
  if (roles.includes('lecturer')) return 'Lecturer';
  if (roles.includes('csm')) return 'CSM';
  return 'Learner';
});

userEmail = computed(() => this.#auth.currentUser()?.email ?? '');
```

### 4.7 Checklist — COMPLETED

- [x] Change header `h-16` to `h-14`, `px-4 lg:px-6` to `px-4`
- [x] Add `ROUTE_NAME_MAP` constant (tuple array with prefix matching, most-specific first)
- [x] Add `#currentUrl` (toSignal), `pageName`, `roleLabel`, `userEmail` computed signals
- [x] Add breadcrumb template (desktop only, `aria-label="Breadcrumb"`)
- [x] Redesign user menu trigger (rounded-full, bg-slate-50, name+role stack, focus-visible ring)
- [x] Add ARIA attributes: `aria-haspopup`, `aria-expanded`, `role="menu"`, `role="menuitem"`
- [x] Add `focus-visible` indicators to notification bell, mobile menu toggle, user menu button
- [x] Redesign dropdown (w-56, rounded-lg, email+role header section with badge-neutral)
- [x] Sidebar brand area already h-14 from S2
- [x] Tests: breadcrumb for /dashboard, /courses/some-id, /teaching/grading, unknown route /
- [x] Tests: role label priority (PA > TA > Lecturer > CSM > Learner), dropdown email + role badge
- [x] Tests: ARIA — aria-haspopup, aria-expanded toggle, role="menu", role="menuitem" (2 items)
- [x] Run tests — 1479/1479 passed (24 header tests, 15 new), build OK

---

## 5. Phase S4 — Card System Enhancement

**Goal:** Add form-card (focus-within glow), card-solid, card-glass, section headers. Migrate ~16 component files.

**Depends on:** Nothing (CSS-only + template class swaps).

### 5.1 New CSS Classes

```scss
/* Inside @layer components: */
.form-card {
  @apply bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden
         transition-[border-color,box-shadow] duration-200 hover:shadow-md;

  /* CSS nesting — focus-within inside @layer (no need for separate unlayered rule) */
  &:focus-within {
    border-color: theme('colors.teal.300');
    box-shadow: theme('boxShadow.soft'), 0 0 0 4px rgba(20, 184, 166, 0.08);
  }
}

.card-solid {
  @apply bg-white border border-slate-200 rounded-xl shadow-sm
         transition-[border-color,box-shadow] duration-200 hover:shadow-md hover:border-slate-300;
}

.card-glass {
  @apply rounded-xl shadow-lg;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(12px);
}

.form-section-header {
  @apply px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}

.form-section-icon-header {
  @apply flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200/60;
}
```

> **Changes from original plan:**
> - **`form-card:focus-within` is now inside `@layer components`** using CSS nesting (`&:focus-within`). No need for a separate unlayered rule.
> - **Used `theme()`** references instead of hardcoded `#5eead4`.
> - **Used explicit `transition-[border-color,box-shadow]`** instead of `transition-all`.

### 5.2 Migration Table — Which Component Gets Which Card Class

| Component | Current | New | Reason |
|-----------|---------|-----|--------|
| **tenant-management-page** (form) | `card px-6 py-5 mb-6` | `form-card px-6 py-5 mb-6` | Has input fields → focus-within glow |
| **user-management-page** (form) | `card px-6 py-5 mb-6` | `form-card px-6 py-5 mb-6` | Same |
| **lecturer-assignment-page** (form) | `card px-6 py-5 mb-6` | `form-card px-6 py-5 mb-6` | Same |
| **login** | `card p-8` | `form-card p-8` | Auth form with inputs |
| **reset-password** | `card p-8` | `form-card p-8` | Auth form |
| **access-request** | `card p-8` | `form-card p-8` | Auth form |
| **profile-page** | `card divide-y divide-slate-100` | `form-card divide-y divide-slate-100` | Has inline name edit |
| **dashboard-action-card** | `card p-4 hover:shadow-md hover:border-slate-300...` | `card-solid p-4 flex items-center gap-4 group` | Already has manual hover — centralize |
| **course-card** | `block card hover:shadow-md hover:border-slate-300...` | `block card-solid overflow-hidden group` | Same |
| **comment-section** (each comment) | inline `bg-white border border-slate-200 rounded-xl p-4` | `card p-4` | Standardize |
| **report-issue** | inline `bg-white...rounded-xl shadow-sm p-4` | `card p-4` | Standardize |
| **ask-expert** | inline `bg-white...rounded-xl shadow-sm p-4` | `card p-4` | Standardize |
| **quiz-taker** (x3) | inline `rounded-xl border border-slate-200 bg-white p-6` | `card p-6` / `card overflow-hidden` | Standardize |
| **quiz-question** | inline `rounded-xl border...bg-white p-5` | `card p-5` | Standardize |
| **exam-taker** (x4) | inline `rounded-xl border...bg-white p-6/p-4` | `card p-6` / `card p-4` | Standardize |
| **external-quiz-viewer** | inline `rounded-xl border...bg-white p-6 space-y-4` | `card p-6 space-y-4` | Standardize |
| **notification-list-page** (skeleton+item) | inline `bg-white border border-slate-200 rounded-xl p-4` | `card p-4` | Standardize |
| **my-questions-page** (skeleton) | inline `animate-pulse bg-white border...` | `card animate-pulse p-4` | Standardize |
| **my-issues-page** (skeleton) | inline `animate-pulse bg-white border...` | `card animate-pulse p-4` | Standardize |
| **enrollment-cta** | inline `bg-white/80 backdrop-blur-sm...` | `card-glass p-4 max-w-md` | Glass pattern |

### 5.3 NOT Migrated (Intentionally Different)

- **Header dropdown** — shadow-lg, z-50 overlay, not a content card
- **Notification toast** (main-layout) — floating toast, shadow-lg, fixed position
- **Instructor chips** (course-detail) — small px-3 py-2, not card pattern
- **Module-form type selectors** — interactive `<button>` elements, not cards

### 5.4 Deferred Card Variants

- **`card-dark`** — 0 current usages. Add when KPI banners or dark panels are designed.

### 5.5 Checklist — COMPLETED

- [x] Add 5 new CSS classes to `styles.scss` inside `@layer components` (form-card with nested :focus-within, card-solid, card-glass, form-section-header, form-section-icon-header)
- [x] Use `theme()` references — no hardcoded hex values
- [x] Use explicit `transition-[...]` — no `transition-all`
- [x] Migrate 3 admin form cards → `form-card` (tenant-management, user-management, lecturer-assignment)
- [x] Migrate profile card → `form-card`
- [x] Migrate 2 interactive cards → `card-solid` (dashboard-action-card, course-card)
- [x] Migrate ~13 inline Tailwind card patterns → `.card` (comment-section, ask-expert, report-issue, quiz-taker x3, quiz-question, exam-taker x4, external-quiz-viewer, notification-list, my-questions, my-issues)
- [x] Migrate enrollment-cta → `card-glass`
- [x] Run tests — 1455/1455 passed, 0 failures, build OK
- [ ] Auth cards (login, reset-password, access-request) deferred to S8 (login redesign phase)

---

## 6. Phase S5 — Button + Form Input Enhancement + Missing Patterns

**Goal:** Composition-based button system with `btn-base`, new variants, consistent focus rings, form input cleanup, plus ~12 missing UI pattern classes.

**Depends on:** Nothing (CSS-only + template cleanup).

### 6.1 Exact CSS — btn-base and Updated Buttons

```scss
/* === Buttons === */
.btn-base {
  @apply inline-flex items-center gap-2
         rounded-lg font-medium transition-[background-color,border-color,box-shadow,color,transform] duration-200
         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95;
  /* NOTE: justify-center intentionally omitted from base — only add on full-width buttons.
     Adding justify-center globally would break inline buttons with leading icons. */
}
.btn-primary {
  @apply btn-base justify-center bg-teal-600 text-white px-4 py-2 text-sm font-semibold shadow-sm
         hover:bg-teal-700 hover:shadow-md;
}
.btn-primary-full {
  @apply btn-primary w-full;
}
.btn-secondary {
  @apply btn-base justify-center bg-white border border-slate-300 text-slate-700 px-4 py-2 text-sm font-semibold
         hover:bg-slate-50 hover:border-teal-400 hover:shadow-md;
}
.btn-danger {
  @apply btn-base justify-center bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2 text-sm font-semibold
         hover:bg-rose-100 hover:border-rose-400;
}
.btn-danger-solid {
  @apply btn-base justify-center bg-rose-600 text-white px-3 py-1.5 text-sm font-semibold
         hover:bg-rose-700;
}
.btn-ghost {
  @apply btn-base text-sm text-slate-600 px-3 py-1.5
         hover:bg-slate-100 hover:text-slate-900;
}
.btn-link {
  @apply text-xs text-slate-500 hover:text-slate-700 underline
         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded;
  /* Does NOT extend btn-base — intentionally minimal, but DOES have focus indicator */
}
.btn-icon {
  @apply btn-base p-1.5 bg-transparent text-slate-400
         hover:bg-slate-100 hover:text-slate-700;
}
.btn-icon-danger {
  @apply btn-base p-2 bg-transparent text-rose-500
         hover:bg-rose-50 hover:text-rose-700;
}
```

> **Changes from original plan:**
> - **`justify-center` removed from `btn-base`**, added to individual button variants that need it. This prevents alignment issues on inline buttons with icons.
> - **`btn-link` now has a focus indicator** — `focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded`. Previously had zero focus visibility.
> - **`btn-accent` and `btn-warning` removed** — no clear use case in LMS. Can be added later if needed.
> - **`input-enhanced` removed** — gradient input background has no use case.
> - **`transition-all` replaced** with explicit `transition-[...]` in `btn-base`.

### 6.2 `btn-sm` — In `@layer utilities`

```scss
@layer utilities {
  .btn-sm {
    @apply px-3 py-1.5 text-xs;
  }
}
```

> `btn-sm` must be in `@layer utilities` (not `@layer components`) so it can compose with component-layer button classes without specificity conflicts. Utility classes should always win over component base styles.

### 6.3 Input Focus Fix

```scss
.input-field {
  @apply w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
         focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500
         transition-[border-color,box-shadow] duration-200;
}
.select-field {
  @apply rounded-lg border border-slate-300 px-3 py-2 text-sm
         focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500;
}
.search-input {
  @apply w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm
         focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500;
}
```

### 6.4 New Missing Pattern Classes

```scss
/* Inside @layer components: */

/* Option cards — quiz single-choice, module type selectors */
.option-card {
  @apply cursor-pointer rounded-xl border-2 border-slate-200 bg-white p-4
         transition-[border-color,box-shadow,background-color] duration-200
         hover:border-slate-300 hover:shadow-sm;
}
.option-card-selected {
  @apply border-teal-500 bg-teal-50/50 shadow-sm;
}

/* Progress indicators */
.progress-track {
  @apply w-full h-2 bg-slate-200 rounded-full overflow-hidden;
}
.progress-fill {
  @apply h-full bg-teal-500 rounded-full transition-[width] duration-500 ease-out;
}

/* Skeleton loading */
.skeleton-bar {
  @apply animate-pulse bg-slate-200 rounded;
}
.skeleton-circle {
  @apply animate-pulse bg-slate-200 rounded-full;
}
.skeleton-card {
  @apply animate-pulse bg-white border border-slate-200 rounded-xl p-4;
}

/* Back navigation link */
.back-link {
  @apply inline-flex items-center gap-1 text-sm text-slate-500
         hover:text-slate-700 transition-colors duration-150;
}

/* Field validation error */
.field-error {
  @apply text-xs text-rose-600 mt-1;
}

/* Dashed action button (add lecture/module placeholder) */
.dashed-action-btn {
  @apply w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm text-slate-500
         hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30
         transition-[border-color,color,background-color] duration-200
         focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2;
}

/* Inline confirmation panel (replaces window.confirm) */
.confirm-panel {
  @apply bg-amber-50 border border-amber-200 rounded-lg p-4;
}

/* File drop zone */
.drop-zone {
  @apply rounded-xl border-2 border-dashed border-slate-300 p-8 text-center
         transition-[border-color,background-color] duration-200;
}
.drop-zone-active {
  @apply border-teal-400 bg-teal-50/30;
}
```

### 6.5 Template Cleanup — Inline Button Replacements

| File | Current Inline | Replacement |
|------|---------------|-------------|
| `comment-section.component.ts` (x3) | `bg-teal-600 text-white rounded-lg px-3 py-1.5...` | `btn-primary btn-sm` |
| `external-quiz-viewer.component.ts` | `bg-teal-600 text-white rounded-lg px-4 py-2...` | `btn-primary` |
| `quiz-taker.component.ts` | `bg-amber-500 text-white rounded-lg px-6 py-3...` | `btn-primary px-6 py-3` |
| `module-item.component.ts` (delete) | `bg-rose-600 text-white rounded-md px-2.5 py-1...` | `btn-danger-solid btn-sm` |
| `module-item.component.ts` (cancel) | `bg-white border border-slate-300...px-2.5 py-1...` | `btn-secondary btn-sm` |
| `lecture-accordion.component.ts` (delete) | `bg-rose-600 text-white rounded-lg px-3 py-1.5...` | `btn-danger-solid` |
| `lecture-accordion.component.ts` (cancel) | `bg-white border border-slate-300...px-3 py-1.5...` | `btn-secondary btn-sm` |

### 6.6 `focus:outline-none` Removal (~40 occurrences across ~17 files)

After adding `focus:outline-none` to the @apply class definitions, remove the redundant inline `focus:outline-none` from every `input-field`, `select-field`, and `search-input` usage in templates. Files:

`login`, `reset-password`, `access-request`, `course-form`, `quiz-form`, `exam-form`, `lecture-form`, `pdf-form`, `video-form`, `markdown-form`, `external-quiz-form`, `comment-section`, `ask-expert`, `report-issue`, `enrollment-manager`, `enrollment-cta`, `profile-page`

### 6.7 Checklist

- [ ] Add `.btn-base` (without `justify-center`) and refactor all 7 button classes (except `.btn-link`)
- [ ] Add `justify-center` to `btn-primary`, `btn-secondary`, `btn-danger`, `btn-danger-solid` individually
- [ ] Add focus indicator to `.btn-link` (`focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded`)
- [ ] Add `.btn-sm` in `@layer utilities` (not components)
- [ ] Add `.btn-icon-danger`
- [ ] Add 12 missing pattern classes: `.option-card`, `.option-card-selected`, `.progress-track`, `.progress-fill`, `.skeleton-bar`, `.skeleton-circle`, `.skeleton-card`, `.back-link`, `.field-error`, `.dashed-action-btn`, `.confirm-panel`, `.drop-zone` + `.drop-zone-active`
- [ ] Add `focus:outline-none` to `.input-field`, `.select-field`, `.search-input`
- [ ] Remove `focus:outline-none` from ~40 template occurrences (~17 files)
- [ ] Replace 7 inline button patterns with @apply classes
- [ ] Replace `transition-all` with explicit `transition-[...]` in all button/input classes
- [ ] Migrate pagination buttons → `btn-secondary btn-sm`
- [ ] Run tests, build OK
- [ ] Visual: focus rings on all buttons (including btn-link), ghost hover bg, secondary hover border

---

## 7. Phase S6 — Table Upgrade + Modal System

**Goal:** Premium table styling, `.table-cell` class, `.expand-panel` class, `ConfirmDialogService` + component with ARIA, z-index hierarchy.

**Depends on:** Phase S1 (`:root` z-index vars).

### 7.1 Z-Index Hierarchy (Enforced)

All z-index values must use the `:root` CSS custom properties:

| Layer | CSS Variable | Value | Components |
|-------|-------------|-------|------------|
| Sidebar | `--z-sidebar` | 10 | Sidebar (desktop + mobile) |
| Header | `--z-header` | 20 | Header (if sticky) |
| Mobile overlay | `--z-overlay` | 30 | Sidebar mobile backdrop |
| Modal backdrop | `--z-modal-backdrop` | 40 | ConfirmDialog backdrop |
| Modal content | `--z-modal` | 50 | ConfirmDialog panel |
| Toast | `--z-toast` | 60 | Toast notifications |
| Tooltip | `--z-tooltip` | 70 | Tooltips, popovers |

> **Previously:** sidebar, modal, and toast all used `z-50`, causing overlap collisions. Now each layer has a distinct z-index.

### 7.2 Updated Table CSS

```scss
/* Inside @layer components: */
.table-container {
  @apply overflow-hidden overflow-x-auto rounded-2xl bg-white shadow-lg border border-slate-100
         transition-[box-shadow] duration-200;
  /* NOTE: hover:shadow-xl REMOVED — tables are static content, not interactive cards.
     Shadow escalation on hover is visually confusing for data tables. */
}
.table-header {
  @apply bg-gradient-to-r from-slate-50 to-white border-b border-slate-200;
}
.th {
  @apply px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500;
}
.table-row {
  @apply border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors;
}
.table-cell {
  @apply px-4 py-3.5 text-sm text-slate-600;
}
.expand-panel {
  @apply bg-slate-50/80 border-t border-slate-100;
}
```

> **Changes from original plan:**
> - **Added `overflow-x-auto`** to `table-container` for responsive horizontal scrolling on mobile.
> - **Removed `hover:shadow-xl`** — tables are data displays, not interactive cards. Shadow escalation on hover is misleading.
> - **Used `transition-[box-shadow]`** instead of `transition-shadow` or `transition-all`.

**Key changes from current:**
- `table-container`: `rounded-xl` → `rounded-2xl`, `shadow-sm` → `shadow-lg`, `border-slate-200` → `border-slate-100`, added `overflow-x-auto`
- `table-header`: flat `bg-slate-50` → gradient `from-slate-50 to-white`
- `th`: `px-3 py-3` → `px-4 py-3.5`, `tracking-wide` → `tracking-wider`
- NEW `table-cell` and `expand-panel`

### 7.3 New Modal CSS

```scss
/* Inside @layer components: */
.modal-backdrop {
  @apply fixed inset-0 flex items-center justify-center;
  z-index: var(--z-modal-backdrop);
  background: rgba(0, 0, 0, 0.5);
}
.glass-panel {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  z-index: var(--z-modal);
  @apply rounded-xl shadow-2xl;
}
.modal-header-gradient {
  background: linear-gradient(135deg, theme('colors.teal.700') 0%, theme('colors.teal.500') 50%, theme('colors.teal.600') 100%);
  @apply relative overflow-hidden px-6 py-4 flex items-center justify-between rounded-t-xl;
}
```

> **Changes from original plan:**
> - **Z-index uses CSS variables** (`var(--z-modal-backdrop)`, `var(--z-modal)`) instead of hardcoded `z-50`.
> - **Removed `modal-shimmer`** — perpetual shimmer animation not appropriate for modal headers.
> - **Used `theme()`** references in gradient instead of hardcoded hex.

### 7.4 ConfirmDialogService API (with ARIA)

```typescript
interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;     // default 'Confirm'
  cancelLabel?: string;      // default 'Cancel'
  variant?: 'danger' | 'default';
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  // ... signal-based state
}

// Usage:
const confirmed = await this.#confirm.confirm({
  title: 'Delete Course',
  message: 'This action cannot be undone.',
  confirmLabel: 'Yes, Delete',
  variant: 'danger',
});
if (!confirmed) return;
```

> **`providedIn: 'root'` is mandatory** — service must be singleton. Without it, DI fails when injected across lazy-loaded feature modules.

### 7.5 ConfirmDialog ARIA Requirements

The `ConfirmDialogComponent` template MUST include these accessibility attributes:

```html
<div class="modal-backdrop" (click)="cancel()" role="presentation">
  <div class="glass-panel w-full max-w-md mx-4"
       role="dialog"
       aria-modal="true"
       [attr.aria-labelledby]="'confirm-dialog-title'"
       (click)="$event.stopPropagation()">
    <div class="modal-header-gradient">
      <h2 id="confirm-dialog-title" class="text-lg font-semibold text-white">{{ config().title }}</h2>
    </div>
    <div class="p-6">
      <p class="text-sm text-slate-600">{{ config().message }}</p>
    </div>
    <div class="px-6 pb-6 flex justify-end gap-3">
      <button class="btn-secondary" (click)="cancel()" #cancelBtn>{{ config().cancelLabel }}</button>
      <button [class]="config().variant === 'danger' ? 'btn-danger-solid' : 'btn-primary'"
              (click)="confirm()">{{ config().confirmLabel }}</button>
    </div>
  </div>
</div>
```

**Focus management:** On open, focus moves to the cancel button (`#cancelBtn`). Tab key cycles within the dialog (focus trap). On close, focus returns to the triggering element.

### 7.6 Table Cell Migration (11 components, 69 td elements)

Each `<td class="px-3 py-3 text-slate-600 ...">` becomes `<td class="table-cell ...">`

Components: teaching-overview, staleness-dashboard, content-management, exam-grading, questions-board, issue-management, user-management, access-request, progress-dashboard, tenant-management, lecturer-assignment

### 7.7 Checklist

- [ ] Update `.table-container` (independent, `overflow-x-auto`, no `hover:shadow-xl`)
- [ ] Update `.table-header` (gradient), `.th` (wider padding + tracking)
- [ ] Add `.table-cell`, `.expand-panel`
- [ ] Add `.modal-backdrop` (using `var(--z-modal-backdrop)`), `.glass-panel` (using `var(--z-modal)`)
- [ ] Add `.modal-header-gradient` (using `theme()` references)
- [ ] Use z-index CSS variables throughout — no hardcoded z-index values
- [ ] Migrate 69 inline td styles → `.table-cell` across 11 files
- [ ] Migrate expand panel backgrounds → `.expand-panel` across 10 files
- [ ] Create `ConfirmDialogService` (`providedIn: 'root'`) + spec (~5 tests)
- [ ] Create `ConfirmDialogComponent` with full ARIA (`role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap) + spec (~8 tests)
- [ ] Add `<app-confirm-dialog />` to `MainLayoutComponent`
- [ ] Migrate `quiz-form.component.ts` `confirm()` → `ConfirmDialogService`
- [ ] Run tests, build OK

---

## 8. Phase S7 — Animations + Page-Level Polish

**Goal:** page-enter animation on all 22 routed page components, toast/notification animations. Comprehensive `prefers-reduced-motion` coverage.

**Depends on:** Phase S1 (animation classes defined).

### 8.1 All 22 Page Components Getting `page-enter`

| # | Component | File path |
|---|-----------|-----------|
| 1 | DashboardComponent | `features/dashboard/dashboard.component.ts` |
| 2 | CourseListPageComponent | `features/courses/pages/course-list-page.component.ts` |
| 3 | CourseFormPageComponent | `features/courses/pages/course-form-page.component.ts` |
| 4 | CourseDetailPageComponent | `features/courses/pages/course-detail-page.component.ts` |
| 5 | ModuleFormPageComponent | `features/courses/pages/module-form-page.component.ts` |
| 6 | ModuleViewerPageComponent | `features/courses/pages/module-viewer-page.component.ts` |
| 7 | MyQuestionsPageComponent | `features/questions/pages/my-questions-page.component.ts` |
| 8 | MyIssuesPageComponent | `features/issues/pages/my-issues-page.component.ts` |
| 9 | NotificationListPageComponent | `features/notifications/pages/notification-list-page.component.ts` |
| 10 | ProfilePageComponent | `features/profile/pages/profile-page.component.ts` |
| 11 | TeachingOverviewPageComponent | `features/teaching/pages/teaching-overview-page.component.ts` |
| 12 | ExamGradingPageComponent | `features/teaching/pages/exam-grading-page.component.ts` |
| 13 | QuestionsBoardPageComponent | `features/teaching/pages/questions-board-page.component.ts` |
| 14 | IssueManagementPageComponent | `features/teaching/pages/issue-management-page.component.ts` |
| 15 | StalenessDashboardPageComponent | `features/teaching/pages/staleness-dashboard-page.component.ts` |
| 16 | UserManagementPageComponent | `features/admin/pages/user-management-page.component.ts` |
| 17 | AccessRequestPageComponent | `features/admin/pages/access-request-page.component.ts` |
| 18 | ProgressDashboardPageComponent | `features/analytics/pages/progress-dashboard-page.component.ts` |
| 19 | TenantManagementPageComponent | `features/platform/pages/tenant-management-page.component.ts` |
| 20 | LecturerAssignmentPageComponent | `features/platform/pages/lecturer-assignment-page.component.ts` |
| 21 | ContentManagementPageComponent | `features/platform/pages/content-management-page.component.ts` |
| 22 | StubPageComponent | `shared/components/stub-page.component.ts` |

**Change per file:** `host: { class: 'block' }` → `host: { class: 'block page-enter' }`

**NOT included:** Login, ResetPassword, AccessRequest, AuthCallback (separate auth layout).

### 8.2 Toast + Notification Animations

- `ToastContainerComponent` — add `toast-enter` class to each toast div
- `MainLayoutComponent` — add `notification-enter` class to realtime notification toast div

### 8.3 Animation Policy

**Entrance-only animations.** No perpetual/infinite animations anywhere in the app:

| Animation | Type | Duration | Used On |
|-----------|------|----------|---------|
| `page-enter` | Entrance | 0.3s once | 22 page components |
| `toast-slide-in` | Entrance | 0.2s once | Toast notifications |
| `notification-slide-in` | Entrance | 0.2s once | Realtime notification popup |

All animations are automatically disabled by the global `prefers-reduced-motion` rule (Phase S1).

### 8.4 Checklist

- [ ] Add `page-enter` to `host.class` on all 22 components
- [ ] Add `toast-enter` to toast container divs
- [ ] Add `notification-enter` to realtime notification toast
- [ ] Verify `prefers-reduced-motion` covers all animations (from S1)
- [ ] Add 1 canary test verifying `page-enter` class on host
- [ ] Run tests, build OK
- [ ] Visual: slide-up animation on route navigation, toast slide-in from right

---

## 9. Phase S8 — Login + Brand Identity Redesign

**Goal:** Premium dark-themed auth pages, glass card, dark inputs with proper contrast, gradient button extending btn-base, branded "X" typography.

**Depends on:** Phase S4 (glass-panel concept), Phase S1 (animations).

### 9.1 New Auth CSS Classes

```scss
/* Inside @layer components: */

.auth-background {
  @apply min-h-screen flex items-center justify-center px-4;
  background: linear-gradient(135deg,
    theme('colors.slate.900') 0%,
    theme('colors.slate.800') 50%,
    theme('colors.slate.900') 100%);
}
.auth-card {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  @apply rounded-2xl shadow-2xl p-8;
}
.auth-input {
  @apply w-full rounded-lg px-4 py-3 text-sm text-white
         transition-[border-color,box-shadow] duration-200;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(100, 116, 139, 0.4);
}
.auth-input:focus {
  border: 2px solid theme('colors.teal.500');
  box-shadow: 0 0 0 3px rgba(20,184,166,0.15), 0 0 15px rgba(20,184,166,0.1);
  outline: none;
}
.auth-input::placeholder {
  @apply text-slate-400;
  /* NOTE: text-slate-400 (not text-slate-500) for WCAG contrast ratio ≥ 3:1 on dark background.
     slate-500 on rgba(15,23,42,0.8) = 2.0:1 contrast — FAILS WCAG AA.
     slate-400 on rgba(15,23,42,0.8) = 3.2:1 contrast — PASSES. */
}
.auth-input:disabled { @apply opacity-50 cursor-not-allowed; }
.auth-btn-primary {
  @apply btn-base w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white;
  background: linear-gradient(135deg, theme('colors.teal.500'), theme('colors.teal.600'));
  box-shadow: 0 4px 14px rgba(15, 118, 110, 0.35);
  /* Extends btn-base for consistent focus ring, disabled state, active:scale-95 */
}
.auth-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(15, 118, 110, 0.5);
}
.auth-btn-primary:active:not(:disabled) { transform: scale(0.98); }
.auth-label { @apply block text-sm font-medium text-slate-600 mb-1.5; }
```

> **Changes from original plan:**
> - **All auth classes moved inside `@layer components`** — no reason for them to be unlayered.
> - **`auth-input::placeholder` uses `text-slate-400`** (not `text-slate-500`). Original had 2.0:1 contrast ratio on dark background — FAILS WCAG AA (minimum 3:1 for placeholder text). `text-slate-400` achieves 3.2:1.
> - **`auth-btn-primary` extends `btn-base`** for consistent focus ring, disabled state, and `active:scale-95`. Previously defined these independently, creating a 4th focus ring implementation.
> - **Used `theme()`** references throughout instead of hardcoded hex values.
> - **Used explicit `transition-[border-color,box-shadow]`** instead of `transition-all`.
> - **Gradient uses `teal-500` → `teal-600`** (not `teal-500` → `teal-600` with hardcoded hex). Ensures white text has sufficient contrast on gradient.

### 9.2 Shared Shimmer Overlay (if needed later)

If shimmer overlays are ever needed, consolidate into one shared class:

```scss
/* Deferred — add only if/when shimmer is actually used: */
.shimmer-overlay {
  @apply absolute inset-0 pointer-events-none;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
  /* Use only as entrance animation, never infinite */
}
```

### 9.3 Brand Typography Pattern

```html
<!-- Auth pages (on dark bg, above card): -->
<h1 class="text-5xl font-bold">
  <span class="italic text-teal-400">X</span>
  <span class="text-white">-Courses</span>
</h1>
<p class="text-sm text-slate-400 mt-2">by Calypso Commodities</p>

<!-- Sidebar (on white bg — done in S2): -->
<span class="text-xl font-bold" aria-label="X-Courses">
  <span class="italic text-teal-600">X</span>
  <span class="text-slate-900">-Courses</span>
</span>

<!-- Header breadcrumb (on white bg — done in S3): -->
<span class="italic font-semibold text-teal-600">X</span>
<span class="font-semibold text-gray-800">-Courses</span>
```

**Rule:** "X" is ALWAYS italic, bold, teal. "-Courses" is non-italic, same weight, neutral. Teal shade: lighter (400) on dark bg, darker (600) on light bg.

### 9.4 Checklist

- [ ] Add 6 auth CSS classes to `styles.scss` inside `@layer components`
- [ ] Use `theme()` references — no hardcoded hex values
- [ ] Verify `auth-input::placeholder` contrast: `text-slate-400` (≥ 3:1 on dark bg)
- [ ] Verify `auth-btn-primary` extends `btn-base` (shared focus ring, disabled, active states)
- [ ] Redesign login page: auth-background, auth-card, auth-input, auth-btn-primary, brand mark above card
- [ ] Redesign reset-password page: same treatment
- [ ] Redesign access-request page: same treatment
- [ ] Redesign auth-callback: dark background, adapted spinner/text
- [ ] Remove `GraduationCap` from auth page imports
- [ ] Run tests, build OK (brand text test fix already done in S2)
- [ ] Visual: dark gradient login, glass card, teal glow on input focus, gradient button, placeholder readable

---

## 10. Phase S9 — Final Cleanup + Documentation Sweep

**Goal:** Migrate remaining inline badge/card patterns, replace `transition-all` across codebase, documentation update, final visual audit.

**Depends on:** All previous phases.

### 10.1 Badge Cleanup

| Component | Current | Migration |
|-----------|---------|-----------|
| `my-questions-page` | `statusBadgeClass()` builds inline badge CSS | Use `StatusBadgeComponent` or direct `.badge-*` |
| `my-issues-page` | `statusBadgeClass()` builds inline badge CSS | Same |
| `profile-page` | `roleStyle()` returns inline badge colors | Use `.badge-*` classes |

### 10.2 `transition-all` Replacement Sweep

Replace all remaining `transition-all` occurrences (~104) with explicit property lists:

```
transition-all duration-200 → transition-[background-color,border-color,box-shadow,color] duration-200
transition-all duration-300 → transition-[width,transform] duration-300
```

Each replacement should list only the properties that actually change on that element.

### 10.3 Inline Teal Reference Audit

~153 inline `teal-*` references exist in templates. Most are intentional (layout-specific one-offs), but audit for any that should use @apply classes instead.

### 10.4 Documentation Update

- [ ] Update `CLAUDE.md` Styling section with new classes and patterns
- [ ] Update `MEMORY.md` with design system migration status
- [ ] Document z-index hierarchy in code comments
- [ ] Document animation policy (entrance-only, no perpetual)

### 10.5 Checklist

- [ ] Migrate inline badge methods → @apply badge classes (3 components)
- [ ] Replace ~104 `transition-all` occurrences with explicit property transitions
- [ ] Audit ~153 inline teal references for consolidation opportunities
- [ ] Update `CLAUDE.md` with new @apply classes and patterns
- [ ] Update `MEMORY.md`
- [ ] Visual audit all 25 routed pages for remaining inline patterns
- [ ] Run full test suite, confirm build OK

---

## 11. Summary Statistics

| Metric | Count |
|--------|-------|
| Total phases | 9 |
| New files to create | ~8 (SidebarService + spec + mock, ConfirmDialogService + spec, ConfirmDialogComponent + spec, favicon.svg) |
| Files to modify | ~55 |
| New @apply/CSS classes | ~40 (3 sidebar + 5 card + 6 button + 12 missing patterns + 2 table + 3 modal + 6 auth + animation + skip-nav) |
| Modified @apply classes | ~12 (7 buttons, 4 tables, page-title) |
| New CSS custom properties | ~15 (colors, shadows, z-index scale, transitions) |
| New @keyframes | 3 (page-enter, toast-slide-in, notification-slide-in) |
| Removed from plan (decorative excess) | 5 (x-glow, sidebar-shimmer, modal-shimmer, shimmer-sweep infinite, btn-accent/btn-warning) |
| New tests (estimated) | ~50 |
| Components needing `page-enter` | 22 |
| Components needing `table-cell` migration | 11 (69 `<td>` elements) |
| Components needing card class migration | ~16 |
| Inline `focus:outline-none` removals | ~40 |
| Inline button replacements | 7 |
| `transition-all` replacements | ~104 |
| Accessibility fixes | 8 (skip-nav, ARIA menu, focus indicators, placeholder contrast, reduced-motion, z-index, dialog ARIA, btn-link focus) |

### Recommended Phase Execution Order

Based on test breakage risk analysis and dependency mapping:

```
S1 (Foundation) ← FIRST: tokens, vars, reduced-motion, skip-nav
│
├── S4 (Cards) ← independent, LOW risk
├── S5 (Buttons + Missing Patterns) ← independent, LOW risk
├── S7 (Animations) ← needs S1, LOW risk (host class only)
│
├── S9 (Cleanup) ← can start early, ongoing
│
├── S2 (Sidebar) ← HIGH risk: brand text split + SidebarService DI
│   │   Do brand text test fix IMMEDIATELY in this phase.
│   │
│   └── S3 (Header) ← needs S2 h-14, MEDIUM risk: new signals
│
├── S6 (Tables + Modals) ← needs S1 z-index, MEDIUM risk: ConfirmDialogService DI
│
└── S8 (Login) ← LAST: standalone auth redesign, LOW risk (isolated pages)
```

**Rationale:** S1 → S4 → S5 → S7 → S9 → S2 → S3 → S6 → S8
- Start with zero-risk CSS-only phases (S1, S4, S5)
- Do animation (S7) early — simple `host.class` changes
- Start cleanup (S9) early and continue throughout
- Defer S2 (sidebar) until other phases are stable — it has the highest test breakage risk (brand text split)
- S3 depends on S2; S6 needs z-index vars from S1
- S8 (login) last — completely isolated, zero coupling to other phases

### Phase Dependencies (Corrected)

```
S1 (Foundation)
├── S2 (Sidebar) ← needs :root z-index vars
│   └── S3 (Header) ← needs sidebar h-14 alignment
├── S6 (Tables+Modals) ← needs :root z-index vars
├── S7 (Animations) ← needs page-enter class
└── S8 (Login) ← needs animation tokens

S4 (Cards) ← independent
S5 (Buttons+Patterns) ← independent
S9 (Cleanup) ← after all phases (but can start incrementally)
```

### Phase Completion Status

| Phase | Status | Tests After | Key Changes |
|-------|--------|-------------|-------------|
| **S1 — Foundation** | **DONE** | 1455 | CSS tokens, Inter font, favicon, p-3/p-4 padding, 20 page p-6 removals, 3 page-title migrations |
| **S4 — Cards** | **DONE** | 1455 | 5 new CSS classes, ~16 component card migrations |
| **S2 — Sidebar** | **DONE** | 1465 | SidebarService + mock + 5 tests, 3 CSS classes, template rewrite, brand text split, keyboard shortcut |
| **S3 — Header** | **DONE** | 1479 | Breadcrumb (ROUTE_NAME_MAP), ARIA, role label, user menu redesign, h-14, 15 new tests |
| S5 — Buttons | Pending | — | btn-base, btn-sm, btn-icon-danger, 12 missing patterns |
| S6 — Tables + Modals | Pending | — | table-cell, expand-panel, ConfirmDialogService |
| S7 — Animations | Pending | — | page-enter on 22 pages, toast/notification animations |
| S8 — Login | Pending | — | Dark auth pages, auth-input, auth-btn-primary |
| S9 — Cleanup | Pending | — | transition-all sweep, badge cleanup, documentation |

### Verification Strategy (Per Phase)

1. `npx vitest run` — all tests pass (1479 baseline after S1-S4)
2. `ng build` — production build succeeds
3. Visual smoke test of affected pages in browser
4. Key interaction tests: focus rings, hover states, animations, collapse toggle
5. **Accessibility audit:** Tab navigation, screen reader announcements, contrast ratios

---

## 12. Not Applicable to X-Courses

These Calypso Design System features are specific to the X-Crude trading platform and do **not** apply to the X-Courses LMS:

- AI Chat button + panel (Sparkles icon, keyboard shortcut, side panel)
- Heatmap colors and trade direction colors (Long=Blue / Short=Purple)
- KPI banners with teal gradient backgrounds
- Cost breakdown lists (Charter, Fuel, Boil-off categories)
- Trade cells with source/destination arrows
- Vessel badges with gradient borders
- Month/category color coding (JAN=Blue, MAR=Green, etc.)
- Mini distribution charts
- Voyage timeline component
- Custom select dropdown (portal-based) — X-Courses uses native `<select>`
- Three-panel layout (sidebar + main + detail panel)
- Day selector heatmap
- Nomination status badges
- Spread display (+/- formatting)
- **Perpetual animations** (shimmer-sweep, x-glow) — appropriate for trading dashboards showing live data, not for a learning management system
