import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  LucideAngularModule, Building2, Search, Loader2,
  Plus, Save, Trash2, X, ChevronDown, ChevronUp, BookOpen, Users, Shield, Edit, AlertTriangle,
} from 'lucide-angular';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  TenantForBoard, TenantCourseAssignment, CsmAssignment,
  AvailableCourse, AvailableCsm,
} from '../../../core/models/tenant-management.model';
import { AuthMethod } from '../../../core/models/tenant.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';

const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  email_password: 'Email',
  magic_link: 'Magic Link',
  keycloak_sso: 'Keycloak SSO',
};

const ALL_AUTH_METHODS: AuthMethod[] = ['email_password', 'magic_link', 'keycloak_sso'];

@Component({
  selector: 'app-tenant-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.Building2" [size]="24"></lucide-icon>
          Tenant Management
          <app-status-badge variant="primary">{{ service.tenants().length }}</app-status-badge>
        </h1>
        <button
          type="button"
          (click)="showCreateForm.set(!showCreateForm())"
          class="btn-primary"
        >
          <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
          Add Tenant
        </button>
      </div>

      <!-- Create form -->
      @if (showCreateForm()) {
        <div class="form-card px-6 py-5 mb-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-4">Create New Tenant</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="section-label mb-1">Name</label>
              <input
                type="text"
                [value]="createName()"
                (input)="createName.set($any($event.target).value)"
                class="input-field"
                placeholder="Tenant name"
              />
            </div>
            <div>
              <label class="section-label mb-1">Domain</label>
              <input
                type="text"
                [value]="createDomain()"
                (input)="createDomain.set($any($event.target).value)"
                class="input-field"
                placeholder="example.com"
              />
            </div>
          </div>
          <div class="mb-4">
            <label class="section-label mb-2">Auth Methods</label>
            <div class="flex flex-wrap gap-3">
              @for (method of allAuthMethods; track method) {
                <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    [checked]="createAuthMethods().includes(method)"
                    (change)="toggleCreateAuthMethod(method)"
                    class="checkbox-field"
                  />
                  {{ getAuthMethodLabel(method) }}
                </label>
              }
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="onCreateTenant()"
              [disabled]="creating() || !createName().trim()"
              class="btn-primary"
            >
              @if (creating()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
              }
              Create
            </button>
            <button
              type="button"
              (click)="cancelCreate()"
              class="btn-ghost"
            >Cancel</button>
          </div>
        </div>
      }

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by name or domain..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="search-input"
          />
        </div>
        @if (searchTerm()) {
          <button
            type="button"
            (click)="searchTerm.set('')"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total Tenants" [value]="totalTenants()" />
        <app-stat-card label="Master" [value]="masterCount()" color="text-teal-600" />
        <app-stat-card label="Course Assignments" [value]="totalCourseAssignments()" color="text-blue-600" />
        <app-stat-card label="CSM Assignments" [value]="totalCsmAssignments()" color="text-purple-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading tenants..." />
      } @else if (service.error()) {
        <div class="mb-4"><app-error-alert [message]="service.error()!" /></div>
      } @else if (filteredTenants().length === 0) {
        <app-empty-state [icon]="icons.Building2" message="No tenants found." />
      } @else {
        <!-- Tenants table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th text-left">Name</th>
                <th class="th text-left">Domain</th>
                <th class="th text-left">Auth Methods</th>
                <th class="th text-left">Courses</th>
                <th class="th text-left">CSMs</th>
                <th class="th text-left"></th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of filteredTenants(); track tenant.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandTenant(tenant)"
                >
                  <td class="table-cell text-slate-700 font-medium">
                    {{ tenant.name }}
                    @if (tenant.is_master) {
                      <app-status-badge class="ml-2" variant="primary">
                        <lucide-icon [img]="icons.Shield" [size]="10" class="mr-1"></lucide-icon>
                        Master
                      </app-status-badge>
                    }
                  </td>
                  <td class="table-cell">{{ tenant.domain ?? '\u2014' }}</td>
                  <td class="table-cell">
                    <div class="flex flex-wrap gap-1">
                      @for (method of tenant.settings.auth_methods ?? []; track method) {
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                          {{ getAuthMethodLabel(method) }}
                        </span>
                      }
                    </div>
                  </td>
                  <td class="table-cell tabular-nums">{{ tenant.courseCount }}</td>
                  <td class="table-cell tabular-nums">{{ tenant.csmCount }}</td>
                  <td class="table-cell text-right">
                    @if (expandedTenantId() === tenant.id) {
                      <lucide-icon [img]="icons.ChevronUp" [size]="16" class="text-slate-400"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
                    }
                  </td>
                </tr>

                <!-- Expanded row -->
                @if (expandedTenantId() === tenant.id) {
                  <tr>
                    <td colspan="6" class="expand-panel px-6 py-4">
                      <!-- Tabs -->
                      <div class="flex gap-1 mb-4 border-b border-slate-200">
                        <button
                          type="button"
                          (click)="onTabChange('details', tenant)"
                          class="px-4 py-2 text-sm font-medium transition-colors"
                          [class]="activeTab() === 'details' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'"
                        >
                          <lucide-icon [img]="icons.Edit" [size]="14" class="inline mr-1"></lucide-icon>
                          Details
                        </button>
                        <button
                          type="button"
                          (click)="onTabChange('courses', tenant)"
                          class="px-4 py-2 text-sm font-medium transition-colors"
                          [class]="activeTab() === 'courses' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'"
                        >
                          <lucide-icon [img]="icons.BookOpen" [size]="14" class="inline mr-1"></lucide-icon>
                          Courses ({{ tenant.courseCount }})
                        </button>
                        <button
                          type="button"
                          (click)="onTabChange('csms', tenant)"
                          class="px-4 py-2 text-sm font-medium transition-colors"
                          [class]="activeTab() === 'csms' ? 'text-teal-700 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-700'"
                        >
                          <lucide-icon [img]="icons.Users" [size]="14" class="inline mr-1"></lucide-icon>
                          CSMs ({{ tenant.csmCount }})
                        </button>
                      </div>

                      <!-- Details tab -->
                      @if (activeTab() === 'details') {
                        <div class="max-w-xl">
                          <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label class="section-label mb-1">Name</label>
                              <input
                                type="text"
                                [value]="editName()"
                                (input)="editName.set($any($event.target).value)"
                                class="input-field"
                              />
                            </div>
                            <div>
                              <label class="section-label mb-1">Domain</label>
                              <input
                                type="text"
                                [value]="editDomain()"
                                (input)="editDomain.set($any($event.target).value)"
                                class="input-field"
                              />
                            </div>
                          </div>
                          <div class="mb-4">
                            <label class="section-label mb-2">Auth Methods</label>
                            <div class="flex flex-wrap gap-3">
                              @for (method of allAuthMethods; track method) {
                                <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    [checked]="editAuthMethods().includes(method)"
                                    (change)="toggleEditAuthMethod(method)"
                                    class="checkbox-field"
                                  />
                                  {{ getAuthMethodLabel(method) }}
                                </label>
                              }
                            </div>
                          </div>
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              (click)="onSaveTenantDetails(tenant.id)"
                              [disabled]="saving()"
                              class="btn-primary"
                            >
                              @if (saving()) {
                                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
                              } @else {
                                <lucide-icon [img]="icons.Save" [size]="14"></lucide-icon>
                              }
                              Save
                            </button>
                            @if (!tenant.is_master) {
                              @if (confirmingDelete()) {
                                <button
                                  type="button"
                                  (click)="onDeleteTenant(tenant.id)"
                                  [disabled]="deleting()"
                                  class="btn-danger"
                                >
                                  @if (deleting()) {
                                    <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
                                  } @else {
                                    <lucide-icon [img]="icons.AlertTriangle" [size]="14"></lucide-icon>
                                  }
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  (click)="confirmingDelete.set(false)"
                                  class="btn-ghost"
                                >Cancel</button>
                              } @else {
                                <button
                                  type="button"
                                  (click)="confirmingDelete.set(true)"
                                  class="btn-danger"
                                >
                                  <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                                  Delete
                                </button>
                              }
                            } @else {
                              <span class="text-xs text-slate-400 italic">Master tenant cannot be deleted</span>
                            }
                          </div>
                        </div>
                      }

                      <!-- Courses tab -->
                      @if (activeTab() === 'courses') {
                        <div class="max-w-xl">
                          @if (coursesLoading()) {
                            <div class="flex items-center py-4">
                              <span class="inline-flex animate-spin mr-2"><lucide-icon [img]="icons.Loader2" [size]="16" class="text-slate-400"></lucide-icon></span>
                              <span class="text-sm text-slate-500">Loading courses...</span>
                            </div>
                          } @else {
                            <!-- Assigned courses list -->
                            @if (tenantCourses().length > 0) {
                              <ul class="divide-y divide-slate-100 mb-4">
                                @for (tc of tenantCourses(); track tc.id) {
                                  <li class="flex items-center justify-between py-2">
                                    <span class="text-sm text-slate-700">{{ tc.course_title }}</span>
                                    <button
                                      type="button"
                                      (click)="onRemoveCourse(tenant.id, tc.course_id, $event)"
                                      class="text-slate-400 hover:text-rose-500 transition-colors"
                                      title="Remove course"
                                    >
                                      <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
                                    </button>
                                  </li>
                                }
                              </ul>
                            } @else {
                              <p class="text-sm text-slate-500 mb-4">No courses assigned.</p>
                            }

                            <!-- Add course -->
                            @if (availableCourses().length > 0) {
                              <div class="flex items-center gap-2">
                                <app-custom-select
                                  class="flex-1"
                                  [options]="coursePickerOptions()"
                                  [value]="selectedCourseId()"
                                  (valueChange)="selectedCourseId.set($event)"
                                  placeholder="Select a course..."
                                />
                                <button
                                  type="button"
                                  (click)="onAssignCourse(tenant.id)"
                                  [disabled]="!selectedCourseId()"
                                  class="btn-primary"
                                >
                                  <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
                                  Add
                                </button>
                              </div>
                            }

                            <p class="mt-3 text-xs text-slate-400">
                              <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="inline mr-1"></lucide-icon>
                              Removing a course also removes all enrollments and progress for this tenant.
                            </p>
                          }
                        </div>
                      }

                      <!-- CSMs tab -->
                      @if (activeTab() === 'csms') {
                        <div class="max-w-xl">
                          @if (csmsLoading()) {
                            <div class="flex items-center py-4">
                              <span class="inline-flex animate-spin mr-2"><lucide-icon [img]="icons.Loader2" [size]="16" class="text-slate-400"></lucide-icon></span>
                              <span class="text-sm text-slate-500">Loading CSMs...</span>
                            </div>
                          } @else {
                            <!-- Assigned CSMs list -->
                            @if (csmAssignments().length > 0) {
                              <ul class="divide-y divide-slate-100 mb-4">
                                @for (csm of csmAssignments(); track csm.id) {
                                  <li class="flex items-center justify-between py-2">
                                    <div>
                                      <span class="text-sm text-slate-700">{{ csm.email }}</span>
                                      @if (csm.full_name) {
                                        <span class="text-xs text-slate-400 ml-2">{{ csm.full_name }}</span>
                                      }
                                    </div>
                                    <button
                                      type="button"
                                      (click)="onRemoveCsm(csm.id, $event)"
                                      class="text-slate-400 hover:text-rose-500 transition-colors"
                                      title="Remove CSM"
                                    >
                                      <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
                                    </button>
                                  </li>
                                }
                              </ul>
                            } @else {
                              <p class="text-sm text-slate-500 mb-4">No CSMs assigned.</p>
                            }

                            <!-- Add CSM -->
                            @if (availableCsms().length > 0) {
                              <div class="flex items-center gap-2">
                                <app-custom-select
                                  class="flex-1"
                                  [options]="csmPickerOptions()"
                                  [value]="selectedCsmId()"
                                  (valueChange)="selectedCsmId.set($event)"
                                  placeholder="Select a CSM..."
                                />
                                <button
                                  type="button"
                                  (click)="onAssignCsm(tenant.id)"
                                  [disabled]="!selectedCsmId()"
                                  class="btn-primary"
                                >
                                  <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
                                  Add
                                </button>
                              </div>
                            }
                          }
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class TenantManagementPageComponent implements OnInit {
  readonly service = inject(TenantManagementService);
  readonly #toast = inject(ToastService);

  readonly icons = {
    Building2, Search, Loader2, Plus, Save, Trash2, X,
    ChevronDown, ChevronUp, BookOpen, Users, Shield, Edit, AlertTriangle,
  };

  readonly allAuthMethods = ALL_AUTH_METHODS;

  // Filter
  readonly searchTerm = signal('');

  // Create form
  readonly showCreateForm = signal(false);
  readonly createName = signal('');
  readonly createDomain = signal('');
  readonly createAuthMethods = signal<AuthMethod[]>(['email_password']);
  readonly creating = signal(false);

  // Expanded row
  readonly expandedTenantId = signal<string | null>(null);
  readonly activeTab = signal<'details' | 'courses' | 'csms'>('details');

  // Edit (details tab)
  readonly editName = signal('');
  readonly editDomain = signal('');
  readonly editAuthMethods = signal<AuthMethod[]>([]);
  readonly saving = signal(false);

  // Course assignments (courses tab)
  readonly tenantCourses = signal<TenantCourseAssignment[]>([]);
  readonly availableCourses = signal<AvailableCourse[]>([]);
  readonly selectedCourseId = signal('');
  readonly coursesLoading = signal(false);
  readonly coursePickerOptions = computed<SelectOption[]>(() =>
    this.availableCourses().map(c => ({ value: c.id, label: c.title })),
  );

  // CSM assignments (csms tab)
  readonly csmAssignments = signal<CsmAssignment[]>([]);
  readonly availableCsms = signal<AvailableCsm[]>([]);
  readonly selectedCsmId = signal('');
  readonly csmsLoading = signal(false);
  readonly csmPickerOptions = computed<SelectOption[]>(() =>
    this.availableCsms().map(c => ({ value: c.id, label: c.email + (c.full_name ? ' (' + c.full_name + ')' : '') })),
  );

  // Delete
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  // Computed
  readonly filteredTenants = computed(() => {
    let tenants = this.service.tenants();
    const search = this.searchTerm().toLowerCase();

    if (search) {
      tenants = tenants.filter(t =>
        t.name.toLowerCase().includes(search) ||
        (t.domain ?? '').toLowerCase().includes(search),
      );
    }

    return tenants;
  });

  readonly totalTenants = computed(() => this.filteredTenants().length);
  readonly masterCount = computed(() => this.filteredTenants().filter(t => t.is_master).length);
  readonly totalCourseAssignments = computed(() =>
    this.filteredTenants().reduce((sum, t) => sum + t.courseCount, 0),
  );
  readonly totalCsmAssignments = computed(() =>
    this.filteredTenants().reduce((sum, t) => sum + t.csmCount, 0),
  );

  ngOnInit() {
    this.service.loadTenants();
  }

  getAuthMethodLabel(method: AuthMethod): string {
    return AUTH_METHOD_LABELS[method] ?? method;
  }

  // --- Create ---

  toggleCreateAuthMethod(method: AuthMethod) {
    const current = this.createAuthMethods();
    if (current.includes(method)) {
      this.createAuthMethods.set(current.filter(m => m !== method));
    } else {
      this.createAuthMethods.set([...current, method]);
    }
  }

  async onCreateTenant() {
    this.creating.set(true);

    try {
      await this.service.createTenant({
        name: this.createName().trim(),
        domain: this.createDomain().trim() || null,
        auth_methods: this.createAuthMethods(),
      });
      this.#toast.success('Tenant created');
      this.cancelCreate();
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      this.creating.set(false);
    }
  }

  cancelCreate() {
    this.showCreateForm.set(false);
    this.createName.set('');
    this.createDomain.set('');
    this.createAuthMethods.set(['email_password']);
  }

  // --- Expand / Tab ---

  onExpandTenant(tenant: TenantForBoard) {
    if (this.expandedTenantId() === tenant.id) {
      this.expandedTenantId.set(null);
      return;
    }
    this.expandedTenantId.set(tenant.id);
    this.activeTab.set('details');
    this.populateEditFields(tenant);
    this.confirmingDelete.set(false);
  }

  onTabChange(tab: 'details' | 'courses' | 'csms', tenant: TenantForBoard) {
    this.activeTab.set(tab);
    if (tab === 'courses') {
      this.loadCoursesTab(tenant.id);
    } else if (tab === 'csms') {
      this.loadCsmsTab(tenant.id);
    }
  }

  // --- Details ---

  private populateEditFields(tenant: TenantForBoard) {
    this.editName.set(tenant.name);
    this.editDomain.set(tenant.domain ?? '');
    this.editAuthMethods.set([...(tenant.settings.auth_methods ?? [])]);
  }

  toggleEditAuthMethod(method: AuthMethod) {
    const current = this.editAuthMethods();
    if (current.includes(method)) {
      this.editAuthMethods.set(current.filter(m => m !== method));
    } else {
      this.editAuthMethods.set([...current, method]);
    }
  }

  async onSaveTenantDetails(tenantId: string) {
    this.saving.set(true);

    try {
      await this.service.updateTenant(tenantId, {
        name: this.editName().trim(),
        domain: this.editDomain().trim() || null,
        auth_methods: this.editAuthMethods(),
      });
      this.#toast.success('Tenant updated');
      this.expandedTenantId.set(null);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to save tenant');
    } finally {
      this.saving.set(false);
    }
  }

  async onDeleteTenant(tenantId: string) {
    this.deleting.set(true);

    try {
      await this.service.deleteTenant(tenantId);
      this.#toast.success('Tenant deleted');
      this.expandedTenantId.set(null);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to delete tenant');
    } finally {
      this.deleting.set(false);
      this.confirmingDelete.set(false);
    }
  }

  // --- Courses tab ---

  private async loadCoursesTab(tenantId: string) {
    this.coursesLoading.set(true);
    try {
      const [courses, available] = await Promise.all([
        this.service.loadTenantCourses(tenantId),
        this.service.loadAvailableCourses(tenantId),
      ]);
      this.tenantCourses.set(courses);
      this.availableCourses.set(available);
      this.selectedCourseId.set('');
    } catch {
      // Errors handled by service
    } finally {
      this.coursesLoading.set(false);
    }
  }

  async onAssignCourse(tenantId: string) {
    const courseId = this.selectedCourseId();
    if (!courseId) return;

    try {
      await this.service.assignCourseToTenant(tenantId, courseId);
      this.#toast.success('Course assigned');
      await this.loadCoursesTab(tenantId);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to assign course');
    }
  }

  async onRemoveCourse(tenantId: string, courseId: string, event: Event) {
    event.stopPropagation();
    try {
      await this.service.removeCourseFromTenant(tenantId, courseId);
      this.#toast.success('Course removed');
      await this.loadCoursesTab(tenantId);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to remove course');
    }
  }

  // --- CSMs tab ---

  private async loadCsmsTab(tenantId: string) {
    this.csmsLoading.set(true);
    try {
      const [assignments, available] = await Promise.all([
        this.service.loadCsmAssignments(tenantId),
        this.service.loadAvailableCsms(tenantId),
      ]);
      this.csmAssignments.set(assignments);
      this.availableCsms.set(available);
      this.selectedCsmId.set('');
    } catch {
      // Errors handled by service
    } finally {
      this.csmsLoading.set(false);
    }
  }

  async onAssignCsm(tenantId: string) {
    const userId = this.selectedCsmId();
    if (!userId) return;

    try {
      await this.service.assignCsm(tenantId, userId);
      this.#toast.success('CSM assigned');
      await this.loadCsmsTab(tenantId);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to assign CSM');
    }
  }

  async onRemoveCsm(assignmentId: string, event: Event) {
    event.stopPropagation();
    const tenantId = this.expandedTenantId();
    if (!tenantId) return;

    try {
      await this.service.removeCsm(assignmentId);
      this.#toast.success('CSM removed');
      await this.loadCsmsTab(tenantId);
      await this.service.loadTenants();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to remove CSM');
    }
  }
}
