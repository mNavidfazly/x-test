import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  LucideAngularModule, MessageSquare, Search, Loader2,
  Clock, Check, CheckCircle2, XCircle, Send, HelpCircle,
} from 'lucide-angular';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { ExpertQuestionForBoard, ExpertQuestionStatus } from '../../../core/models/expert-question.model';

@Component({
  selector: 'app-questions-board-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.MessageSquare" [size]="24"></lucide-icon>
          Questions Board
          @if (pendingCount() > 0) {
            <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
              {{ pendingCount() }} pending
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
            placeholder="Search by learner or question..."
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
          @for (course of questionService.boardCourses(); track course.id) {
            <option [value]="course.id">{{ course.title }}</option>
          }
        </select>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="statusFilter()"
          (change)="statusFilter.set($any($event.target).value)"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="answered">Answered</option>
          <option value="closed">Closed</option>
        </select>
        @if (searchTerm() || selectedCourseId() || statusFilter() !== 'all') {
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
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total</div>
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalQuestions() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pending</div>
          <div class="text-2xl font-bold text-amber-600 tabular-nums">{{ pendingCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Answered</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ answeredCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Closed</div>
          <div class="text-2xl font-bold text-slate-600 tabular-nums">{{ closedCount() }}</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (questionService.boardLoading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading questions...</span>
        </div>
      } @else if (questionService.boardError()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ questionService.boardError() }}
        </div>
      } @else if (filteredQuestions().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.HelpCircle" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No questions found.</p>
        </div>
      } @else {
        <!-- Questions table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Learner</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Course</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Module</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Question</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Asked</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (q of filteredQuestions(); track q.id) {
                <tr
                  class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  (click)="onExpandQuestion(q)"
                >
                  <td class="px-3 py-3 text-slate-700 truncate max-w-[200px]">
                    {{ q.asker?.email ?? '[Unknown]' }}
                    @if (q.asker?.full_name) {
                      <div class="text-xs text-slate-400">{{ q.asker!.full_name }}</div>
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ q.course?.title ?? '\u2014' }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[120px]">{{ q.module?.title ?? '\u2014' }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[200px]">{{ truncateText(q.question_text, 60) }}</td>
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatRelativeTime(q.created_at) }}</td>
                  <td class="px-3 py-3">
                    @switch (q.status) {
                      @case ('pending') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                          <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                          Pending
                        </span>
                      }
                      @case ('answered') {
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                          <lucide-icon [img]="icons.CheckCircle2" [size]="12" class="mr-1"></lucide-icon>
                          Answered
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
                @if (expandedQuestionId() === q.id) {
                  <tr>
                    <td colspan="6" class="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                      <div class="max-w-2xl">
                        <!-- Full question text -->
                        <div class="mb-4">
                          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Question</div>
                          <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ q.question_text }}</p>
                        </div>

                        @switch (q.status) {
                          @case ('pending') {
                            <!-- Response form for pending questions -->
                            <div class="mb-3">
                              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Your Response</label>
                              <textarea
                                rows="3"
                                [value]="responseText()"
                                (input)="responseText.set($any($event.target).value)"
                                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                                placeholder="Type your response..."
                              ></textarea>
                            </div>
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                (click)="onRespondToQuestion(q.id)"
                                [disabled]="responding() || !responseText().trim()"
                                class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
                              >
                                @if (responding()) {
                                  <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                                } @else {
                                  <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
                                }
                                Submit Response
                              </button>
                              <button
                                type="button"
                                (click)="expandedQuestionId.set(null)"
                                class="text-sm text-slate-600 hover:text-slate-800"
                              >Cancel</button>
                            </div>
                          }
                          @case ('answered') {
                            <!-- Editable response for answered questions -->
                            <div class="mb-3">
                              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Response</label>
                              <textarea
                                rows="3"
                                [value]="responseText()"
                                (input)="responseText.set($any($event.target).value)"
                                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                                placeholder="Update your response..."
                              ></textarea>
                            </div>
                            <div class="flex items-center gap-3">
                              <button
                                type="button"
                                (click)="onRespondToQuestion(q.id)"
                                [disabled]="responding() || !responseText().trim()"
                                class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
                              >
                                @if (responding()) {
                                  <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                                } @else {
                                  <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
                                }
                                Update Response
                              </button>
                              <button
                                type="button"
                                (click)="onCloseQuestion(q.id)"
                                [disabled]="responding()"
                                class="bg-rose-50 text-rose-600 border border-rose-200 rounded-lg px-4 py-2 font-semibold hover:bg-rose-100 disabled:opacity-50 text-sm"
                              >Close Question</button>
                              <button
                                type="button"
                                (click)="expandedQuestionId.set(null)"
                                class="text-sm text-slate-600 hover:text-slate-800"
                              >Cancel</button>
                            </div>
                          }
                          @case ('closed') {
                            <!-- Read-only response for closed questions -->
                            @if (q.response_text) {
                              <div class="mb-3">
                                <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Response</div>
                                <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ q.response_text }}</p>
                              </div>
                            }
                            <div class="flex items-center gap-2 text-xs text-slate-400">
                              <lucide-icon [img]="icons.XCircle" [size]="14"></lucide-icon>
                              This question is closed
                            </div>
                          }
                        }

                        @if (responseError()) {
                          <div class="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                            {{ responseError() }}
                          </div>
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

  readonly icons = { MessageSquare, Search, Loader2, Clock, Check, CheckCircle2, XCircle, Send, HelpCircle };

  // Filters
  readonly searchTerm = signal('');
  readonly selectedCourseId = signal<string | null>(null);
  readonly statusFilter = signal<'all' | ExpertQuestionStatus>('all');

  // Expanded row state
  readonly expandedQuestionId = signal<string | null>(null);
  readonly responseText = signal('');
  readonly responding = signal(false);
  readonly responseError = signal('');

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
    this.questionService.loadBoardQuestions();
  }

  onExpandQuestion(q: ExpertQuestionForBoard) {
    if (this.expandedQuestionId() === q.id) {
      this.expandedQuestionId.set(null);
      return;
    }
    this.expandedQuestionId.set(q.id);
    this.responseText.set(q.response_text ?? '');
    this.responseError.set('');
  }

  async onRespondToQuestion(questionId: string) {
    const text = this.responseText().trim();
    if (!text) return;

    this.responding.set(true);
    this.responseError.set('');

    try {
      await this.questionService.respondToQuestion(questionId, text);
      this.expandedQuestionId.set(null);
      await this.questionService.loadBoardQuestions();
    } catch (err) {
      this.responseError.set(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      this.responding.set(false);
    }
  }

  async onCloseQuestion(questionId: string) {
    this.responding.set(true);
    this.responseError.set('');

    try {
      await this.questionService.closeQuestion(questionId);
      this.expandedQuestionId.set(null);
      await this.questionService.loadBoardQuestions();
    } catch (err) {
      this.responseError.set(err instanceof Error ? err.message : 'Failed to close question');
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

  formatRelativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
