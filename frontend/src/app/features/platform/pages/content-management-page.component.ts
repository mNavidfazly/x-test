import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule, FolderOpen, Search, ChevronDown, ChevronUp, ChevronRight,
  Plus, X, Video, FileText, Type, HelpCircle, ClipboardCheck, ExternalLink,
  Headphones, FolderArchive, AlertTriangle, Loader2,
} from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';
import { ContentManagementService } from '../../../core/services/content-management.service';
import { CourseService } from '../../../core/services/course.service';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { ContentCourse, StalenessFilter, ModuleTypeFilter } from '../../../core/models/content-management.model';
import { TenantAssignment } from '../../../core/models/course.model';
import { ModuleType } from '../../../core/models/course.model';
import { debouncedSignal } from '../../../core/utils/debounce.utils';
import { formatDate } from '../../../core/utils/date.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';

const MODULE_TYPE_ICONS: Record<string, LucideIconData> = {
  video: Video,
  pdf: FileText,
  markdown: Type,
  quiz: HelpCircle,
  exam: ClipboardCheck,
  external_quiz: ExternalLink,
  audio: Headphones,
  download: FolderArchive,
};

const MODULE_TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  pdf: 'PDF',
  markdown: 'Markdown',
  quiz: 'Quiz',
  exam: 'Exam',
  external_quiz: 'External Quiz',
  audio: 'Audio',
  download: 'Downloadable Files',
};

const ENROLLMENT_LABELS: Record<string, string> = {
  open: 'Open',
  invite_only: 'Invite',
  password_protected: 'Password',
};

const STALENESS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Staleness' },
  { value: 'has_stale', label: 'Has Stale' },
  { value: 'all_fresh', label: 'All Fresh' },
  { value: 'has_postponed', label: 'Has Postponed' },
];

const MODULE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Video' },
  { value: 'pdf', label: 'PDF' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exam', label: 'Exam' },
  { value: 'audio', label: 'Audio' },
  { value: 'download', label: 'Downloadable Files' },
];

