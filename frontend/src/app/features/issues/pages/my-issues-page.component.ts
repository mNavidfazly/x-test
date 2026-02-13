import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Flag, Clock, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, BookOpen, Loader2 } from 'lucide-angular';
import { IssueService } from '../../../core/services/issue.service';
import { IssueStatus, IssueType } from '../../../core/models/issue.model';
import { LucideIconData } from 'lucide-angular';

@Component({
  selector: 'app-my-issues-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
          <lucide-icon [img]="icons.Flag" [size]="20"></lucide-icon>
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900">My Issues</h1>
          <p class="text-sm text-slate-500">Issues you've reported on courses</p>
        </div>
        @if (issueService.issues().length > 0) {
          <span class="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {{ issueService.issues().length }}
          </span>
        }
      </div>

      @if (issueService.loading()) {
        <!-- Loading skeleton -->
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="animate-pulse bg-white border border-slate-200 rounded-xl p-4">
              <div class="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          }
        </div>
      } @else if (issueService.error()) {
        <!-- Error -->
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {{ issueService.error() }}
        </div>
      } @else if (issueService.issues().length === 0) {
        <!-- Empty state -->
        <div class="text-center py-16">
          <lucide-icon [img]="icons.Flag" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm font-semibold text-slate-600">No issues reported yet</p>
          <p class="text-xs text-slate-400 mt-1">You can report issues from any module page.</p>
        </div>
      } @else {
        <!-- Issue list -->
        <div class="space-y-3">
          @for (issue of issueService.issues(); track issue.id) {
            <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <!-- Collapsed row -->
              <button
                type="button"
                (click)="toggleExpand(issue.id)"
                class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <!-- Status badge -->
                <span [class]="statusBadgeClass(issue.status)">
                  <lucide-icon [img]="statusIcon(issue.status)" [size]="12"></lucide-icon>
                  {{ statusLabel(issue.status) }}
                </span>

                <!-- Issue type -->
                <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 shrink-0">
                  {{ issueTypeLabel(issue.issue_type) }}
                </span>

                <!-- Course + Module -->
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold text-slate-900">{{ issue.course?.title ?? 'Unknown Course' }}</span>
                  @if (issue.module) {
                    <span class="text-xs text-slate-400"> / {{ issue.module.title }}</span>
                  }
                  <p class="text-sm text-slate-600 truncate mt-0.5">{{ issue.description }}</p>
                </div>

                <!-- Timestamp + chevron -->
                <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">{{ formatRelativeTime(issue.created_at) }}</span>
                <lucide-icon [img]="expandedId() === issue.id ? icons.ChevronUp : icons.ChevronDown" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
              </button>

              <!-- Expanded detail -->
              @if (expandedId() === issue.id) {
                <div class="px-4 pb-4 border-t border-slate-100">
                  <!-- Full description -->
                  <div class="mt-3">
                    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Description</p>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ issue.description }}</p>
                  </div>

                  <!-- Link to module -->
                  @if (issue.module_id) {
                    <a
                      [routerLink]="['/courses', issue.course_id, 'modules', issue.module_id]"
                      class="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-semibold mt-2 transition-colors"
                    >
                      <lucide-icon [img]="icons.BookOpen" [size]="12"></lucide-icon>
                      Go to module
                    </a>
                  }

                  <!-- Resolution info -->
                  @if (issue.resolved_at) {
                    <div class="mt-4">
                      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Resolution</p>
                      <div class="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <p class="text-sm text-slate-700">This issue has been resolved.</p>
                        <div class="mt-2 text-xs text-slate-500">
                          <span>{{ formatRelativeTime(issue.resolved_at) }}</span>
                        </div>
                      </div>
                    </div>
                  }

                  <!-- Closed without resolution -->
                  @if (issue.status === 'closed' && !issue.resolved_at) {
                    <p class="mt-4 text-sm text-slate-500">This issue has been closed.</p>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class MyIssuesPageComponent implements OnInit {
  readonly issueService = inject(IssueService);

  readonly icons = { Flag, Clock, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, BookOpen, Loader2 };

  readonly expandedId = signal<string | null>(null);

  ngOnInit() {
    this.issueService.loadMyIssues();
  }

  toggleExpand(id: string) {
    this.expandedId.update(current => current === id ? null : id);
  }

  statusBadgeClass(status: IssueStatus): string {
    const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0';
    switch (status) {
      case 'open': return `${base} bg-amber-100 text-amber-700`;
      case 'investigating': return `${base} bg-blue-100 text-blue-700`;
      case 'resolved': return `${base} bg-emerald-100 text-emerald-700`;
      case 'closed': return `${base} bg-slate-100 text-slate-600`;
    }
  }

  statusLabel(status: IssueStatus): string {
    switch (status) {
      case 'open': return 'Open';
      case 'investigating': return 'Investigating';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
    }
  }

  statusIcon(status: IssueStatus): LucideIconData {
    switch (status) {
      case 'open': return this.icons.Clock;
      case 'investigating': return this.icons.Search;
      case 'resolved': return this.icons.CheckCircle2;
      case 'closed': return this.icons.XCircle;
    }
  }

  issueTypeLabel(type: IssueType): string {
    switch (type) {
      case 'content_error': return 'Content Error';
      case 'technical': return 'Technical';
      case 'accessibility': return 'Accessibility';
      case 'other': return 'Other';
    }
  }

  formatRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
