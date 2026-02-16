import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Flag, Clock, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, BookOpen } from 'lucide-angular';
import { IssueService } from '../../../core/services/issue.service';
import { IssueType } from '../../../core/models/issue.model';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-my-issues-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, ErrorAlertComponent],
  host: { class: 'block page-enter' },
  template: `
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
          <lucide-icon [img]="icons.Flag" [size]="20"></lucide-icon>
        </div>
        <div>
          <h1 class="page-title">My Issues</h1>
          <p class="text-sm text-slate-500">Issues you've reported on courses</p>
        </div>
        @if (issueService.issues().length > 0) {
          <span class="ml-auto badge-neutral">
            {{ issueService.issues().length }}
          </span>
        }
      </div>

      @if (issueService.loading()) {
        <!-- Loading skeleton -->
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="animate-pulse card p-4">
              <div class="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          }
        </div>
      } @else if (issueService.error()) {
        <app-error-alert [message]="issueService.error()!" />
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
            <div class="card overflow-hidden">
              <!-- Collapsed row -->
              <button
                type="button"
                (click)="toggleExpand(issue.id)"
                class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <!-- Top row: badges + timestamp + chevron -->
                <div class="flex items-center gap-2 mb-1.5">
                  @switch (issue.status) {
                    @case ('open') {
                      <span class="badge-warning gap-1 shrink-0">
                        <lucide-icon [img]="icons.Clock" [size]="12"></lucide-icon>
                        Open
                      </span>
                    }
                    @case ('investigating') {
                      <span class="badge-info gap-1 shrink-0">
                        <lucide-icon [img]="icons.Search" [size]="12"></lucide-icon>
                        Investigating
                      </span>
                    }
                    @case ('resolved') {
                      <span class="badge-success gap-1 shrink-0">
                        <lucide-icon [img]="icons.CheckCircle2" [size]="12"></lucide-icon>
                        Resolved
                      </span>
                    }
                    @case ('closed') {
                      <span class="badge-neutral gap-1 shrink-0">
                        <lucide-icon [img]="icons.XCircle" [size]="12"></lucide-icon>
                        Closed
                      </span>
                    }
                  }
                  <span class="badge-neutral shrink-0">
                    {{ issueTypeLabel(issue.issue_type) }}
                  </span>
                  <span class="ml-auto text-xs text-slate-400 whitespace-nowrap">{{ formatRelativeTime(issue.created_at) }}</span>
                  <lucide-icon [img]="expandedId() === issue.id ? icons.ChevronUp : icons.ChevronDown" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
                </div>
                <!-- Bottom row: course/module + description -->
                <div class="min-w-0">
                  <span class="text-sm font-semibold text-slate-900">{{ issue.course?.title ?? 'Unknown Course' }}</span>
                  @if (issue.module) {
                    <span class="text-xs text-slate-400"> / {{ issue.module.title }}</span>
                  }
                  <p class="text-sm text-slate-600 truncate mt-0.5">{{ issue.description }}</p>
                </div>
              </button>

              <!-- Expanded detail -->
              @if (expandedId() === issue.id) {
                <div class="px-4 pb-4 border-t border-slate-100">
                  <!-- Full description -->
                  <div class="mt-3">
                    <p class="section-label mb-1">Description</p>
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
                      <p class="section-label mb-2">Resolution</p>
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

  readonly icons = { Flag, Clock, CheckCircle2, XCircle, Search, ChevronDown, ChevronUp, BookOpen };
  readonly formatRelativeTime = formatRelativeTime;

  readonly expandedId = signal<string | null>(null);

  ngOnInit() {
    this.issueService.loadMyIssues();
  }

  toggleExpand(id: string) {
    this.expandedId.update(current => current === id ? null : id);
  }

  issueTypeLabel(type: IssueType): string {
    switch (type) {
      case 'content_error': return 'Content Error';
      case 'technical': return 'Technical';
      case 'accessibility': return 'Accessibility';
      case 'other': return 'Other';
    }
  }
}