@Component({
  selector: 'app-content-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.FolderOpen" [size]="24"></lucide-icon>
          Content Management
          <app-status-badge variant="primary">{{ service.courses().length }}</app-status-badge>
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search courses or modules..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="search-input"
          />
        </div>
        <app-custom-select
          [options]="stalenessOptions"
          [value]="stalenessFilter()"
          (valueChange)="stalenessFilter.set($any($event))"
        />
        <app-custom-select
          [options]="moduleTypeOptions"
          [value]="moduleTypeFilter()"
          (valueChange)="moduleTypeFilter.set($any($event))"
        />
        <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            [checked]="showUnassignedOnly()"
            (change)="showUnassignedOnly.set($any($event.target).checked)"
            class="checkbox-field"
          />
          Unassigned only
        </label>
        @if (hasActiveFilters()) {
          <button type="button" (click)="clearFilters()" class="btn-link">Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total Courses" [value]="totalCourses()" />
        <app-stat-card label="Total Modules" [value]="totalModules()" color="text-blue-600" />
        <app-stat-card label="Stale Modules" [value]="staleModules()" color="text-rose-600" />
        <app-stat-card label="Unassigned Courses" [value]="unassignedCourses()" color="text-amber-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading content overview..." />
      } @else if (service.error()) {
        <div class="mb-4"><app-error-alert [message]="service.error()!" /></div>
      } @else if (filteredCourses().length === 0) {
        <app-empty-state [icon]="icons.FolderOpen" message="No courses found." />
      } @else {
        <!-- Courses table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th">Course</th>
                <th class="th">Lectures</th>
                <th class="th">Modules</th>
                <th class="th">Tenants</th>
                <th class="th">Staleness</th>
                <th class="th">Last Updated</th>
                <th class="th"></th>
              </tr>
            </thead>
            <tbody>
              @for (course of filteredCourses(); track course.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="toggleCourse(course)"
                >
                  <td class="table-cell">
                    <div class="font-medium text-slate-700">{{ course.title }}</div>
                    <app-status-badge [variant]="getEnrollmentBadgeVariant(course.enrollment_type)" class="mt-1">
                      {{ getEnrollmentLabel(course.enrollment_type) }}
                    </app-status-badge>
                  </td>
                  <td class="table-cell tabular-nums">{{ course.lectureCount }}</td>
                  <td class="table-cell">
                    <div class="flex flex-wrap gap-1">
                      @for (entry of getModuleTypePills(course); track entry.type) {
                        <span class="badge-neutral text-xs">
                          {{ entry.count }} {{ entry.label }}
                        </span>
                      }
                      @if (course.totalModules === 0) {
                        <span class="text-slate-400 text-xs">None</span>
                      }
                    </div>
                  </td>
                  <td class="table-cell tabular-nums">{{ course.tenantCount }}</td>
                  <td class="table-cell">
                    @if (course.totalModules === 0) {
                      <span class="text-slate-400 text-xs">\u2014</span>
                    } @else if (course.hasStaleModules) {
                      <app-status-badge variant="error">{{ course.staleModuleCount }} stale</app-status-badge>
                    } @else if (course.postponedModuleCount > 0) {
                      <app-status-badge variant="info">{{ course.postponedModuleCount }} postponed</app-status-badge>
                    } @else {
                      <app-status-badge variant="success">Fresh</app-status-badge>
                    }
                  </td>
                  <td class="table-cell text-slate-500 text-xs">
                    {{ course.lastModuleUpdate ? formatDate(course.lastModuleUpdate) : '\u2014' }}
                  </td>
                  <td class="table-cell text-right">
                    @if (expandedCourseId() === course.id) {
                      <lucide-icon [img]="icons.ChevronUp" [size]="16" class="text-slate-400"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
                    }
                  </td>
                </tr>

                <!-- Expanded row -->
                @if (expandedCourseId() === course.id) {
                  <tr>
                    <td colspan="7" class="expand-panel px-6 py-4">
                      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Left: Lecture/Module tree -->
                        <div class="lg:col-span-2">
                          <h3 class="section-label mb-3">Content Structure</h3>
                          @if (course.lectures.length === 0) {
                            <p class="text-sm text-slate-500">No lectures yet.</p>
                          } @else {
                            @for (lecture of course.lectures; track lecture.id) {
                              <div class="mb-2">
                                <button
                                  type="button"
                                  class="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 w-full text-left py-1"
                                  (click)="toggleLecture(lecture.id, $event)"
                                >
                                  @if (expandedLectureIds().has(lecture.id)) {
                                    <lucide-icon [img]="icons.ChevronDown" [size]="14" class="text-slate-400"></lucide-icon>
                                  } @else {
                                    <lucide-icon [img]="icons.ChevronRight" [size]="14" class="text-slate-400"></lucide-icon>
                                  }
                                  {{ lecture.title }}
                                  <span class="text-xs text-slate-400">({{ lecture.modules.length }})</span>
                                </button>
                                @if (expandedLectureIds().has(lecture.id)) {
                                  <div class="ml-6 border-l border-slate-200 pl-3">
                                    @for (mod of lecture.modules; track mod.id) {
                                      <div class="flex items-center gap-2 py-1 text-sm">
                                        <lucide-icon [img]="getModuleTypeIcon(mod.module_type)" [size]="14" class="text-slate-400"></lucide-icon>
                                        <span class="text-slate-700">{{ mod.title }}</span>
                                        @if (mod.isStale) {
                                          <app-status-badge variant="error">Stale</app-status-badge>
                                        } @else if (mod.isPostponed) {
                                          <app-status-badge variant="info">Postponed</app-status-badge>
                                        } @else {
                                          <app-status-badge variant="success">Fresh</app-status-badge>
                                        }
                                        <span class="text-xs text-slate-400 ml-auto">{{ formatDate(mod.updated_at) }}</span>
                                      </div>
                                    }
                                    @if (lecture.modules.length === 0) {
                                      <p class="text-xs text-slate-400 py-1">No modules</p>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          }
                        </div>

                        <!-- Right: Tenant assignments -->
                        <div>
                          <h3 class="section-label mb-3">Tenant Assignments</h3>
                          @if (tenantsLoading()) {
                            <div class="flex items-center py-4">
                              <lucide-icon [img]="icons.Loader2" [size]="16" class="text-slate-400 animate-spin mr-2"></lucide-icon>
                              <span class="text-sm text-slate-500">Loading...</span>
                            </div>
                          } @else {
                            @if (courseTenants().length > 0) {
                              <ul class="divide-y divide-slate-100 mb-4">
                                @for (t of courseTenants(); track t.tenant_id) {
                                  <li class="flex items-center justify-between py-2">
                                    <span class="text-sm text-slate-700">{{ t.tenant_name }}</span>
                                    <button
                                      type="button"
                                      (click)="onRemoveTenant(course.id, t.tenant_id, $event)"
                                      class="text-slate-400 hover:text-rose-500 transition-colors"
                                      title="Remove tenant"
                                    >
                                      <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
                                    </button>
                                  </li>
                                }
                              </ul>
                            } @else {
                              <p class="text-sm text-slate-500 mb-4">No tenants assigned.</p>
                            }

                            @if (availableTenants().length > 0) {
                              <div class="flex items-center gap-2">
                                <app-custom-select
                                  class="flex-1"
                                  [options]="tenantPickerOptions()"
                                  [value]="selectedTenantId()"
                                  (valueChange)="selectedTenantId.set($event)"
                                  placeholder="Select a tenant..."
                                />
                                <button
                                  type="button"
                                  (click)="onAssignTenant(course.id)"
                                  [disabled]="!selectedTenantId() || assigningTenant()"
                                  class="btn-primary"
                                >
                                  <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
                                  Add
                                </button>
                              </div>
                            }

                            <p class="mt-3 text-xs text-slate-400">
                              <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="inline mr-1"></lucide-icon>
                              Removing a tenant also removes all enrollments and progress.
                            </p>
                          }

                          <!-- Edit course link -->
                          <div class="mt-4 pt-4 border-t border-slate-200">
                            <button
                              type="button"
                              (click)="navigateToEdit(course.id, $event)"
                              class="btn-ghost text-teal-600 hover:text-teal-700"
                            >Edit Course &rarr;</button>
                          </div>
                        </div>
                      </div>
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
export class ContentManagementPageComponent implements OnInit {
  readonly service = inject(ContentManagementService);
  readonly #courseService = inject(CourseService);
  readonly #tenantService = inject(TenantManagementService);
  readonly #toast = inject(ToastService);
  readonly #router = inject(Router);

  readonly icons = {
    FolderOpen, Search, ChevronDown, ChevronUp, ChevronRight,
    Plus, X, AlertTriangle, Loader2,
  };

  readonly stalenessOptions = STALENESS_OPTIONS;
  readonly moduleTypeOptions = MODULE_TYPE_OPTIONS;
  readonly formatDate = formatDate;

  // Filters
  readonly searchTerm = signal('');
  readonly stalenessFilter = signal<StalenessFilter>('all');
  readonly moduleTypeFilter = signal<ModuleTypeFilter>('all');
  readonly showUnassignedOnly = signal(false);
  readonly #debouncedSearch = debouncedSignal(this.searchTerm, 300);

  // Expansion
  readonly expandedCourseId = signal<string | null>(null);
  readonly expandedLectureIds = signal<Set<string>>(new Set());

  // Tenant assignment state
  readonly courseTenants = signal<TenantAssignment[]>([]);
  readonly availableTenants = signal<{ id: string; name: string }[]>([]);
  readonly tenantsLoading = signal(false);
  readonly selectedTenantId = signal('');
  readonly assigningTenant = signal(false);
  readonly tenantPickerOptions = computed<SelectOption[]>(() =>
    this.availableTenants().map(t => ({ value: t.id, label: t.name })),
  );

  // Computed: filtered courses
  readonly filteredCourses = computed(() => {
    let courses = this.service.courses();
    const search = this.#debouncedSearch().toLowerCase();
    const staleness = this.stalenessFilter();
    const moduleType = this.moduleTypeFilter();
    const unassigned = this.showUnassignedOnly();

    if (search) {
      courses = courses.filter(c =>
        c.title.toLowerCase().includes(search) ||
        c.lectures.some(l =>
          l.modules.some(m => m.title.toLowerCase().includes(search)),
        ),
      );
    }

    if (staleness === 'has_stale') courses = courses.filter(c => c.hasStaleModules);
    else if (staleness === 'all_fresh') courses = courses.filter(c => !c.hasStaleModules && c.totalModules > 0 && c.postponedModuleCount === 0);
    else if (staleness === 'has_postponed') courses = courses.filter(c => c.postponedModuleCount > 0);

    if (moduleType !== 'all') {
      courses = courses.filter(c => (c.modulesByType[moduleType as ModuleType] ?? 0) > 0);
    }

    if (unassigned) courses = courses.filter(c => c.tenantCount === 0);

    return courses;
  });

  readonly hasActiveFilters = computed(() =>
    this.searchTerm() !== '' ||
    this.stalenessFilter() !== 'all' ||
    this.moduleTypeFilter() !== 'all' ||
    this.showUnassignedOnly(),
  );

  // Summary card computeds
  readonly totalCourses = computed(() => this.filteredCourses().length);
  readonly totalModules = computed(() =>
    this.filteredCourses().reduce((sum, c) => sum + c.totalModules, 0),
  );
  readonly staleModules = computed(() =>
    this.filteredCourses().reduce((sum, c) => sum + c.staleModuleCount, 0),
  );
  readonly unassignedCourses = computed(() =>
    this.filteredCourses().filter(c => c.tenantCount === 0).length,
  );

  ngOnInit() {
    this.service.loadContentOverview();
  }

  getEnrollmentLabel(type: string): string {
    return ENROLLMENT_LABELS[type] ?? type;
  }

  getEnrollmentBadgeVariant(type: string): 'success' | 'warning' | 'info' | 'neutral' {
    if (type === 'open') return 'success';
    if (type === 'invite_only') return 'warning';
    if (type === 'password_protected') return 'info';
    return 'neutral';
  }

  getModuleTypePills(course: ContentCourse): { type: string; count: number; label: string }[] {
    return Object.entries(course.modulesByType)
      .filter(([, count]) => count && count > 0)
      .map(([type, count]) => ({
        type,
        count: count!,
        label: MODULE_TYPE_LABELS[type] ?? type,
      }));
  }

  getModuleTypeIcon(type: string): LucideIconData {
    return MODULE_TYPE_ICONS[type] ?? FileText;
  }

  // --- Expand/Collapse ---

  toggleCourse(course: ContentCourse) {
    if (this.expandedCourseId() === course.id) {
      this.expandedCourseId.set(null);
      return;
    }
    this.expandedCourseId.set(course.id);
    // Auto-expand all lectures
    this.expandedLectureIds.set(new Set(course.lectures.map(l => l.id)));
    this.loadCourseTenants(course.id);
  }

  toggleLecture(lectureId: string, event: Event) {
    event.stopPropagation();
    const current = this.expandedLectureIds();
    const next = new Set(current);
    if (next.has(lectureId)) {
      next.delete(lectureId);
    } else {
      next.add(lectureId);
    }
    this.expandedLectureIds.set(next);
  }

  // --- Tenant management ---

  private async loadCourseTenants(courseId: string) {
    this.tenantsLoading.set(true);
    try {
      const [assigned, allTenants] = await Promise.all([
        this.#courseService.loadTenantAssignments(courseId),
        this.#tenantService.loadAvailableTenantsList(),
      ]);
      this.courseTenants.set(assigned);
      const assignedIds = new Set(assigned.map(a => a.tenant_id));
      this.availableTenants.set(allTenants.filter(t => !assignedIds.has(t.id)));
      this.selectedTenantId.set('');
    } catch {
      // Error handled by services
    } finally {
      this.tenantsLoading.set(false);
    }
  }

  async onAssignTenant(courseId: string) {
    const tenantId = this.selectedTenantId();
    if (!tenantId) return;

    this.assigningTenant.set(true);
    try {
      await this.#courseService.assignCourseToTenant(courseId, tenantId);
      this.#toast.success('Tenant assigned');
      await this.loadCourseTenants(courseId);
      await this.service.loadContentOverview();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to assign tenant');
    } finally {
      this.assigningTenant.set(false);
    }
  }

  async onRemoveTenant(courseId: string, tenantId: string, event: Event) {
    event.stopPropagation();
    try {
      await this.#courseService.removeCourseFromTenant(courseId, tenantId);
      this.#toast.success('Tenant removed');
      await this.loadCourseTenants(courseId);
      await this.service.loadContentOverview();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to remove tenant');
    }
  }

  navigateToEdit(courseId: string, event: Event) {
    event.stopPropagation();
    this.#router.navigate(['/courses', courseId]);
  }

  // --- Filters ---

  clearFilters() {
    this.searchTerm.set('');
    this.stalenessFilter.set('all');
    this.moduleTypeFilter.set('all');
    this.showUnassignedOnly.set(false);
  }
}
