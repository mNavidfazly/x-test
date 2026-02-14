import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  LucideAngularModule, Flag, Search, Loader2,
  Clock, Eye, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { IssueService } from '../../../core/services/issue.service';
import { ToastService } from '../../../core/services/toast.service';
import { IssueForBoard, IssueStatus, IssueType } from '../../../core/models/issue.model';
import { formatRelativeTime } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-issue-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.Flag" [size]="24"></lucide-icon>
          Issue Management
          @if (openCount() > 0) {
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
              {{ openCount() }} open
            </span>
          }
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by reporter or description..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="selectedCourseId() ?? ''"
          (change)="selectedCourseId.set($any($event.target).value || null)"
        >
          <option value="">All Courses</option>
          @for (course of issueService.boardCourses(); track course.id) {
            <option [value]="course.id">{{ course.title }}</option>
          }
        </select>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="statusFilter()"
          (change)="statusFilter.set($any($event.target).value)"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="typeFilter()"
          (change)="typeFilter.set($any($event.target).value)"
        >
          <option value="all">All Types</option>
          <option value="content_error">Content Error</option>
          <option value="technical">Technical</option>
          <option value="accessibility">Accessibility</option>
          <option value="other">Other</option>
        </select>
        @if (searchTerm() || selectedCourseId() || statusFilter() !== 'all' || typeFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="text-xs text-slate-500 hover:text-slate-700 underline"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total</div>
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalIssues() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Open</div>
          <div class="text-2xl font-bold text-amber-600 tabular-nums">{{ openCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Investigating</div>
          <div class="text-2xl font-bold text-blue-600 tabular-nums">{{ investigatingCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Resolved</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ resolvedCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Closed</div>
          <div class="text-2xl font-bold text-slate-600 tabular-nums">{{ closedCount() }}</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (issueService.boardLoading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading issues...</span>
        </div>
      } @else if (issueService.boardError()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ issueService.boardError() }}
        </div>
      } @else if (filteredIssues().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.Flag" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No issues found.</p>
        </div>
      } @else {
        <!-- Issues table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reporter</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Course</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Reported</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (issue of filteredIssues(); track issue.id) {
                <tr
                  class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  (click)="onExpandIssue(issue)"
                >
                  <td class="px-3 py-3 text-slate-700 truncate max-w-[200px]">
                    {{ issue.reporter?.email ?? '[Unknown]' }}
                    @if (issue.reporter?.full_name) {
                      <div class="text-xs text-slate-400">{{ issue.reporter!.full_name }}</div>
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ issue.course?.title ?? '\u2014' }}</td>
                  <td class="px-3 py-3 text-slate-600">{{ formatIssueType(issue.issue_type) }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[200px]">{{ truncateText(issue.description, 60) }}</td>
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatRelativeTime(issue.created_at) }}</td>
                  <td class="px-3 py-3">
                    @switch (issue.status) {
                      @case ('open') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                          <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                          Open
                        </span>
                      }
                      @case ('investigating') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
                          <lucide-icon [img]="icons.Eye" [size]="12" class="mr-1"></lucide-icon>
                          Investigating
                        </span>
                      }
                      @case ('resolved') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                          Resolved
                        </span>
                      }
                      @case ('closed') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
                          <lucide-icon [img]="icons.XCircle" [size]="12" class="mr-1"></lucide-icon>
                          Closed
                        </span>
                      }
                    }
                  </td>
                </tr>

                <!-- Expanded detail row -->
                @if (expandedIssueId() === issue.id) {
                  <tr>
                    <td colspan="6" class="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                      <div class="max-w-2xl">
                        <!-- Full description -->
                        <div class="mb-4">
                          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</div>
                          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ issue.description }}</p>
                        </div>

                        <!-- Reporter info -->
                        <div class="mb-4 flex gap-6">
                          <div>
                            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Reporter</div>
                            <p class="text-sm text-slate-700">{{ issue.reporter?.full_name ?? '[Unknown]' }}</p>
                            <p class="text-xs text-slate-500">{{ issue.reporter?.email ?? '' }}</p>
                          </div>
                          <div>
                            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Module</div>
                            <p class="text-sm text-slate-700">{{ issue.module?.title ?? '\u2014' }}</p>
                          </div>
                          <div>
                            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Type</div>
                            <p class="text-sm text-slate-700">{{ formatIssueType(issue.issue_type) }}</p>
                          </div>
                        </div>

                        <!-- Status dropdown -->
                        <div class="mb-3">
                          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Status</label>
                          <select
                            class="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                            [value]="editStatus()"
                            (change)="editStatus.set($any($event.target).value)"
                          >
                            <option value="open">Open</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>

                        <!-- Internal notes -->
                        <div class="mb-3">
                          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Internal Notes</label>
                          <textarea
                            rows="3"
                            [value]="editInternalNotes()"
                            (input)="editInternalNotes.set($any($event.target).value)"
                            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                            placeholder="Add internal notes (not visible to reporter)..."
                          ></textarea>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex items-center gap-3">
                          <button
                            type="button"
                            (click)="onSaveIssue(issue.id)"
                            [disabled]="saving()"
                            class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
                          >
                            @if (saving()) {
                              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                            } @else {
                              <lucide-icon [img]="icons.Save" [size]="14"></lucide-icon>
                            }
                            Save Changes
                          </button>
                          <button
                            type="button"
                            (click)="expandedIssueId.set(null)"
                            class="text-sm text-slate-600 hover:text-slate-800"
                          >Cancel</button>
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
export class IssueManagementPageComponent implements OnInit {
  readonly issueService = inject(IssueService);
  #toast = inject(ToastService);

