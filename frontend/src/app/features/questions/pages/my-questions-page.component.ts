import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, HelpCircle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, BookOpen } from 'lucide-angular';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { ExpertQuestionStatus } from '../../../core/models/expert-question.model';
import { LucideIconData } from 'lucide-angular';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-my-questions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, ErrorAlertComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
          <lucide-icon [img]="icons.HelpCircle" [size]="20"></lucide-icon>
        </div>
        <div>
          <h1 class="page-title">My Questions</h1>
          <p class="text-sm text-slate-500">Questions you've asked to course experts</p>
        </div>
        @if (expertQuestionService.questions().length > 0) {
          <span class="ml-auto badge-neutral">
            {{ expertQuestionService.questions().length }}
          </span>
        }
      </div>

      @if (expertQuestionService.loading()) {
        <!-- Loading skeleton -->
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="animate-pulse bg-white border border-slate-200 rounded-xl p-4">
              <div class="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          }
        </div>
      } @else if (expertQuestionService.error()) {
        <app-error-alert [message]="expertQuestionService.error()!" />
      } @else if (expertQuestionService.questions().length === 0) {
        <!-- Empty state -->
        <div class="text-center py-16">
          <lucide-icon [img]="icons.HelpCircle" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm font-semibold text-slate-600">No questions yet</p>
          <p class="text-xs text-slate-400 mt-1">You can ask an expert from any module page.</p>
        </div>
      } @else {
        <!-- Question list -->
        <div class="space-y-3">
          @for (question of expertQuestionService.questions(); track question.id) {
            <div class="card overflow-hidden">
              <!-- Collapsed row -->
              <button
                type="button"
                (click)="toggleExpand(question.id)"
                class="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <!-- Status badge -->
                <span [class]="statusBadgeClass(question.status)">
                  <lucide-icon [img]="statusIcon(question.status)" [size]="12"></lucide-icon>
                  {{ statusLabel(question.status) }}
                </span>

                <!-- Course + Module -->
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-semibold text-slate-900">{{ question.course?.title ?? 'Unknown Course' }}</span>
                  @if (question.module) {
                    <span class="text-xs text-slate-400"> / {{ question.module.title }}</span>
                  }
                  <p class="text-sm text-slate-600 truncate mt-0.5">{{ question.question_text }}</p>
                </div>

                <!-- Timestamp + chevron -->
                <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">{{ formatRelativeTime(question.created_at) }}</span>
                <lucide-icon [img]="expandedId() === question.id ? icons.ChevronUp : icons.ChevronDown" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
              </button>

              <!-- Expanded detail -->
              @if (expandedId() === question.id) {
                <div class="px-4 pb-4 border-t border-slate-100">
                  <!-- Full question -->
                  <div class="mt-3">
                    <p class="section-label mb-1">Your Question</p>
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ question.question_text }}</p>
                  </div>

                  <!-- Link to module -->
                  @if (question.module_id) {
                    <a
                      [routerLink]="['/courses', question.course_id, 'modules', question.module_id]"
                      class="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-semibold mt-2 transition-colors"
                    >
                      <lucide-icon [img]="icons.BookOpen" [size]="12"></lucide-icon>
                      Go to module
                    </a>
                  }

                  <!-- Expert response (shown for answered OR closed-with-response) -->
                  @if (question.response_text) {
                    <div class="mt-4">
                      <p class="section-label mb-2">Expert Response</p>
                      <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
                        <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ question.response_text }}</p>
                        <div class="mt-2 text-xs text-slate-500">
                          @if (question.responder) {
                            <span class="font-semibold">{{ question.responder.full_name ?? question.responder.email }}</span>
                          }
                          @if (question.responded_at) {
                            <span> &middot; {{ formatRelativeTime(question.responded_at) }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  }

                  <!-- Closed without response -->
                  @if (question.status === 'closed' && !question.response_text) {
                    <p class="mt-4 text-sm text-slate-500">This question has been closed.</p>
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
export class MyQuestionsPageComponent implements OnInit {
  readonly expertQuestionService = inject(ExpertQuestionService);

  readonly icons = { HelpCircle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, BookOpen };
  readonly formatRelativeTime = formatRelativeTime;

  readonly expandedId = signal<string | null>(null);

  ngOnInit() {
    this.expertQuestionService.loadMyQuestions();
  }

  toggleExpand(id: string) {
    this.expandedId.update(current => current === id ? null : id);
  }

  statusBadgeClass(status: ExpertQuestionStatus): string {
    const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0';
    switch (status) {
      case 'pending': return `${base} bg-amber-100 text-amber-700`;
      case 'answered': return `${base} bg-emerald-100 text-emerald-700`;
      case 'closed': return `${base} bg-slate-100 text-slate-600`;
    }
  }

  statusLabel(status: ExpertQuestionStatus): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'answered': return 'Answered';
      case 'closed': return 'Closed';
    }
  }

  statusIcon(status: ExpertQuestionStatus): LucideIconData {
    switch (status) {
      case 'pending': return this.icons.Clock;
      case 'answered': return this.icons.CheckCircle2;
      case 'closed': return this.icons.XCircle;
    }
  }
}
