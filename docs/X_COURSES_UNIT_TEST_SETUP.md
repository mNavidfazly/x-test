# X-Courses Unit Test & RLS Test Setup

Complete reference for the frontend unit testing approach (Vitest + Testing Library + Angular 19) and the Supabase RLS policy test infrastructure.

---

## Table of Contents

### Part 1: Frontend Unit Tests
1. [Test Stack & Configuration](#1-test-stack--configuration)
2. [Test Setup File](#2-test-setup-file)
3. [Mock Factories](#3-mock-factories)
4. [Component Test Patterns](#4-component-test-patterns)
5. [Service Test Patterns](#5-service-test-patterns)
6. [Signal Testing](#6-signal-testing)
7. [Async Testing Patterns](#7-async-testing-patterns)
8. [Debounce & Timer Testing](#8-debounce--timer-testing)
9. [Router Testing](#9-router-testing)
10. [@defer Block Testing](#10-defer-block-testing)
11. [Module-Level Mocking (vi.mock)](#11-module-level-mocking-vimock)
12. [Test Organization & Counts](#12-test-organization--counts)
13. [Key Gotchas](#13-key-gotchas)

### Part 2: RLS Policy Tests
14. [RLS Test Stack & Configuration](#14-rls-test-stack--configuration)
15. [Test Infrastructure (setup.ts)](#15-test-infrastructure-setupts)
16. [Role Simulation](#16-role-simulation)
17. [RLS Test Patterns](#17-rls-test-patterns)
18. [Test Execution & CI](#18-test-execution--ci)
19. [Coverage & Inventory](#19-coverage--inventory)
20. [RLS Test Gotchas](#20-rls-test-gotchas)

---

# Part 1: Frontend Unit Tests

## 1. Test Stack & Configuration

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^3.2.4 | Test runner |
| `@analogjs/vite-plugin-angular` | ^2.2.3 | Angular compilation in Vite |
| `@analogjs/vitest-angular` | ^2.2.3 | Angular–Vitest bridge |
| `@testing-library/angular` | ^17.4.0 | Component testing (render, screen, queries) |
| `@testing-library/user-event` | ^14.6.1 | Realistic user interaction simulation |
| `jsdom` | ^27.0.1 | DOM environment |

### Vitest Config

File: `frontend/vitest.config.mts`

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig(({ mode }) => ({
  plugins: [angular()],
  test: {
    globals: true,
    setupFiles: ['src/test-setup.mjs'],
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
}));
```

### NPM Scripts

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

---

## 2. Test Setup File

File: `frontend/src/test-setup.mjs` (**MUST be `.mjs` — `.ts` fails**)

```javascript
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';

import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
```

---

## 3. Mock Factories

All mocks live in `frontend/src/app/__mocks__/` (21 files). Every mock follows the same pattern:

### Pattern: Service Mock with Writable Signals

```typescript
// Example: createMockAuthService()
export function createMockAuthService(options?: {
  isAuthenticated?: boolean;
  user?: Partial<User>;
}) {
  const currentUser = signal<User | null>(options?.user ?? mockUser);
  const loading = signal(false);

  return {
    // Public signals (readonly to consumers)
    currentUser: currentUser.asReadonly(),
    loading: loading.asReadonly(),
    isAuthenticated: computed(() => !!currentUser()),

    // Methods
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),

    // Test helpers (prefixed with _)
    _setUser: (u: User | null) => currentUser.set(u),
    _setLoading: (l: boolean) => loading.set(l),
  };
}

export type MockAuthService = ReturnType<typeof createMockAuthService>;
```

### Pattern: Component Mock

```typescript
// Example: MockLucideIconComponent
@Component({
  selector: 'lucide-icon',
  standalone: true,
  template: '<span data-testid="lucide-icon"></span>',
})
export class MockLucideIconComponent {
  img = input<any>();
  size = input<number>();
}
```

### Pattern: Domain Factory with Partial Overrides

```typescript
export function createMockCourseWithProgress(
  overrides?: Partial<CourseWithProgress>
): CourseWithProgress {
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course',
    totalModules: 10,
    completedModules: 3,
    progressPercent: 30,
    // ... more defaults
    ...overrides,
  };
}
```

### Complete Mock Inventory

| File | What It Exports |
|------|----------------|
| `api.mock.ts` | `createMockApiService()` — mocks `get`/`post` returning `of(null)` |
| `audio-player.mock.ts` | `createMockAudioPlayerService()` — signals for playback state |
| `audio-viewer.mock.ts` | `MockAudioViewerComponent` — standalone mock component |
| `auth.mock.ts` | `createMockAuthService()` — signals + computed roles + `_set*` helpers |
| `confirm-dialog.mock.ts` | `createMockConfirmDialogService()` — `confirm()` resolves to `true` |
| `content-management.mock.ts` | `createMockContentManagementService()` + domain factories |
| `course.mock.ts` | **Largest (~44KB).** `createMockCourseService()` + 20+ domain factories |
| `knowledge-check.mock.ts` | `createMockKnowledgeCheckService()` + question/form factories |
| `lucide.mock.ts` | `MockLucideIconComponent` — replaces `lucide-icon` in tests |
| `pdf-viewer.mock.ts` | `MockPdfViewerComponent` — signal inputs + `pageChange` output |
| `posthog.mock.ts` | `createMockPosthogService()` |
| `profile.mock.ts` | `createMockProfileService()` |
| `router.mock.ts` | `createMockRouter()` — mocks `navigate`, `url`, `events` |
| `sidebar.mock.ts` | `createMockSidebarService()` |
| `supabase.mock.ts` | `createMockSupabaseService()` — chainable query builder, auth, storage, rpc, channel |
| `tenant.mock.ts` | `createMockTenantService()` |
| `tiptap.mock.ts` | `MockTiptapEditorComponent` — textarea that emits `contentChange` |
| `toast.mock.ts` | `createMockToastService()` |
| `xp.mock.ts` | `createMockXpService()` — XP signals + level computation |
| `xp-animation.mock.ts` | `createMockXpAnimationService()` |

### Supabase Mock (Core)

The Supabase mock provides a chainable query builder that mimics the real client:

```typescript
const supabase = createMockSupabaseService();

// Set the response for the next query
supabase._mockQueryResponse([{ id: '1', title: 'Course 1' }]);

// The service under test calls:
// this.#supabase.client.from('courses').select('*').eq('tenant_id', id)
// → returns the mocked data

// Reset between tests
supabase._resetMocks();
```

For multiple sequential queries, use a counter pattern:

```typescript
let callCount = 0;
supabase._mockQueryBuilder.then.mockImplementation((resolve) => {
  callCount++;
  switch (callCount) {
    case 1: return resolve({ data: coursesData, error: null });
    case 2: return resolve({ data: modulesData, error: null });
  }
});
```

---

## 4. Component Test Patterns

### Page Component (Smart) — Full Example

```typescript
import { render, screen, fireEvent } from '@testing-library/angular';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockRouter } from '../../../__mocks__/router.mock';
import { CourseListPageComponent } from './course-list-page.component';

describe('CourseListPageComponent', () => {
  async function renderPage(options?: {
    courses?: CourseWithProgress[];
    loading?: boolean;
  }) {
    const courseService = createMockCourseService();
    const auth = createMockAuthService({ isAuthenticated: true });
    const router = createMockRouter();

    if (options?.courses) {
      courseService._setCourses(options.courses);
    }
    if (options?.loading !== undefined) {
      courseService._setLoading(options.loading);
    }

    const result = await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, RouterLink],
      providers: [
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        provideRouter([]),
      ],
    });

    // Flush async ngOnInit
    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, courseService, auth, router };
  }

  it('should show loading spinner while loading', async () => {
    await renderPage({ loading: true });
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('should display courses', async () => {
    const courses = [
      createMockCourseWithProgress({ title: 'Angular Basics' }),
      createMockCourseWithProgress({ title: 'TypeScript Deep Dive' }),
    ];
    await renderPage({ courses });

    expect(screen.getByText('Angular Basics')).toBeTruthy();
    expect(screen.getByText('TypeScript Deep Dive')).toBeTruthy();
  });

  it('should show empty state when no courses', async () => {
    await renderPage({ courses: [] });
    expect(screen.getByText('No courses available yet.')).toBeTruthy();
  });

  it('should filter courses by search', async () => {
    vi.useFakeTimers();
    const courses = [
      createMockCourseWithProgress({ title: 'Angular Basics' }),
      createMockCourseWithProgress({ title: 'Python 101', id: 'py' }),
    ];
    const { fixture } = await renderPage({ courses });

    const searchInput = screen.getByPlaceholderText('Search courses...');
    fireEvent.input(searchInput, { target: { value: 'Angular' } });
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    expect(screen.getByText('Angular Basics')).toBeTruthy();
    expect(screen.queryByText('Python 101')).toBeNull();
    vi.useRealTimers();
  });
});
```

### Presentational Component (Dumb) — Signal Inputs

```typescript
describe('StatCardComponent', () => {
  it('should render label and value', async () => {
    await render(StatCardComponent, {
      componentInputs: {
        label: 'Total Students',
        value: 42,
      },
    });

    expect(screen.getByText('Total Students')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('should apply custom color', async () => {
    await render(StatCardComponent, {
      componentInputs: {
        label: 'Score',
        value: '95%',
        color: 'text-teal-600',
      },
    });

    const value = screen.getByText('95%');
    expect(value.classList.contains('text-teal-600')).toBe(true);
  });
});
```

### Key Render Options

```typescript
await render(MyComponent, {
  // Replace ALL component imports (must include every child component/directive/pipe)
  componentImports: [MockLucideIconComponent, RouterLink, DecimalPipe],

  // Set signal inputs
  componentInputs: { courseId: 'abc', title: 'Test' },

  // DI providers
  providers: [
    { provide: CourseService, useValue: createMockCourseService() },
    { provide: Router, useValue: createMockRouter() },
    provideRouter([]),
  ],
});
```

---

## 5. Service Test Patterns

Services use `TestBed.configureTestingModule` directly (not `render()`):

```typescript
describe('NotificationService', () => {
  let service: NotificationService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({ isAuthenticated: true });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should load notifications', async () => {
    const mockNotifs = [
      { id: 'n1', type: 'course_assigned', read: false },
      { id: 'n2', type: 'reminder', read: true },
    ];
    supabase._mockQueryResponse(mockNotifs);

    await service.loadNotifications();

    expect(service.notifications()).toHaveLength(2);
    expect(service.unreadCount()).toBe(1);
  });

  it('should handle errors', async () => {
    supabase._mockQueryResponse(null, { message: 'Network error' });

    await service.loadNotifications();

    expect(service.error()).toBe('Network error');
    expect(service.notifications()).toEqual([]);
  });

  it('should mark notification as read', async () => {
    supabase._mockQueryResponse({ id: 'n1', read: true });

    await service.markAsRead('n1');

    expect(supabase.client.from).toHaveBeenCalledWith('notifications');
  });
});
```

---

## 6. Signal Testing

### Reading Signal Values

```typescript
expect(service.notifications()).toEqual([]);
expect(service.loading()).toBe(false);
expect(service.unreadCount()).toBe(0);
expect(component.isExpanded()).toBe(true);
```

### Mutating Mock Signals (via `_set*` helpers)

```typescript
// Change auth state
auth._setUser(null);
auth._setLoading(false);

// Change service data
mockCourseService._setModuleViewer(viewerData);
mockCourseService._setLoading(true);
mockCourseService._setCourses([course1, course2]);
```

### TestBed.flushEffects()

Triggers Angular `effect()` callbacks synchronously in tests:

```typescript
it('should subscribe to realtime on login', () => {
  auth._setUser(mockUser);
  TestBed.flushEffects();  // triggers the effect that subscribes to realtime

  expect(supabase.client.channel).toHaveBeenCalledWith('notifs-user-1');
});
```

### TestBed.runInInjectionContext()

For testing functions that require Angular injection context (guards, utilities):

```typescript
it('should debounce signal changes', () => {
  vi.useFakeTimers();

  TestBed.runInInjectionContext(() => {
    const source = signal('hello');
    const debounced = debouncedSignal(source, 300);

    expect(debounced()).toBe('hello');

    source.set('world');
    TestBed.flushEffects();
    expect(debounced()).toBe('hello');  // still old value

    vi.advanceTimersByTime(300);
    expect(debounced()).toBe('world');  // debounced value updated
  });

  vi.useRealTimers();
});
```

---

## 7. Async Testing Patterns

### Flushing Async ngOnInit

The standard pattern for zoneless components with async initialization:

```typescript
const { fixture } = await renderPage();

// Flush async operations (ngOnInit, effect callbacks, Promises)
await new Promise(r => setTimeout(r));
fixture.detectChanges();

expect(screen.getByText('Course Title')).toBeTruthy();
```

This appears in virtually every page component test.

### Testing Promise States (loading → success)

```typescript
it('should show saving indicator then saved', async () => {
  let resolvePromise: () => void;
  mockService.saveNotes = vi.fn().mockImplementation(
    () => new Promise<void>(resolve => { resolvePromise = resolve; })
  );

  // Trigger save
  fireEvent.input(textarea, { target: { value: 'New notes' } });
  vi.advanceTimersByTime(1500);  // debounce delay
  fixture.detectChanges();

  expect(screen.getByText('Saving...')).toBeTruthy();

  // Resolve the promise
  resolvePromise!();
  await vi.advanceTimersByTimeAsync(0);
  fixture.detectChanges();

  expect(screen.getByText('Saved')).toBeTruthy();
});
```

### waitFor (from Testing Library)

Used sparingly, primarily for multi-step auth flows:

```typescript
await waitFor(() => {
  expect(screen.getByLabelText('Password')).toBeTruthy();
});
```

---

## 8. Debounce & Timer Testing

### Basic Pattern

```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it('should debounce search input', () => {
  const searchInput = screen.getByPlaceholderText('Search...');
  fireEvent.input(searchInput, { target: { value: 'Bob' } });
  fixture.detectChanges();

  // Not yet filtered
  expect(screen.getByText('Alice')).toBeTruthy();

  vi.advanceTimersByTime(300);
  fixture.detectChanges();

  // Now filtered
  expect(screen.queryByText('Alice')).toBeNull();
  expect(screen.getByText('Bob')).toBeTruthy();
});
```

### Signal Debounce (Double-Flush Pattern)

When testing `debouncedSignal()`, effects need to be flushed twice through the signal chain:

```typescript
it('should auto-save after debounce', () => {
  vi.useFakeTimers();

  fixture.componentInstance.onInput('New notes');
  fixture.detectChanges();
  TestBed.flushEffects();           // 1st flush: source signal → debounced signal

  vi.advanceTimersByTime(2000);     // advance past debounce delay
  fixture.detectChanges();
  TestBed.flushEffects();           // 2nd flush: debounced signal → save effect

  fixture.detectChanges();
  TestBed.flushEffects();           // Extra flush for save state propagation

  expect(mockService.saveNotes).toHaveBeenCalledWith('mod-42', 'New notes');
  vi.useRealTimers();
});
```

### Async Timer Testing

For Promise-based code that uses timers:

```typescript
it('should reload XP after animation', async () => {
  vi.useFakeTimers();

  service.triggerXpGain(10);
  await vi.advanceTimersByTimeAsync(3000);

  expect(mockXp.loadXp).toHaveBeenCalledWith(true);
  vi.useRealTimers();
});
```

---

## 9. Router Testing

### Providing Router

```typescript
// Most common — empty router for components that use routerLink
providers: [provideRouter([])]

// RouterLink must be in componentImports when used in template
componentImports: [MockLucideIconComponent, RouterLink]
```

### Mocking ActivatedRoute (for paramMap)

```typescript
let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

beforeEach(() => {
  paramMap$ = new BehaviorSubject(
    convertToParamMap({ courseId: 'course-1', moduleId: 'mod-1' })
  );
});

// In render providers:
{ provide: ActivatedRoute, useValue: { paramMap: paramMap$ } }

// Simulate navigation in test:
paramMap$.next(convertToParamMap({ courseId: 'course-1', moduleId: 'mod-2' }));
await new Promise(r => setTimeout(r));
fixture.detectChanges();
```

### Link Assertions

```typescript
const link = screen.getByRole('link', { name: /continue/i });
expect(link.getAttribute('href')).toBe('/courses/abc-123/modules/mod-5');
```

### Guard Testing

```typescript
function runGuard(authOptions: any, ...requiredRoles: string[]) {
  const auth = createMockAuthService(authOptions);
  const router = createMockRouter();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ],
  });

  const guard = roleGuard(...requiredRoles);
  return {
    result: TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ),
    router,
  };
}

it('should allow platform admin', () => {
  const { result } = runGuard({ isPlatformAdmin: true }, 'platform_admin');
  expect(result).toBe(true);
});

it('should redirect unauthorized user', () => {
  const { result, router } = runGuard({ isPlatformAdmin: false }, 'platform_admin');
  expect(result).toBe(false);
  expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
});
```

---

## 10. @defer Block Testing

Only used in `module-viewer-page.component.spec.ts`:

```typescript
import { DeferBlockState } from '@angular/core/testing';

it('should render deferred ask-expert component', async () => {
  const viewer = createMockModuleViewerData();
  const { fixture } = await renderPage({ viewer });

  // Get all @defer blocks in the template
  const deferBlocks = await fixture.getDeferBlocks();

  // Render each block in its Complete state
  for (const block of deferBlocks) {
    await block.render(DeferBlockState.Complete);
  }

  expect(document.querySelector('app-ask-expert')).toBeTruthy();
});
```

---

## 11. Module-Level Mocking (vi.mock)

Used for 3rd-party libraries that need complete replacement:

### WaveSurfer.js

```typescript
vi.mock('wavesurfer.js', () => {
  const mockWs = {
    play: vi.fn(),
    pause: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    getDuration: vi.fn(() => 300),
    getCurrentTime: vi.fn(() => 0),
    setVolume: vi.fn(),
    seekTo: vi.fn(),
  };
  return { default: { create: vi.fn(() => mockWs) } };
});

// To trigger WaveSurfer callbacks in tests:
async function triggerWaveSurferReady(fixture: ComponentFixture<any>) {
  const mockCreate = (await import('wavesurfer.js')).default.create;
  const mockWs = mockCreate.mock.results[0]?.value;
  const readyCall = mockWs.on.mock.calls.find(
    (c: any[]) => c[0] === 'ready'
  );
  readyCall?.[1]();  // invoke the 'ready' callback
  fixture.detectChanges();
}
```

### PostHog

```typescript
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}));
```

### Supabase Client

```typescript
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));
```

---

## 12. Test Organization & Counts

### File Co-location

Every `.component.ts` or `.service.ts` has a sibling `.spec.ts`:

```
features/courses/components/course-card.component.ts
features/courses/components/course-card.component.spec.ts
features/courses/pages/course-list-page.component.ts
features/courses/pages/course-list-page.component.spec.ts
core/services/notification.service.ts
core/services/notification.service.spec.ts
```

### Test Distribution

| Directory | Spec Files | Content |
|-----------|-----------|---------|
| `features/` | 64 | Pages (21), Components (36), Auth, Dashboard |
| `core/` | 42 | Services (30), Guards (2), Utils (9), Interceptor (1) |
| `shared/` | 13 | All shared components |
| `layout/` | 4 | Sidebar, Header, MiniPlayer, MainLayout |
| Root | 1 | `app.component.spec.ts` |
| **Total** | **124 spec files** | **1,777 tests** |

---

## 13. Key Gotchas

### `componentImports` replaces ALL imports

Must explicitly include every child component, directive, or pipe. Forgetting one causes silent rendering failures:

```typescript
// Component uses {{ value | number:'1.0-0' }} in template
componentImports: [MockLucideIconComponent, RouterLink, DecimalPipe]  // DecimalPipe required!
```

### `provideRouter([])` required for RouterLink

Any component that uses `routerLink` in its template needs this provider, plus `RouterLink` in `componentImports`.

### `vi.fn()` without return value breaks Observable methods

```typescript
// WRONG — subscribe() will throw
loadCourses: vi.fn()

// CORRECT
loadCourses: vi.fn().mockReturnValue(EMPTY)
```

### Adding `inject()` to component breaks parent tests

Angular DI cascades — when you add `inject(NewService)` to a component, every test that renders a parent of that component must now provide `NewService`:

```typescript
// Parent page test now needs this:
providers: [
  { provide: NewService, useValue: createMockNewService() },
]
```

### `getAllByText` vs `getByText`

When text appears in multiple places (summary card + table row, filter dropdown + button):

```typescript
// Throws if text appears twice
screen.getByText('Active');

// Use this instead
screen.getAllByText('Active');
```

### Mock factory default values must differ for search tests

```typescript
// WRONG — can't test search because both have same name
const users = [createMockUser(), createMockUser()];

// CORRECT — give distinct values
const users = [
  createMockUser({ full_name: 'Alice Smith' }),
  createMockUser({ full_name: 'Bob Jones', id: 'user-2' }),
];
```

### JSDOM missing APIs

```typescript
// Mock HTMLElement.animate for animation tests
HTMLElement.prototype.animate = vi.fn().mockReturnValue({
  finished: Promise.resolve(),
  cancel: vi.fn(),
});

// Mock window.matchMedia for reduced motion tests
window.matchMedia = vi.fn().mockReturnValue({ matches: true });
```

### `[class]` binding vs static `class`

```typescript
// WRONG — [class] overrides the static class attribute
template: `<div class="card" [class]="dynamicClass()">`

// CORRECT — use [class.x]="condition" for conditional classes
template: `<div class="card" [class.border-teal-500]="isActive()">`
```

### `static #private` in decorated classes

```typescript
// WRONG — TS18036 error in Angular-decorated classes
@Injectable()
class MyService {
  static #instance = 0;  // Error!
}

// CORRECT — use instance readonly field
@Injectable()
class MyService {
  readonly #counter = 0;
}
```

---

# Part 2: RLS Policy Tests

## 14. RLS Test Stack & Configuration

### Stack

| Tool | Purpose |
|------|---------|
| Vitest 3.x | Test runner (same as frontend, separate config) |
| `@supabase/supabase-js` | Real Supabase client for RLS testing |
| `pg` (node-postgres) | Direct PostgreSQL connection for JWT claim faking |
| `@faker-js/faker` | Random test data generation |
| `dotenv` | Environment variable loading |
| `tsx` | TypeScript execution |

### Vitest Config

File: `vitest.config.ts` (project root, NOT `frontend/`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    pool: 'forks',           // Each file gets its own process
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['dotenv/config'],
    fileParallelism: false,  // Files run sequentially (prevents auth conflicts)
  },
});
```

### NPM Scripts

```json
{
  "test:rls": "tsx scripts/test-runner.ts",
  "test:rls:local": "vitest run --config vitest.config.ts",
  "test:rls:watch": "vitest --config vitest.config.ts"
}
```

### Required Environment Variables

```
SUPABASE_URL=https://ruhdnvtvoxxiodnyyqqf.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:...@db.ruhdnvtvoxxiodnyyqqf.supabase.co:5432/postgres
```

---

## 15. Test Infrastructure (setup.ts)

File: `tests/setup.ts` (~1181 lines). Contains all shared infrastructure.

### Core Clients

```typescript
// Service role client — bypasses RLS entirely (for test setup/cleanup)
export const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Per-user client — real RLS enforcement via password sign-in
export async function createClientAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  return client;
}
```

### Types

```typescript
interface TestUser {
  id: string;
  email: string;
  password: string;
  tenantId: string;
}

interface TestTenant {
  id: string;
  name: string;
  domain: string;
  isMaster: boolean;
}
```

### TestDataTracker

Tracks all created entities for cleanup:

```typescript
class TestDataTracker {
  users: string[] = [];
  tenants: string[] = [];
  courses: string[] = [];
  lectures: string[] = [];
  modules: string[] = [];
  enrollments: string[] = [];
  tenantCourses: string[] = [];
  csmAssignments: string[] = [];
  lecturerAssignments: string[] = [];
  accessRequests: string[] = [];
  reminderHistory: string[] = [];
}
```

### Factory Functions (27 total)

```typescript
// User creation (real auth user via Supabase Admin API)
export async function createUser(
  tracker: TestDataTracker,
  tenantId: string,
  role: 'learner' | 'tenant_admin' | 'platform_admin'
): Promise<TestUser> {
  const email = faker.internet.email();
  const password = 'Test123!@#';

  const { data } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { tenant_id: tenantId },
  });

  tracker.users.push(data.user!.id);

  if (role === 'tenant_admin' || role === 'platform_admin') {
    await setProfileRole(data.user!.id, {
      is_tenant_admin: role === 'tenant_admin',
      is_platform_admin: role === 'platform_admin',
    });
  }

  return { id: data.user!.id, email, password, tenantId };
}

// Content creation
export async function createCourse(tracker, overrides?) { /* ... */ }
export async function createLecture(tracker, courseId, overrides?) { /* ... */ }
export async function createModule(tracker, lectureId, courseId, overrides?) { /* ... */ }
export async function createTenantCourse(tracker, tenantId, courseId) { /* ... */ }

// Enrollment/Progress
export async function createEnrollment(tracker, userId, courseId, tenantId) { /* ... */ }
export async function createUserProgress(tracker, userId, moduleId, courseId, tenantId) { /* ... */ }

// Role assignments
export async function createCSMAssignment(tracker, userId, tenantId) { /* ... */ }
export async function createLecturerAssignment(tracker, userId, courseId, canEdit, canGrade) { /* ... */ }

// Quiz/Exam
export async function createQuizAttempt(tracker, userId, quizId, courseId, tenantId) { /* ... */ }
export async function createExamSubmission(tracker, userId, examId, courseId, tenantId) { /* ... */ }

// Social
export async function createComment(tracker, userId, moduleId, courseId, tenantId) { /* ... */ }
export async function createExpertQuestion(tracker, userId, moduleId, courseId, tenantId) { /* ... */ }
export async function createIssue(tracker, userId, moduleId, courseId, tenantId) { /* ... */ }
```

### Cleanup Function

Deletes data in strict FK dependency order:

```typescript
export async function cleanupTestData(tracker: TestDataTracker) {
  // Phase 1: Notifications, quiz answers
  // Phase 2: Quiz attempts, exam submissions, external quiz results
  // Phase 3: Comments, expert questions, issues
  // Phase 4: User progress, enrollments
  // Phase 5: Content subtables (videos, pdfs, markdown, files, audio, downloads)
  // Phase 6: Modules, lectures, knowledge checks
  // Phase 7: Assignments (CSM, lecturer), tenant_courses, access requests
  // Phase 8: Courses, profiles, auth users, tenants
}
```

### Custom Vitest Matcher

```typescript
expect.extend({
  async toDenyAccess(received: PromiseLike<any>, operation: string) {
    const { data, error } = await received;

    if (operation === 'insert') {
      // INSERT denial = non-null error
      return {
        pass: error !== null,
        message: () => `Expected INSERT to be denied but it succeeded`,
      };
    }

    // SELECT/UPDATE/DELETE denial = empty data array
    return {
      pass: Array.isArray(data) && data.length === 0,
      message: () => `Expected ${operation} to return empty array but got ${JSON.stringify(data)}`,
    };
  },
});
```

Usage:

```typescript
await expect(
  learnerClient.from('courses').select('*').eq('id', courseId)
).toDenyAccess('select');
```

---

## 16. Role Simulation

Tests use **real Supabase authentication** — NOT mocked JWT claims. Users are created via the Admin API, roles are set via direct pg connection, and clients sign in with real passwords.

### Learner (default role)

```typescript
const learner = await createUser(tracker, tenantId, 'learner');
const learnerClient = await createClientAs(learner);
```

### Tenant Admin

```typescript
const tenantAdmin = await createUser(tracker, tenantId, 'tenant_admin');
// createUser internally calls setProfileRole() to set is_tenant_admin = true
const taClient = await createClientAs(tenantAdmin);
```

### Platform Admin (must be on master tenant)

```typescript
const platformAdmin = await createUser(tracker, masterTenantId, 'platform_admin');
const paClient = await createClientAs(platformAdmin);
```

### CSM (must be from master tenant)

```typescript
const csm = await createUser(tracker, masterTenantId, 'learner');
await createCSMAssignment(tracker, csm.id, clientTenantId);  // BEFORE sign-in!
const csmClient = await createClientAs(csm);
```

### Lecturer (must be from master tenant)

```typescript
const lecturer = await createUser(tracker, masterTenantId, 'learner');
await createLecturerAssignment(tracker, lecturer.id, courseId, true, true);  // can_edit, can_grade
const lecturerClient = await createClientAs(lecturer);
```

### The `setProfileRole()` Trick

The `protect_profile_role_fields()` trigger blocks role changes by non-admins. Even the service role client can't change roles because it doesn't set JWT claims. Solution: direct pg connection with faked claims:

```typescript
async function setProfileRole(userId: string, updates: {
  is_tenant_admin?: boolean;
  is_platform_admin?: boolean;
}) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    // Fake JWT claims to satisfy the trigger
    await client.query(
      `SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({
        sub: userId,
        is_platform_admin: true,
        role: 'authenticated',
      })]
    );

    // Build parameterized UPDATE
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (updates.is_tenant_admin !== undefined) {
      setClauses.push(`is_tenant_admin = $${paramIndex++}`);
      values.push(updates.is_tenant_admin);
    }
    if (updates.is_platform_admin !== undefined) {
      setClauses.push(`is_platform_admin = $${paramIndex++}`);
      values.push(updates.is_platform_admin);
    }

    values.push(userId);
    await client.query(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}
```

**Critical:** Role assignments (CSM/Lecturer) must happen BEFORE `createClientAs()` because JWT claims are baked at sign-in time and only refresh on re-authentication (~1hr token lifetime).

---

## 17. RLS Test Patterns

### File Structure

```typescript
describe('comments RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Users
  let learnerA: TestUser;
  let learnerB: TestUser;
  let tenantAdminA: TestUser;
  let platformAdmin: TestUser;
  let csm: TestUser;
  let lecturer: TestUser;

  // Clients (RLS-enforced)
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let taClient: SupabaseClient;
  let paClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // Content
  let courseId: string;
  let moduleId: string;

  // Pre-created test data
  let commentByLearnerA: string;
  let commentByLearnerB: string;

  beforeAll(async () => {
    // 1. Get/create tenants
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, { domain: 'testa.com' });
    tenantB = await createTenant(tracker, { domain: 'testb.com' });

    // 2. Create content
    const course = await createCourse(tracker);
    courseId = course.id;
    const lecture = await createLecture(tracker, courseId);
    const module = await createModule(tracker, lecture.id, courseId);
    moduleId = module.id;

    // 3. Assign course to tenants
    await createTenantCourse(tracker, tenantA.id, courseId);
    await createTenantCourse(tracker, tenantB.id, courseId);

    // 4. Create users
    learnerA = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');

    csm = await createUser(tracker, masterTenant.id, 'learner');
    await createCSMAssignment(tracker, csm.id, tenantA.id);

    lecturer = await createUser(tracker, masterTenant.id, 'learner');
    await createLecturerAssignment(tracker, lecturer.id, courseId, true, true);

    // 5. Create enrollments (required for comment access)
    await createEnrollment(tracker, learnerA.id, courseId, tenantA.id);
    await createEnrollment(tracker, learnerB.id, courseId, tenantB.id);

    // 6. Pre-create test data
    const commentA = await createComment(tracker, learnerA.id, moduleId, courseId, tenantA.id);
    commentByLearnerA = commentA.id;
    const commentB = await createComment(tracker, learnerB.id, moduleId, courseId, tenantB.id);
    commentByLearnerB = commentB.id;

    // 7. Sign in all users (JWT claims baked here)
    learnerAClient = await createClientAs(learnerA);
    learnerBClient = await createClientAs(learnerB);
    taClient = await createClientAs(tenantAdminA);
    paClient = await createClientAs(platformAdmin);
    csmClient = await createClientAs(csm);
    lecturerClient = await createClientAs(lecturer);
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // Tests grouped by operation
  describe('SELECT', () => { /* ... */ });
  describe('INSERT', () => { /* ... */ });
  describe('UPDATE', () => { /* ... */ });
  describe('DELETE', () => { /* ... */ });
});
```

### Test Naming Convention

Every test has a unique prefix-number ID:

```typescript
it('CM-001: Learner can see own tenant comments', async () => { ... });
it('CM-002: Learner cannot see other tenant comments', async () => { ... });
it('CM-005: Tenant Admin can see own tenant comments', async () => { ... });
it('CM-010: Platform Admin can see all comments', async () => { ... });
```

### Assertion: Allowed Access

```typescript
it('CM-001: Learner can see own tenant comments', async () => {
  const { data, error } = await learnerAClient
    .from('comments')
    .select('*')
    .eq('module_id', moduleId);

  expect(error).toBeNull();
  expect(data).not.toBeNull();
  expect(data!.length).toBeGreaterThan(0);
  // Verify only same-tenant comments visible
  expect(data!.every(c => c.tenant_id === tenantA.id)).toBe(true);
});
```

### Assertion: Denied Access (Custom Matcher)

```typescript
it('CM-002: Learner cannot see other tenant comments', async () => {
  await expect(
    learnerAClient
      .from('comments')
      .select('*')
      .eq('id', commentByLearnerB)
  ).toDenyAccess('select');
});
```

### Assertion: INSERT Denied

```typescript
it('CM-015: CSM cannot insert comments', async () => {
  await expect(
    csmClient.from('comments').insert({
      module_id: moduleId,
      course_id: courseId,
      tenant_id: tenantA.id,
      content: 'Should fail',
      user_id: csm.id,
    })
  ).toDenyAccess('insert');
});
```

### Assertion: UPDATE/DELETE Denied (must chain `.select()`)

```typescript
it('CM-018: Learner cannot delete other user comment', async () => {
  await expect(
    learnerAClient
      .from('comments')
      .delete()
      .eq('id', commentByLearnerB)
      .select()  // REQUIRED — without .select(), can't detect empty result
  ).toDenyAccess('delete');
});
```

### Data Restoration After UPDATE Tests

```typescript
it('CM-020: Learner can update own comment', async () => {
  const { data, error } = await learnerAClient
    .from('comments')
    .update({ content: 'Updated content' })
    .eq('id', commentByLearnerA)
    .select()
    .single();

  expect(error).toBeNull();
  expect(data!.content).toBe('Updated content');

  // Restore original data for other tests
  await adminClient
    .from('comments')
    .update({ content: 'Original content' })
    .eq('id', commentByLearnerA);
});
```

### Throwaway Rows for DELETE Tests

```typescript
let commentForDeleteOwn: string | null;
let commentForDeleteTA: string | null;

beforeAll(async () => {
  // Create throwaway rows consumed by DELETE tests
  const c1 = await createComment(tracker, learnerA.id, moduleId, courseId, tenantA.id);
  commentForDeleteOwn = c1.id;
  const c2 = await createComment(tracker, learnerA.id, moduleId, courseId, tenantA.id);
  commentForDeleteTA = c2.id;
});

it('CM-022: Learner can delete own comment', async () => {
  const { data } = await learnerAClient
    .from('comments')
    .delete()
    .eq('id', commentForDeleteOwn!)
    .select();

  expect(data).toHaveLength(1);
  commentForDeleteOwn = null;  // consumed
});
```

---

## 18. Test Execution & CI

### `npm run test:rls` — Full CI Flow

Uses `scripts/test-runner.ts`:

1. Creates an ephemeral Supabase preview branch (`supabase branches create`)
2. Polls every 10s for up to 5 minutes until `ACTIVE_HEALTHY`
3. Fetches branch credentials (URL, anon key, service role key, DB URL)
4. Runs vitest with those credentials as env vars
5. **Always** deletes the preview branch in `finally` (even on failure)

```typescript
// Simplified test-runner.ts logic
const branchName = `rls-test-${Date.now()}`;

try {
  await exec(`supabase branches create ${branchName}`);

  // Poll until ready
  while (status !== 'ACTIVE_HEALTHY' && attempts < 30) {
    await sleep(10_000);
    status = await getBranchStatus(branchName);
  }

  const creds = await getBranchCredentials(branchName);

  await exec('vitest run --config vitest.config.ts', {
    env: {
      SUPABASE_URL: creds.url,
      SUPABASE_ANON_KEY: creds.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: creds.serviceRoleKey,
      DATABASE_URL: creds.databaseUrl,
    },
  });
} finally {
  await exec(`supabase branches delete ${branchName}`);
}
```

### `npm run test:rls:local` — Local Development

Runs directly against the `.env` credentials (typically production Supabase). Fast iteration, no branch management.

### `npm run test:rls:watch` — Watch Mode

Same as local but re-runs on file changes.

---

## 19. Coverage & Inventory

### 13 Test Files, 406 Test Cases

| File | ID Prefix | Tests | Tables Covered |
|------|-----------|-------|---------------|
| `tenants.test.ts` | TEN | 10 | `tenants` |
| `profiles.test.ts` | ROL, ESC | 14 | `profiles` + role escalation triggers |
| `courses.test.ts` | XTA | 16 | `courses`, `tenant_courses` |
| `content-hierarchy.test.ts` | INH, MA, MD | 52 | `lectures`, `modules`, all module subtables |
| `content-write.test.ts` | CW | 48 | Write ops across 14 content tables |
| `enrollment-progress.test.ts` | EP | 48 | `course_enrollments`, `user_progress`, `enroll_with_password()` |
| `quiz-exam.test.ts` | QE | 55 | `quiz_attempts`, `quiz_attempt_answers`, `exam_submissions`, `external_quiz_results` |
| `comments.test.ts` | CM | 24 | `comments`, `comment_replies` |
| `expert-questions.test.ts` | EQ | 16 | `expert_questions` |
| `issues.test.ts` | IS | 21 | `issues`, `issues_safe` view |
| `notifications.test.ts` | NT | 30 | `notifications` RLS (9) + 13 trigger functions (21) |
| `admin.test.ts` | AD | 46 | `csm_tenant_assignments`, `lecturer_course_assignments`, `access_requests`, `reminder_history` |
| `knowledge-checks.test.ts` | KC | 26 | `knowledge_check_questions`, `knowledge_check_responses`, safe view, RPC |

### Policy Coverage

- **~297 `CREATE POLICY` statements** across 13 migration files
- **~35 tables** with RLS enabled
- **406 test cases** covering SELECT, INSERT, UPDATE, DELETE across all 5 roles

---

## 20. RLS Test Gotchas

### INSERT + RETURNING Requires SELECT Policy

```typescript
// WRONG — fails if user has INSERT but no SELECT policy
const { data } = await client.from('issues').insert({ ... }).select().single();

// CORRECT — INSERT alone, verify via admin client
const { error } = await client.from('issues').insert({ ... });
expect(error).toBeNull();

// Verify via admin
const { data } = await adminClient.from('issues').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
expect(data).toHaveLength(1);
```

### FK Join Returns Null (Not Error)

When Supabase does a nested FK join, RLS is applied on the joined table. If the user can't SELECT the joined row, it returns `null` — not an error:

```typescript
// If learner can SELECT comments but not profiles:
const { data } = await client.from('comments').select('*, profiles(full_name)');
// data[0].profiles will be null, even though the FK exists
```

### UPDATE/DELETE Must Chain `.select()`

Without `.select()`, Supabase doesn't return data, making denial assertions impossible:

```typescript
// WRONG — can't detect denial
await expect(client.from('table').delete().eq('id', id)).toDenyAccess('delete');

// CORRECT
await expect(client.from('table').delete().eq('id', id).select()).toDenyAccess('delete');
```

### CSM Content Hierarchy Gap

CSMs can see courses (via `courses_select_csm`) but there are NO `lectures_select_csm` or `modules_select_csm` policies. This is a **known gap** with explicit test assertions:

```typescript
it('INH-003: CSM cannot see lectures (known gap)', async () => {
  await expect(
    csmClient.from('lectures').select('*').eq('course_id', courseId)
  ).toDenyAccess('select');
});
```

### Service Role Client Cannot Change Role Fields

The `protect_profile_role_fields()` trigger reads JWT claims. The service role key doesn't set JWT claims GUC, so even `adminClient` can't change `is_tenant_admin` / `is_platform_admin`. Must use direct pg connection with faked claims (see `setProfileRole()` in Section 16).

### Safe Views Bypass RLS

Views like `issues_safe`, `quiz_questions_safe`, `knowledge_check_questions_safe` are owned by `postgres` and bypass RLS. They're tested separately to verify they exclude sensitive columns:

```typescript
it('IS-008: issues_safe excludes internal_notes', async () => {
  const { data } = await learnerClient
    .from('issues_safe')
    .select('*')
    .eq('id', issueId);

  expect(data).toHaveLength(1);
  expect(data![0]).not.toHaveProperty('internal_notes');
});
```

### Enrollment Cleanup for INSERT Tests

UNIQUE constraints mean INSERT tests must clean up immediately:

```typescript
it('EP-025: Learner can self-enroll in open course', async () => {
  const { data, error } = await learnerClient
    .from('course_enrollments')
    .insert({ user_id: learner.id, course_id: openCourseId, tenant_id: tenantId })
    .select()
    .single();

  expect(error).toBeNull();
  expect(data).not.toBeNull();

  // Clean up immediately to prevent UNIQUE violation in other tests
  await adminClient.from('course_enrollments').delete().eq('id', data!.id);
});
```
