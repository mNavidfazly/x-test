import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule, MessageSquare, Search, Loader2,
  Clock, Check, CheckCircle2, XCircle, Send, HelpCircle,
} from 'lucide-angular';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { ToastService } from '../../../core/services/toast.service';
import { ExpertQuestionForBoard, ExpertQuestionStatus } from '../../../core/models/expert-question.model';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar.component';

@Component({
  selector: 'app-questions-board-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, UserAvatarComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.MessageSquare" [size]="24"></lucide-icon>
          Questions Board
          @if (pendingCount() > 0) {
            <app-status-badge variant="warning">{{ pendingCount() }} pending</app-status-badge>
          }
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by learner or question..."
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
          [options]="statusOptions"
          [value]="statusFilter()"
          (valueChange)="statusFilter.set($any($event))"
          ariaLabel="Status filter"
        />
        @if (searchTerm() || selectedCourseId() || statusFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total" [value]="totalQuestions()" />
        <app-stat-card label="Pending" [value]="pendingCount()" color="text-amber-600" />
        <app-stat-card label="Answered" [value]="answeredCount()" color="text-emerald-600" />
        <app-stat-card label="Closed" [value]="closedCount()" color="text-slate-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (questionService.boardLoading()) {
        <app-loading-spinner message="Loading questions..." />
      } @else if (questionService.boardError()) {
        <div class="mb-4"><app-error-alert [message]="questionService.boardError()!" /></div>
      } @else if (filteredQuestions().length === 0) {
        <app-empty-state [icon]="icons.HelpCircle" message="No questions found." />
      } @else {
        <!-- Questions table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th">Learner</th>
                <th class="th">Course</th>
                <th class="th">Module</th>
                <th class="th">Question</th>
                <th class="th">Asked</th>
                <th class="th">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (q of filteredQuestions(); track q.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandQuestion(q)"
                >
                  <td class="table-cell">
                    <div class="flex items-center gap-2 max-w-[200px]">
                      <app-user-avatar
                        [avatarUrl]="q.asker?.avatar_url ?? null"
                        [name]="q.asker?.full_name ?? q.asker?.email ?? '?'"
                        size="sm"
                        class="shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="text-sm text-slate-700 truncate">{{ q.asker?.email ?? '[Unknown]' }}</div>
                        @if (q.asker?.full_name) {
                          <div class="text-xs text-slate-400 truncate">{{ q.asker!.full_name }}</div>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="table-cell truncate max-w-[150px]">{{ q.course?.title ?? '\u2014' }}</td>
                  <td class="table-cell truncate max-w-[120px]">{{ q.module?.title ?? '\u2014' }}</td>
                  <td class="table-cell truncate max-w-[200px]">{{ truncateText(q.question_text, 60) }}</td>
                  <td class="table-cell text-slate-500 text-xs">{{ formatRelativeTime(q.created_at) }}</td>
                  <td class="table-cell">
                    @switch (q.status) {
                      @case ('pending') {
                        <app-status-badge variant="warning">
                          <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                          Pending
                        </app-status-badge>
                      }
                      @case ('answered') {
                        <app-status-badge variant="success">
                          <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                          Answered
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
                @if (expandedQuestionId() === q.id) {
                  <tr>
                    <td colspan="6" class="expand-panel px-6 py-4">
                      <div class="max-w-2xl">
                        <!-- Full question text -->
                        <div class="mb-4">
                          <div class="section-label mb-1">Question</div>
                          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ q.question_text }}</p>
                        </div>

                        @switch (q.status) {
                          @case ('pending') {
                            <!-- Response form for pending questions -->
                            <div class="mb-3">
                              <label class="section-label block mb-1">Your Response</label>
                              <textarea
                                rows="3"
                                [value]="responseText()"
                                (input)="responseText.set($any($event.target).value)"
                                class="input-field"
                                placeholder="Type your response..."
                              ></textarea>
                            </div>
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                (click)="onRespondToQuestion(q.id)"
                                [disabled]="responding() || !responseText().trim()"
                                class="btn-primary"
                              >
                                @if (responding()) {
                                  <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
                                } @else {
                                  <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
                                }
                                Submit Response
                              </button>
                              <button
                                type="button"
                                (click)="expandedQuestionId.set(null)"
                                class="btn-ghost"
                              >Cancel</button>
                            </div>
                          }
                          @case ('answered') {
                            <!-- Editable response for answered questions -->
                            <div class="mb-3">
                              <label class="section-label block mb-1">Response</label>
                              <textarea
                                rows="3"
                                [value]="responseText()"
                                (input)="responseText.set($any($event.target).value)"
                                class="input-field"
                                placeholder="Update your response..."
                              ></textarea>
                            </div>
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                (click)="onRespondToQuestion(q.id)"
                                [disabled]="responding() || !responseText().trim()"
                                class="btn-primary"
                              >
                                @if (responding()) {
                                  <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="14"></lucide-icon></span>
                                } @else {
                                  <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
                                }
                                Update Response
                              </button>
                              <button
                                type="button"
                                (click)="onCloseQuestion(q.id)"
                                [disabled]="responding()"
                                class="btn-danger"
                              >Close Question</button>
                              <button
                                type="button"
                                (click)="expandedQuestionId.set(null)"
                                class="btn-ghost"
                              >Cancel</button>
                            </div>
                          }
                          @case ('closed') {
                            <!-- Read-only response for closed questions -->
                            @if (q.response_text) {
                              <div class="mb-3">
                                <div class="section-label mb-1">Response</div>
                                <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ q.response_text }}</p>
                              </div>
                            }
                            <div class="flex items-center gap-2 text-xs text-slate-400">
                              <lucide-icon [img]="icons.XCircle" [size]="14"></lucide-icon>
                              This question is closed
                            </div>
                          }
                        }

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
export class QuestionsBoardPageComponent implements OnInit {
  readonly questionService = inject(ExpertQuestionService);
  #toast = inject(ToastService);
  #route = inject(ActivatedRoute);

  readonly icons = { MessageSquare, Search, Loader2, Clock, Check, CheckCircle2, XCircle, Send, HelpCircle };
  readonly formatRelativeTime = formatRelativeTime;

  readonly statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'answered', label: 'Answered' },
    { value: 'closed', label: 'Closed' },
  ];

  readonly courseOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Courses' },
    ...this.questionService.boardCourses().map(c => ({ value: c.id, label: c.title })),
  ]);

  // Filters
  readonly searchTerm = signal('');
  readonly selectedCourseId = signal<string | null>(null);
  readonly statusFilter = signal<'all' | ExpertQuestionStatus>('all');

  // Expanded row state
  readonly expandedQuestionId = signal<string | null>(null);
  readonly responseText = signal('');
  readonly responding = signal(false);

  // Filtered questions
  readonly filteredQuestions = computed(() => {
    let questions = this.questionService.boardQuestions();
    const search = this.searchTerm().toLowerCase();
    const courseId = this.selectedCourseId();
    const status = this.statusFilter();

    if (search) {
      questions = questions.filter(q =>
        (q.asker?.email ?? '').toLowerCase().includes(search) ||
        (q.asker?.full_name ?? '').toLowerCase().includes(search) ||
        q.question_text.toLowerCase().includes(search),
      );
    }

    if (courseId) {
      questions = questions.filter(q => q.course_id === courseId);
    }

    if (status !== 'all') {
      questions = questions.filter(q => q.status === status);
    }

    return questions;
  });

  // Summary stats
  readonly totalQuestions = computed(() => this.filteredQuestions().length);

  readonly pendingCount = computed(() =>
    this.filteredQuestions().filter(q => q.status === 'pending').length,
  );

  readonly answeredCount = computed(() =>
    this.filteredQuestions().filter(q => q.status === 'answered').length,
  );

  readonly closedCount = computed(() =>
    this.filteredQuestions().filter(q => q.status === 'closed').length,
  );

  ngOnInit() {
    const courseId = this.#route.snapshot.queryParamMap.get('courseId');
    if (courseId) {
      this.selectedCourseId.set(courseId);
    }
    this.questionService.loadBoardQuestions();
  }

  onExpandQuestion(q: ExpertQuestionForBoard) {
    if (this.expandedQuestionId() === q.id) {
      this.expandedQuestionId.set(null);
      return;
    }
    this.expandedQuestionId.set(q.id);
    this.responseText.set(q.response_text ?? '');
  }

  async onRespondToQuestion(questionId: string) {
    const text = this.responseText().trim();
    if (!text) return;

    this.responding.set(true);

    try {
      await this.questionService.respondToQuestion(questionId, text);
      this.#toast.success('Response submitted');
      this.expandedQuestionId.set(null);
      await this.questionService.loadBoardQuestions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit response';
      this.#toast.error(msg);
    } finally {
      this.responding.set(false);
    }
  }

  async onCloseQuestion(questionId: string) {
    this.responding.set(true);

    try {
      await this.questionService.closeQuestion(questionId);
      this.#toast.success('Question closed');
      this.expandedQuestionId.set(null);
      await this.questionService.loadBoardQuestions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to close question';
      this.#toast.error(msg);
    } finally {
      this.responding.set(false);
    }
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCourseId.set(null);
    this.statusFilter.set('all');
  }

  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
