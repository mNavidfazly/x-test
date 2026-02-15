import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  UserCog,
  Search,
  Loader2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  ClipboardCheck,
  Trash2,
  Info,
} from 'lucide-angular';
import { LecturerAssignmentService } from '../../../core/services/lecturer-assignment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  LecturerAssignment,
  AvailableLecturer,
  AvailableCourse,
} from '../../../core/models/lecturer-assignment.model';
import { formatDate } from '../../../core/utils/date.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

@Component({
  selector: 'app-lecturer-assignment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, StatCardComponent, StatusBadgeComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.UserCog" [size]="24"></lucide-icon>
          Lecturer Assignments
          <span class="badge-primary">
            {{ service.assignments().length }}
          </span>
        </h1>
        <button
          type="button"
          (click)="onToggleNewForm()"
          class="btn-primary"
        >
          <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
          New Assignment
        </button>
      </div>

      <!-- JWT Warning Banner -->
      <div class="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 flex items-start gap-3">
        <lucide-icon [img]="icons.Info" [size]="16" class="text-amber-600 mt-0.5 shrink-0"></lucide-icon>
        <p class="text-sm text-amber-800">
          Permission changes take effect when the lecturer next logs in (~1 hour JWT refresh).
        </p>
      </div>

      <!-- New Assignment Form -->
      @if (showNewForm()) {
        <div class="card px-6 py-5 mb-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-4">New Assignment</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="section-label mb-1">Lecturer</label>
              <select
                class="select-field w-full"
                [value]="selectedLecturerId()"
                (change)="onLecturerChange($any($event.target).value)"
              >
                <option value="">Select a lecturer...</option>
                @for (l of availableLecturers(); track l.id) {
                  <option [value]="l.id">{{ l.email }}{{ l.full_name ? ' (' + l.full_name + ')' : '' }}</option>
                }
              </select>
            </div>
            <div>
              <label class="section-label mb-1">Course</label>
              <select
                class="select-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
                [value]="selectedCourseId()"
                (change)="selectedCourseId.set($any($event.target).value)"
                [disabled]="!selectedLecturerId() || coursesLoading()"
              >
                <option value="">{{ coursesLoading() ? 'Loading courses...' : 'Select a course...' }}</option>
                @for (c of availableCourses(); track c.id) {
                  <option [value]="c.id">{{ c.title }}</option>
                }
              </select>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="onAddAssignment()"
              [disabled]="adding() || !selectedLecturerId() || !selectedCourseId()"
              class="btn-primary"
            >
              @if (adding()) {
                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
              } @else {
                <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
              }
              Add Assignment
            </button>
            <button
              type="button"
              (click)="cancelNewForm()"
              class="btn-ghost"
            >Cancel</button>
          </div>
        </div>
      }

      <!-- Filter Bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by name, email, or course..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="w-72 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
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

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total Assignments" [value]="totalCount()" />
        <app-stat-card label="Lecturers" [value]="lecturerCount()" color="text-teal-600" />
        <app-stat-card label="With Edit Access" [value]="editCount()" color="text-emerald-600" />
        <app-stat-card label="With Grade Access" [value]="gradeCount()" color="text-blue-600" />
      </div>

      <!-- Loading / Error / Empty / Table -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading assignments..." />
      } @else if (service.error()) {
        <app-error-alert [message]="service.error()!" />
      } @else if (filteredAssignments().length === 0) {
        <div class="text-center py-12 text-slate-500 text-sm">
          {{ searchTerm() ? 'No assignments match your search.' : 'No lecturer assignments yet. Click "New Assignment" to add one.' }}
        </div>
      } @else {
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th text-left">Lecturer</th>
                <th class="th text-left">Course</th>
                <th class="th text-left">Permissions</th>
                <th class="th text-left">Assigned</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (a of filteredAssignments(); track a.id) {
                <tr
                  class="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  (click)="onExpandAssignment(a)"
                >
                  <td class="px-6 py-3">
                    <div class="text-sm font-medium text-slate-900">{{ a.full_name || a.email }}</div>
                    @if (a.full_name) {
                      <div class="text-xs text-slate-500">{{ a.email }}</div>
                    }
                  </td>
                  <td class="px-6 py-3 text-slate-700">{{ a.course_title }}</td>
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-1.5">
                      @if (a.can_edit) {
                        <app-status-badge variant="success">Edit</app-status-badge>
                      }
                      @if (a.can_grade) {
                        <app-status-badge variant="info">Grade</app-status-badge>
                      }
                      @if (!a.can_edit && !a.can_grade) {
                        <app-status-badge variant="neutral">View Only</app-status-badge>
                      }
                    </div>
                  </td>
                  <td class="px-6 py-3 text-xs text-slate-500">{{ formatDate(a.assigned_at) }}</td>
                  <td class="px-3 py-3 text-slate-400">
                    <lucide-icon [img]="expandedAssignmentId() === a.id ? icons.ChevronUp : icons.ChevronDown" [size]="16"></lucide-icon>
                  </td>
                </tr>
                @if (expandedAssignmentId() === a.id) {
                  <tr>
                    <td colspan="5" class="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                      <div class="max-w-lg space-y-4">
                        <!-- Permission Toggles -->
                        <div>
                          <h3 class="section-label mb-2">Permissions</h3>
                          <div class="space-y-2">
                            <label class="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                [checked]="a.can_edit"
                                (change)="onTogglePermission(a, 'can_edit', $any($event.target).checked)"
                                [disabled]="togglingPermission()"
                                class="checkbox-field"
                              />
                              <span class="text-sm text-slate-700 flex items-center gap-1.5">
                                <lucide-icon [img]="icons.Pencil" [size]="14" class="text-slate-400"></lucide-icon>
                                Can Edit Content
                              </span>
                            </label>
                            <label class="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                [checked]="a.can_grade"
                                (change)="onTogglePermission(a, 'can_grade', $any($event.target).checked)"
                                [disabled]="togglingPermission()"
                                class="checkbox-field"
                              />
                              <span class="text-sm text-slate-700 flex items-center gap-1.5">
                                <lucide-icon [img]="icons.ClipboardCheck" [size]="14" class="text-slate-400"></lucide-icon>
                                Can Grade Exams
                              </span>
                            </label>
                          </div>
                        </div>

                        <!-- Assignment Info -->
                        <div>
                          <h3 class="section-label mb-2">Details</h3>
                          <div class="text-sm text-slate-600 space-y-1">
                            @if (a.assigned_by_name) {
                              <div>Assigned by: <span class="font-medium text-slate-700">{{ a.assigned_by_name }}</span></div>
                            }
                            <div>Assigned: <span class="font-medium text-slate-700">{{ formatDate(a.assigned_at) }}</span></div>
                          </div>
                        </div>

                        <!-- Remove -->
                        <div class="pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            (click)="onRemoveAssignment(a.id, $event)"
                            [disabled]="removing()"
                            class="btn-danger"
                          >
                            @if (removing()) {
                              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                            } @else {
                              <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                            }
                            Remove Assignment
                          </button>
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
export class LecturerAssignmentPageComponent implements OnInit {
  readonly service = inject(LecturerAssignmentService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);

  // Filter
  readonly searchTerm = signal('');

  // New form
  readonly showNewForm = signal(false);
  readonly selectedLecturerId = signal('');
  readonly selectedCourseId = signal('');
  readonly availableLecturers = signal<AvailableLecturer[]>([]);
  readonly availableCourses = signal<AvailableCourse[]>([]);
  readonly coursesLoading = signal(false);
  readonly adding = signal(false);

  // Expanded row
  readonly expandedAssignmentId = signal<string | null>(null);

  // Permission toggling
  readonly togglingPermission = signal(false);

  // Remove
  readonly removing = signal(false);

  // Computed
  readonly filteredAssignments = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const all = this.service.assignments();
    if (!term) return all;
    return all.filter(
      (a) =>
        (a.full_name?.toLowerCase().includes(term) ?? false) ||
        a.email.toLowerCase().includes(term) ||
        a.course_title.toLowerCase().includes(term),
    );
  });

  readonly totalCount = computed(() => this.filteredAssignments().length);
  readonly lecturerCount = computed(
    () => new Set(this.filteredAssignments().map((a) => a.user_id)).size,
  );
  readonly editCount = computed(
    () => this.filteredAssignments().filter((a) => a.can_edit).length,
  );
  readonly gradeCount = computed(
    () => this.filteredAssignments().filter((a) => a.can_grade).length,
  );

  readonly icons = {
    UserCog,
    Search,
    Loader2,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    Pencil,
    ClipboardCheck,
    Trash2,
    Info,
  };

  ngOnInit() {
    this.service.loadAssignments();
  }

  onToggleNewForm() {
    const showing = !this.showNewForm();
    this.showNewForm.set(showing);
    if (showing) {
      this.selectedLecturerId.set('');
      this.selectedCourseId.set('');
      this.availableCourses.set([]);
      this.loadLecturers();
    }
  }

  cancelNewForm() {
    this.showNewForm.set(false);
  }

  private async loadLecturers() {
    try {
      const lecturers = await this.service.loadAvailableLecturers();
      this.availableLecturers.set(lecturers);
    } catch {
      this.#toast.error('Failed to load lecturers');
    }
  }

  async onLecturerChange(lecturerId: string) {
    this.selectedLecturerId.set(lecturerId);
    this.selectedCourseId.set('');
    this.availableCourses.set([]);

    if (!lecturerId) return;

    this.coursesLoading.set(true);
    try {
      const courses = await this.service.loadAvailableCourses(lecturerId);
      this.availableCourses.set(courses);
    } catch {
      this.#toast.error('Failed to load courses');
    } finally {
      this.coursesLoading.set(false);
    }
  }

  async onAddAssignment() {
    const lecturerId = this.selectedLecturerId();
    const courseId = this.selectedCourseId();
    if (!lecturerId || !courseId) return;

    this.adding.set(true);

    try {
      await this.service.addAssignment(lecturerId, courseId);
      this.#toast.success('Assignment added');
      this.selectedLecturerId.set('');
      this.selectedCourseId.set('');
      this.availableCourses.set([]);
      await this.service.loadAssignments();
      await this.loadLecturers();
    } catch (err: any) {
      this.#toast.error(err?.message || 'Failed to add assignment');
    } finally {
      this.adding.set(false);
    }
  }

  onExpandAssignment(assignment: LecturerAssignment) {
    this.expandedAssignmentId.set(
      this.expandedAssignmentId() === assignment.id ? null : assignment.id,
    );
  }

  async onTogglePermission(
    assignment: LecturerAssignment,
    field: 'can_edit' | 'can_grade',
    checked: boolean,
  ) {
    this.togglingPermission.set(true);

    try {
      await this.service.updatePermissions(assignment.id, {
        [field]: checked,
      });
      this.#toast.success('Permissions updated');
      await this.service.loadAssignments();
    } catch (err: any) {
      this.#toast.error(err?.message || 'Failed to update permissions');
    } finally {
      this.togglingPermission.set(false);
    }
  }

  async onRemoveAssignment(id: string, event: Event) {
    event.stopPropagation();
    this.removing.set(true);

    try {
      await this.service.removeAssignment(id);
      this.#toast.success('Assignment removed');
      this.expandedAssignmentId.set(null);
      await this.service.loadAssignments();
    } catch (err: any) {
      this.#toast.error(err?.message || 'Failed to remove assignment');
    } finally {
      this.removing.set(false);
    }
  }

  readonly formatDate = formatDate;
}
