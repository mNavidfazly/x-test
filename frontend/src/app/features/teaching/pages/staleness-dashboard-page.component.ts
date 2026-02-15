import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule, LucideIconData, Clock, Search, Loader2,
  AlertTriangle, CheckCircle2, Package, ExternalLink,
  ChevronDown, ChevronRight, CalendarClock,
  Video, FileText, Type, HelpCircle, ClipboardCheck,
} from 'lucide-angular';
import { StalenessService } from '../../../core/services/staleness.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatDate } from '../../../core/utils/date.utils';
import { extractErrorMessage } from '../../../core/utils/error.utils';

@Component({
  selector: 'app-staleness-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.Clock" [size]="24"></lucide-icon>
          Content Staleness
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700">
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
            class="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="statusFilter()"
          (change)="statusFilter.set($any($event.target).value)"
        >
          <option value="all">All Status</option>
          <option value="has_stale">Has Stale Modules</option>
          <option value="has_postponed">Has Postponed</option>
          <option value="all_fresh">All Fresh</option>
          <option value="no_modules">No Modules</option>
        </select>
        @if (searchTerm() || statusFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="text-xs text-slate-500 hover:text-slate-700 underline"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total Modules</div>
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalModules() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Stale Modules</div>
          <div class="text-2xl font-bold text-rose-600 tabular-nums">{{ staleModules() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Fresh Modules</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ freshModules() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Courses</div>
          <div class="text-2xl font-bold text-slate-600 tabular-nums">{{ filteredCourses().length }}</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading staleness data...</span>
        </div>
      } @else if (service.error()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ service.error() }}
        </div>
      } @else if (filteredCourses().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.CheckCircle2" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No courses found.</p>
        </div>
      } @else {
        <!-- Courses table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-3 w-8"></th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Course</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Modules</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Stale / Fresh</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Threshold</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (course of filteredCourses(); track course.id) {
                <tr
                  class="border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50"
                  [class.bg-slate-50]="expandedCourseId() === course.id"
                  (click)="toggleCourse(course.id)"
                >
                  <td class="px-3 py-3 text-slate-400">
                    @if (expandedCourseId() === course.id) {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronRight" [size]="16"></lucide-icon>
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-700 font-medium truncate max-w-[200px]">{{ course.title }}</td>
                  <td class="px-3 py-3 text-slate-600 tabular-nums">{{ course.totalModuleCount }}</td>
                  <td class="px-3 py-3 tabular-nums">
                    @if (course.totalModuleCount > 0) {
                      <span class="text-rose-600 font-semibold">{{ course.staleModuleCount }}</span>
                      <span class="text-slate-400 mx-1">/</span>
                      <span class="text-emerald-600 font-semibold">{{ course.freshModuleCount }}</span>
                    } @else {
                      <span class="text-slate-400">\u2014</span>
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-600 tabular-nums">{{ course.thresholdDays }} days</td>
                  <td class="px-3 py-3">
                    @if (course.hasStaleModules) {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700">
                        <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="mr-1"></lucide-icon>
                        Has Stale
                      </span>
                    } @else if (course.postponedModuleCount > 0) {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                        <lucide-icon [img]="icons.CalendarClock" [size]="12" class="mr-1"></lucide-icon>
                        {{ course.postponedModuleCount }} Postponed
                      </span>
                    } @else if (course.totalModuleCount === 0) {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                        <lucide-icon [img]="icons.Package" [size]="12" class="mr-1"></lucide-icon>
                        No Modules
                      </span>
                    } @else {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                        All Fresh
                      </span>
                    }
                  </td>
                  <td class="px-3 py-3" (click)="$event.stopPropagation()">
                    <div class="flex items-center gap-2">
                      <a
                        [routerLink]="['/courses', course.id]"
                        class="text-teal-600 hover:text-teal-700 text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <lucide-icon [img]="icons.ExternalLink" [size]="12"></lucide-icon>
                        View
                      </a>
                      @if (course.hasStaleModules) {
                        <button
                          type="button"
                          (click)="onPostponeAll(course.id)"
                          [disabled]="postponingCourseId() === course.id"
                          class="text-blue-600 hover:text-blue-700 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          @if (postponingCourseId() === course.id) {
                            <lucide-icon [img]="icons.Loader2" [size]="12" class="animate-spin"></lucide-icon>
                          } @else {
                            <lucide-icon [img]="icons.CalendarClock" [size]="12"></lucide-icon>
                          }
                          Postpone All
                        </button>
                      }
                    </div>
                  </td>
                </tr>
                <!-- Expanded module detail row -->
                @if (expandedCourseId() === course.id && course.totalModuleCount > 0) {
                  <tr class="border-b border-slate-100">
                    <td colspan="7" class="px-6 py-4 bg-slate-50">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="text-xs text-slate-500 uppercase tracking-wide">
                            <th class="pb-2 text-left w-10">Type</th>
                            <th class="pb-2 text-left">Module</th>
                            <th class="pb-2 text-left">Last Updated</th>
                            <th class="pb-2 text-left">Age</th>
                            <th class="pb-2 text-left">Status</th>
                            <th class="pb-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (mod of course.modules; track mod.id) {
                            <tr class="border-t border-slate-100 first:border-t-0">
                              <td class="py-2 text-slate-400">
                                <lucide-icon [img]="moduleTypeIcon(mod.moduleType)" [size]="14"></lucide-icon>
                              </td>
                              <td class="py-2 text-slate-700">{{ mod.title }}</td>
                              <td class="py-2 text-slate-600">{{ formatDate(mod.updatedAt) }}</td>
                              <td class="py-2 text-slate-600 tabular-nums">{{ mod.daysSinceUpdate }} days ago</td>
                              <td class="py-2">
                                @if (mod.isPostponed) {
                                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                                    Postponed until {{ formatDate(mod.postponedUntil!) }}
                                  </span>
                                } @else if (mod.isStale) {
                                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700">
                                    Stale ({{ mod.daysOverdue }}d overdue)
                                  </span>
                                } @else {
                                  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                                    Fresh
                                  </span>
                                }
                              </td>
                              <td class="py-2">
                                @if (mod.isStale) {
                                  <button
                                    type="button"
                                    (click)="onPostponeModule(mod.id)"
                                    [disabled]="postponingId() === mod.id"
                                    class="text-blue-600 hover:text-blue-700 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                                  >
                                    @if (postponingId() === mod.id) {
                                      <lucide-icon [img]="icons.Loader2" [size]="12" class="animate-spin"></lucide-icon>
                                    } @else {
                                      <lucide-icon [img]="icons.CalendarClock" [size]="12"></lucide-icon>
                                    }
                                    Postpone
                                  </button>
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </td>
                  </tr>
                }
                @if (expandedCourseId() === course.id && course.totalModuleCount === 0) {
                  <tr class="border-b border-slate-100">
                    <td colspan="7" class="px-6 py-4 text-sm text-slate-500 text-center bg-slate-50">
                      This course has no modules yet.
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
export class StalenessDashboardPageComponent implements OnInit {
  readonly service = inject(StalenessService);
  readonly #toast = inject(ToastService);
  readonly icons = {
    Clock, Search, Loader2, AlertTriangle, CheckCircle2, Package, ExternalLink,
    ChevronDown, ChevronRight, CalendarClock,
  };
  readonly formatDate = formatDate;

  readonly #moduleTypeIcons: Record<string, LucideIconData> = {
    video: Video, pdf: FileText, markdown: Type,
    quiz: HelpCircle, exam: ClipboardCheck, external_quiz: ExternalLink,
  };

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'all' | 'has_stale' | 'has_postponed' | 'all_fresh' | 'no_modules'>('all');
  readonly expandedCourseId = signal<string | null>(null);
  readonly postponingId = signal<string | null>(null);
  readonly postponingCourseId = signal<string | null>(null);

  readonly filteredCourses = computed(() => {
    let courses = this.service.courses();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();

    if (search) {
      courses = courses.filter(c => c.title.toLowerCase().includes(search));
    }

    if (status === 'has_stale') {
      courses = courses.filter(c => c.hasStaleModules);
    } else if (status === 'has_postponed') {
      courses = courses.filter(c => c.postponedModuleCount > 0);
    } else if (status === 'all_fresh') {
      courses = courses.filter(c => !c.hasStaleModules && c.postponedModuleCount === 0 && c.totalModuleCount > 0);
    } else if (status === 'no_modules') {
      courses = courses.filter(c => c.totalModuleCount === 0);
    }

    return courses;
  });

  readonly totalModules = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.totalModuleCount, 0));
  readonly staleModules = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.staleModuleCount, 0));
  readonly freshModules = computed(() => this.filteredCourses().reduce((sum, c) => sum + c.freshModuleCount, 0));

  ngOnInit() {
    this.service.loadStalenessData();
  }

  moduleTypeIcon(type: string): LucideIconData {
    return this.#moduleTypeIcons[type] ?? FileText;
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

  async onPostponeModule(moduleId: string) {
    this.postponingId.set(moduleId);
    try {
      await this.service.postponeModule(moduleId);
      this.#toast.success('Module postponed for 30 days');
      await this.service.loadStalenessData();
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to postpone'));
    } finally {
      this.postponingId.set(null);
    }
  }

  async onPostponeAll(courseId: string) {
    this.postponingCourseId.set(courseId);
    try {
      await this.service.postponeAllStaleModules(courseId);
      this.#toast.success('All stale modules postponed for 30 days');
      await this.service.loadStalenessData();
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to postpone'));
    } finally {
      this.postponingCourseId.set(null);
    }
  }
}
