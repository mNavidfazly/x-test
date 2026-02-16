import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule, Flag, Search, Loader2,
  Clock, Eye, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { IssueService } from '../../../core/services/issue.service';
import { ToastService } from '../../../core/services/toast.service';
import { IssueForBoard, IssueStatus, IssueType } from '../../../core/models/issue.model';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar.component';

@Component({
  selector: 'app-issue-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, UserAvatarComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.Flag" [size]="24"></lucide-icon>
          Issue Management
          @if (openCount() > 0) {
            <app-status-badge variant="warning">{{ openCount() }} open</app-status-badge>
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
            class="search-input"
          />
        </div>
        <app-custom-select
          [options]="courseOptions()"
          [value]="selectedCourseId() ?? ''"
          (valueChange)="selectedCourseId.set($event || null)"
          ariaLabel="Course filter"
        />
        <app-custom-select
          [options]="statusFilterOptions"
          [value]="statusFilter()"
          (valueChange)="statusFilter.set($any($event))"
          ariaLabel="Status filter"
        />
        <app-custom-select
          [options]="typeOptions"
          [value]="typeFilter()"
          (valueChange)="typeFilter.set($any($event))"
          ariaLabel="Type filter"
        />
        @if (searchTerm() || selectedCourseId() || statusFilter() !== 'all' || typeFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <app-stat-card label="Total" [value]="totalIssues()" />
        <app-stat-card label="Open" [value]="openCount()" color="text-amber-600" />
        <app-stat-card label="Investigating" [value]="investigatingCount()" color="text-blue-600" />
        <app-stat-card label="Resolved" [value]="resolvedCount()" color="text-emerald-600" />
        <app-stat-card label="Closed" [value]="closedCount()" color="text-slate-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (issueService.boardLoading()) {
        <app-loading-spinner message="Loading issues..." />
      } @else if (issueService.boardError()) {
        <div class="mb-4"><app-error-alert [message]="issueService.boardError()!" /></div>
      } @else if (filteredIssues().length === 0) {
        <app-empty-state [icon]="icons.Flag" message="No issues found." />
      } @else {
        <!-- Issues table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th">Reporter</th>
                <th class="th">Course</th>
                <th class="th">Type</th>
                <th class="th">Description</th>
                <th class="th">Reported</th>
                <th class="th">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (issue of filteredIssues(); track issue.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandIssue(issue)"
                >
                  <td class="table-cell">
                    <div class="flex items-center gap-2 max-w-[200px]">
                      <app-user-avatar
                        [avatarUrl]="issue.reporter?.avatar_url ?? null"
                        [name]="issue.reporter?.full_name ?? issue.reporter?.email ?? '?'"
                        size="sm"
                        class="shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="text-sm text-slate-700 truncate">{{ issue.reporter?.email ?? '[Unknown]' }}</div>
                        @if (issue.reporter?.full_name) {
                          <div class="text-xs text-slate-400 truncate">{{ issue.reporter!.full_name }}</div>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="table-cell truncate max-w-[150px]">{{ issue.course?.title ?? '\u2014' }}</td>
                  <td class="table-cell">{{ formatIssueType(issue.issue_type) }}</td>
                  <td class="table-cell truncate max-w-[200px]">{{ truncateText(issue.description, 60) }}</td>
                  <td class="table-cell text-slate-500 text-xs">{{ formatRelativeTime(issue.created_at) }}</td>
                  <td class="table-cell">
                    @switch (issue.status) {
                      @case ('open') {
                        <app-status-badge variant="warning">
                          <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                          Open
                        </app-status-badge>
                      }
                      @case ('investigating') {
                        <app-status-badge variant="info">
                          <lucide-icon [img]="icons.Eye" [size]="12" class="mr-1"></lucide-icon>
                          Investigating
                        </app-status-badge>
                      }
                      @case ('resolved') {
                        <app-status-badge variant="success">
                          <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                          Resolved
                        </app-status-badge>
                      }
                      @case ('closed') {
                        <app-status-badge variant="neutral">
                          <lucide-icon [img]="icons.XCircle" [size]="12" class="mr-1"></lucide-icon>
                          Closed
                        </app-status-badge>
                      }
                    }
                  </td>
                </tr>

                <!-- Expanded detail row -->
                @if (expandedIssueId() === issue.id) {
                  <tr>
                    <td colspan="6" class="expand-panel px-6 py-4">
                      <div class="max-w-2xl">
                        <!-- Full description -->
                        <div class="mb-4">
                          <div class="section-label mb-1">Description</div>
                          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ issue.description }}</p>
                        </div>

                        <!-- Reporter info -->
                        <div class="mb-4 flex gap-6">
                          <div>
                            <div class="section-label mb-1">Reporter</div>
                            <p class="text-sm text-slate-700">{{ issue.reporter?.full_name ?? '[Unknown]' }}</p>
                            <p class="text-xs text-slate-500">{{ issue.reporter?.email ?? '' }}</p>
                          </div>
                          <div>
                            <div class="section-label mb-1">Module</div>
                            <p class="text-sm text-slate-700">{{ issue.module?.title ?? '\u2014' }}</p>
                          </div>
                          <div>
                            <div class="section-label mb-1">Type</div>
                            <p class="text-sm text-slate-700">{{ formatIssueType(issue.issue_type) }}</p>
                          </div>
                        </div>

                        <!-- Status dropdown -->
                        <div class="mb-3">
                          <label class="block section-label mb-1">Status</label>
                          <app-custom-select
                            [options]="editStatusOptions"
                            [value]="editStatus()"
                            (valueChange)="editStatus.set($any($event))"
                            ariaLabel="Issue status"
                          />
                        </div>

                        <!-- Internal notes -->
                        <div class="mb-3">
                          <label class="block section-label mb-1">Internal Notes</label>
                          <textarea
                            rows="3"
                            [value]="editInternalNotes()"
                            (input)="editInternalNotes.set($any($event.target).value)"
                            class="input-field"
                            placeholder="Add internal notes (not visible to reporter)..."
                          ></textarea>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex items-center gap-3">
                          <button
                            type="button"
                            (click)="onSaveIssue(issue.id)"
                            [disabled]="saving()"
                            class="btn-primary"
                          >
                            @if (saving()) {
                              <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
                            } @else {
                              <lucide-icon [img]="icons.Save" [size]="14"></lucide-icon>
                            }
                            Save Changes
                          </button>
                          <button
                            type="button"
                            (click)="expandedIssueId.set(null)"
                            class="btn-ghost"
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
  #route = inject(ActivatedRoute);

  readonly icons = { Flag, Search, Loader2, Clock, Eye, CheckCircle2, XCircle, Save, ChevronDown, ChevronUp };
  readonly formatRelativeTime = formatRelativeTime;

  readonly statusFilterOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'open', label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  readonly typeOptions: SelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'content_error', label: 'Content Error' },
    { value: 'technical', label: 'Technical' },
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'other', label: 'Other' },
  ];

  readonly editStatusOptions: SelectOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'investigating', label: 'Investigating' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  readonly courseOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Courses' },
    ...this.issueService.boardCourses().map(c => ({ value: c.id, label: c.title })),
  ]);

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
    const courseId = this.#route.snapshot.queryParamMap.get('courseId');
    if (courseId) {
      this.selectedCourseId.set(courseId);
    }
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
