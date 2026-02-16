import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  GraduationCap, Search, ChevronDown, ChevronRight,
  ClipboardCheck, MessageSquare, Flag, Clock,
  ExternalLink, BarChart3, Pencil, CheckCircle2,
  AlertTriangle, Users,
} from 'lucide-angular';
import { TeachingOverviewService } from '../../../core/services/teaching-overview.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';

@Component({
  selector: 'app-teaching-overview-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.GraduationCap" [size]="24"></lucide-icon>
          Teaching Overview
          <span class="badge-primary">
            {{ service.courses().length }}
          </span>
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by course title..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="search-input"
          />
        </div>
        <app-custom-select
          [options]="statusOptions"
          [value]="statusFilter()"
          (valueChange)="statusFilter.set($any($event))"
          ariaLabel="Status filter"
        />
        @if (searchTerm() || statusFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Pending Exams" [value]="totalPendingExams()" color="text-amber-600" />
        <app-stat-card label="Open Questions" [value]="totalPendingQuestions()" color="text-amber-600" />
        <app-stat-card label="Open Issues" [value]="totalOpenIssues()" color="text-amber-600" />
        <app-stat-card label="Stale Modules" [value]="totalStaleModules()" color="text-rose-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading teaching overview..." />
      } @else if (service.error()) {
        <app-error-alert [message]="service.error()!" />
      } @else if (filteredCourses().length === 0) {
        <app-empty-state [icon]="icons.GraduationCap" message="No courses found." />
      } @else {
        <!-- Courses table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="px-3 py-3 w-8"></th>
                <th class="th">Course</th>
                <th class="th">Permissions</th>
                <th class="th">Learners</th>
                <th class="th">Exams</th>
                <th class="th">Questions</th>
                <th class="th">Issues</th>
                <th class="th">Staleness</th>
              </tr>
            </thead>
            <tbody>
              @for (course of filteredCourses(); track course.id) {
                <tr
                  class="table-row cursor-pointer"
                  [class.bg-slate-50]="expandedCourseId() === course.id"
                  (click)="toggleCourse(course.id)"
                >
                  <td class="table-cell text-slate-400">
                    @if (expandedCourseId() === course.id) {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronRight" [size]="16"></lucide-icon>
                    }
                  </td>
                  <td class="table-cell text-slate-700 font-medium truncate max-w-[200px]">{{ course.title }}</td>
                  <td class="table-cell">
                    <div class="flex items-center gap-1">
                      @if (course.canEdit) {
                        <span class="badge-primary">Edit</span>
                      }
                      @if (course.canGrade) {
                        <span class="badge-info">Grade</span>
                      }
                      @if (!course.canEdit && !course.canGrade) {
                        <span class="badge-neutral">Read</span>
                      }
                    </div>
                  </td>
                  <td class="table-cell tabular-nums">{{ course.enrolledCount }}</td>
                  <td class="table-cell tabular-nums">
                    @if (course.canGrade) {
                      <span [class]="course.pendingExams > 0 ? 'text-amber-600 font-semibold' : 'text-slate-600'">
                        {{ course.pendingExams }}
                      </span>
                    } @else {
                      <span class="text-slate-400">\u2014</span>
                    }
                  </td>
                  <td class="table-cell tabular-nums">
                    <span [class]="course.pendingQuestions > 0 ? 'text-amber-600 font-semibold' : 'text-slate-600'">
                      {{ course.pendingQuestions }}
                    </span>
                  </td>
                  <td class="table-cell tabular-nums">
                    <span [class]="course.openIssues > 0 ? 'text-amber-600 font-semibold' : 'text-slate-600'">
                      {{ course.openIssues }}
                    </span>
                  </td>
                  <td class="table-cell">
                    @if (course.totalModules === 0) {
                      <app-status-badge variant="neutral">No modules</app-status-badge>
                    } @else if (course.staleModules > 0) {
                      <app-status-badge variant="warning">
                        <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="mr-1"></lucide-icon>
                        {{ course.staleModules }} stale
                      </app-status-badge>
                    } @else {
                      <app-status-badge variant="success">
                        <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                        All fresh
                      </app-status-badge>
                    }
                  </td>
                </tr>
                <!-- Expanded detail row -->
                @if (expandedCourseId() === course.id) {
                  <tr class="border-b border-slate-100">
                    <td colspan="8" class="expand-panel px-6 py-4">
                      <div class="flex flex-col sm:flex-row gap-6 sm:gap-8">
                        <!-- Left: Course info -->
                        <div class="flex-1">
                          <h3 class="text-lg font-semibold text-slate-800 mb-2">{{ course.title }}</h3>
                          <div class="space-y-1 text-sm text-slate-600">
                            <div class="flex items-center gap-2">
                              <lucide-icon [img]="icons.Users" [size]="14" class="text-slate-400"></lucide-icon>
                              {{ course.enrolledCount }} enrolled learners
                            </div>
                            <div>
                              @if (course.canEdit && course.canGrade) {
                                You can edit content and grade exams for this course.
                              } @else if (course.canEdit) {
                                You can edit content for this course.
                              } @else if (course.canGrade) {
                                You can grade exams for this course.
                              } @else {
                                You have read-only access to this course.
                              }
                            </div>
                          </div>
                        </div>
                        <!-- Right: Action links -->
                        <div class="flex-1">
                          <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Actions</h4>
                          <div class="space-y-2">
                            @if (course.canGrade) {
                              <a
                                routerLink="/teaching/grading"
                                [queryParams]="{ courseId: course.id }"
                                class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                              >
                                <lucide-icon [img]="icons.ClipboardCheck" [size]="14"></lucide-icon>
                                @if (course.pendingExams > 0) {
                                  {{ course.pendingExams }} pending exam{{ course.pendingExams === 1 ? '' : 's' }}
                                } @else {
                                  Exam grading
                                }
                              </a>
                            }
                            <a
                              routerLink="/teaching/questions"
                              [queryParams]="{ courseId: course.id }"
                              class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                            >
                              <lucide-icon [img]="icons.MessageSquare" [size]="14"></lucide-icon>
                              @if (course.pendingQuestions > 0) {
                                {{ course.pendingQuestions }} unanswered question{{ course.pendingQuestions === 1 ? '' : 's' }}
                              } @else {
                                Questions board
                              }
                            </a>
                            <a
                              routerLink="/teaching/issues"
                              [queryParams]="{ courseId: course.id }"
                              class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                            >
                              <lucide-icon [img]="icons.Flag" [size]="14"></lucide-icon>
                              @if (course.openIssues > 0) {
                                {{ course.openIssues }} open issue{{ course.openIssues === 1 ? '' : 's' }}
                              } @else {
                                Issue management
                              }
                            </a>
                            @if (course.canEdit) {
                              <a
                                routerLink="/teaching/staleness"
                                class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                              >
                                <lucide-icon [img]="icons.Clock" [size]="14"></lucide-icon>
                                @if (course.staleModules > 0) {
                                  {{ course.staleModules }} stale module{{ course.staleModules === 1 ? '' : 's' }}
                                } @else {
                                  Content staleness
                                }
                              </a>
                            }
                            <a
                              routerLink="/analytics/progress"
                              class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                            >
                              <lucide-icon [img]="icons.BarChart3" [size]="14"></lucide-icon>
                              View learner progress
                            </a>
                            @if (course.canEdit) {
                              <a
                                [routerLink]="['/courses', course.id, 'edit']"
                                class="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 transition-colors"
                              >
                                <lucide-icon [img]="icons.Pencil" [size]="14"></lucide-icon>
                                Edit course
                              </a>
                            }
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
export class TeachingOverviewPageComponent implements OnInit {
  readonly service = inject(TeachingOverviewService);
  readonly icons = {
    GraduationCap, Search, ChevronDown, ChevronRight,
    ClipboardCheck, MessageSquare, Flag, Clock,
    ExternalLink, BarChart3, Pencil, CheckCircle2,
    AlertTriangle, Users,
  };

  readonly statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Courses' },
    { value: 'needs_attention', label: 'Needs Attention' },
    { value: 'all_clear', label: 'All Clear' },
  ];

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'needs_attention' | 'all_clear'>('all');
  readonly expandedCourseId = signal<string | null>(null);

  readonly filteredCourses = computed(() => {
    let courses = this.service.courses();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();

    if (search) {
      courses = courses.filter(c => c.title.toLowerCase().includes(search));
    }

    if (status === 'needs_attention') {
      courses = courses.filter(c => c.totalActionItems > 0);
    } else if (status === 'all_clear') {
      courses = courses.filter(c => c.totalActionItems === 0);
    }

    return courses;
  });

  readonly totalPendingExams = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.pendingExams, 0));
  readonly totalPendingQuestions = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.pendingQuestions, 0));
  readonly totalOpenIssues = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.openIssues, 0));
  readonly totalStaleModules = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.staleModules, 0));

  ngOnInit() {
    this.service.loadOverview();
  }

  toggleCourse(courseId: string) {
    this.expandedCourseId.set(
      this.expandedCourseId() === courseId ? null : courseId,
    );
  }

  clearFilters() {
    this.searchTerm.set('');
    this.statusFilter.set('all');
  }
}