  readonly icons = { Flag, Search, Loader2, Clock, Eye, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp };
  readonly formatRelativeTime = formatRelativeTime;

  // Filters
  readonly searchTerm = signal('');
  readonly selectedCourseId = signal<string | null>(null);
  readonly statusFilter = signal<'all' | IssueStatus>('all');
  readonly typeFilter = signal<'all' | IssueType>('all');

  // Expanded row state
  readonly expandedIssueId = signal<string | null>(null);
  readonly editStatus = signal<IssueStatus>('open');
  readonly editInternalNotes = signal('');
  readonly saving = signal(false);

  // Filtered issues
  readonly filteredIssues = computed(() => {
    let issues = this.issueService.boardIssues();
    const search = this.searchTerm().toLowerCase();
    const courseId = this.selectedCourseId();
    const status = this.statusFilter();
    const type = this.typeFilter();

    if (search) {
      issues = issues.filter(i =>
        (i.reporter?.email ?? '').toLowerCase().includes(search) ||
        (i.reporter?.full_name ?? '').toLowerCase().includes(search) ||
        i.description.toLowerCase().includes(search),
      );
    }

    if (courseId) {
      issues = issues.filter(i => i.course_id === courseId);
    }

    if (status !== 'all') {
      issues = issues.filter(i => i.status === status);
    }

    if (type !== 'all') {
      issues = issues.filter(i => i.issue_type === type);
    }

    return issues;
  });

  // Summary stats
  readonly totalIssues = computed(() => this.filteredIssues().length);

  readonly openCount = computed(() =>
    this.filteredIssues().filter(i => i.status === 'open').length,
  );

  readonly investigatingCount = computed(() =>
    this.filteredIssues().filter(i => i.status === 'investigating').length,
  );

  readonly resolvedCount = computed(() =>
    this.filteredIssues().filter(i => i.status === 'resolved').length,
  );

  readonly closedCount = computed(() =>
    this.filteredIssues().filter(i => i.status === 'closed').length,
  );

  ngOnInit() {
    this.issueService.loadBoardIssues();
  }

  onExpandIssue(issue: IssueForBoard) {
    if (this.expandedIssueId() === issue.id) {
      this.expandedIssueId.set(null);
      return;
    }
    this.expandedIssueId.set(issue.id);
    this.editStatus.set(issue.status);
    this.editInternalNotes.set(issue.internal_notes ?? '');
  }

  async onSaveIssue(issueId: string) {
    this.saving.set(true);

    try {
      await this.issueService.updateIssue(issueId, {
        status: this.editStatus(),
        internal_notes: this.editInternalNotes(),
      });
      this.#toast.success('Issue updated');
      this.expandedIssueId.set(null);
      await this.issueService.loadBoardIssues();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      this.#toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCourseId.set(null);
    this.statusFilter.set('all');
    this.typeFilter.set('all');
  }

  formatIssueType(type: IssueType): string {
    switch (type) {
      case 'content_error': return 'Content Error';
      case 'technical': return 'Technical';
      case 'accessibility': return 'Accessibility';
      case 'other': return 'Other';
    }
  }

  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
