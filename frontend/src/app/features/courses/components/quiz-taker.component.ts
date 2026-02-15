import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, output, signal } from '@angular/core';
import { LucideAngularModule, Clock, Trophy, AlertTriangle, RotateCcw, CheckCircle2, XCircle, Play, Eye } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { QuizTakingData, QuizAttempt, QuizResults, QuizAnswerMap } from '../../../core/models/course.model';
import { QuizQuestionComponent } from './quiz-question.component';
import { QuizResultItemComponent } from './quiz-result-item.component';
import { formatDate } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-quiz-taker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, QuizQuestionComponent, QuizResultItemComponent],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <div class="animate-pulse space-y-4">
        <div class="h-6 bg-slate-200 rounded w-1/3"></div>
        <div class="h-4 bg-slate-200 rounded w-2/3"></div>
        <div class="h-48 bg-slate-200 rounded-lg"></div>
      </div>
    } @else if (error()) {
      <div class="alert-error rounded-lg">
        {{ error() }}
      </div>
    } @else if (quizData()) {
      @switch (phase()) {

        @case ('start') {
          <div class="space-y-6">
            <!-- Quiz info card -->
            <div class="card p-6">
              @if (quizData()!.description) {
                <p class="text-sm text-slate-600 mb-4">{{ quizData()!.description }}</p>
              }

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Questions</p>
                  <p class="text-lg font-bold text-slate-900">{{ quizData()!.questions.length }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Passing Score</p>
                  <p class="text-lg font-bold text-slate-900">{{ quizData()!.passing_score }}%</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Time Limit</p>
                  <p class="text-lg font-bold text-slate-900">{{ timeLimitDisplay() }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Attempts</p>
                  <p class="text-lg font-bold text-slate-900">{{ attemptsDisplay() }}</p>
                </div>
              </div>
            </div>

            <!-- Past attempts -->
            @if (pastAttempts().length > 0) {
              <div class="card overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <p class="section-label">Previous Attempts</p>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-slate-100">
                      <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500">#</th>
                      <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500">Score</th>
                      <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500">Result</th>
                      <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500">Date</th>
                      <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (attempt of pastAttempts(); track attempt.id) {
                      @if (attempt.submitted_at) {
                        <tr class="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td class="px-4 py-2.5 text-slate-700">{{ attempt.attempt_number }}</td>
                          <td class="px-4 py-2.5 font-semibold tabular-nums" [class.text-emerald-700]="attempt.passed" [class.text-rose-700]="!attempt.passed">
                            {{ attempt.score }}%
                          </td>
                          <td class="px-4 py-2.5">
                            @if (attempt.passed) {
                              <span class="badge-success">Passed</span>
                            } @else {
                              <span class="badge-error">Failed</span>
                            }
                          </td>
                          <td class="px-4 py-2.5 text-slate-500 text-xs">{{ formatDate(attempt.submitted_at!) }}</td>
                          <td class="px-4 py-2.5 text-right">
                            <button (click)="onViewResults(attempt.id)"
                                    class="text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors">
                              <span class="inline-flex items-center gap-1">
                                <lucide-icon [img]="icons.Eye" [size]="12"></lucide-icon>
                                View
                              </span>
                            </button>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            }

            <!-- Start button -->
            <div class="flex justify-center">
              @if (hasUnsubmittedAttempt()) {
                <button (click)="onStartQuiz()"
                        class="bg-amber-500 text-white rounded-lg px-6 py-3 text-sm font-semibold shadow-sm hover:bg-amber-600 active:scale-95 transition-all duration-200 inline-flex items-center gap-2">
                  <lucide-icon [img]="icons.Play" [size]="18"></lucide-icon>
                  Continue Quiz
                </button>
              } @else if (canStartNewAttempt()) {
                <button (click)="onStartQuiz()"
                        class="btn-primary px-6 py-3">
                  <lucide-icon [img]="icons.Play" [size]="18"></lucide-icon>
                  Start Quiz
                </button>
              } @else {
                <div class="text-center">
                  <p class="text-sm text-slate-500">Maximum attempts reached</p>
                </div>
              }
            </div>
          </div>
        }

        @case ('active') {
          <div class="space-y-4">
            <!-- Timer bar -->
            @if (quizData()!.time_limit) {
              <div class="sticky top-0 z-10 rounded-lg border px-4 py-2.5 flex items-center justify-between"
                   [class.bg-teal-50]="timerColor() === 'teal'" [class.border-teal-200]="timerColor() === 'teal'"
                   [class.bg-amber-50]="timerColor() === 'amber'" [class.border-amber-200]="timerColor() === 'amber'"
                   [class.bg-rose-50]="timerColor() === 'rose'" [class.border-rose-200]="timerColor() === 'rose'">
                <div class="flex items-center gap-2">
                  <lucide-icon [img]="icons.Clock" [size]="16"
                    [class.text-teal-600]="timerColor() === 'teal'"
                    [class.text-amber-600]="timerColor() === 'amber'"
                    [class.text-rose-600]="timerColor() === 'rose'"></lucide-icon>
                  <span class="text-sm font-bold tabular-nums"
                    [class.text-teal-700]="timerColor() === 'teal'"
                    [class.text-amber-700]="timerColor() === 'amber'"
                    [class.text-rose-700]="timerColor() === 'rose'">
                    {{ timerDisplay() }}
                  </span>
                </div>
                <span class="text-xs" [class.text-teal-600]="timerColor() === 'teal'"
                      [class.text-amber-600]="timerColor() === 'amber'"
                      [class.text-rose-600]="timerColor() === 'rose'">Time remaining</span>
              </div>
            }

            <!-- Questions -->
            @for (q of quizData()!.questions; track q.id; let i = $index) {
              <app-quiz-question
                [question]="q"
                [questionNumber]="i + 1"
                [answer]="getAnswer(q.id)"
                [disabled]="submitting()"
                (answerChange)="onAnswerChange(q.id, $event)" />
            }

            <!-- Submit -->
            <div class="flex items-center justify-between border-t border-slate-200 pt-4 mt-2">
              <p class="text-xs text-slate-400">{{ answeredCount() }} of {{ quizData()!.questions.length }} answered</p>
              @if (confirmingSubmit()) {
                <div class="flex items-center gap-3">
                  <span class="text-sm text-slate-600">Submit quiz?</span>
                  <button (click)="onConfirmSubmit()"
                          [disabled]="submitting()"
                          class="btn-primary">
                    {{ submitting() ? 'Submitting...' : 'Yes, Submit' }}
                  </button>
                  <button (click)="confirmingSubmit.set(false)"
                          [disabled]="submitting()"
                          class="btn-secondary">
                    Cancel
                  </button>
                </div>
              } @else {
                <button (click)="confirmingSubmit.set(true)"
                        [disabled]="submitting()"
                        class="btn-primary px-5">
                  Submit Quiz
                </button>
              }
            </div>
          </div>
        }

        @case ('results') {
          @if (results()) {
            <div class="space-y-6">
              <!-- Grade card -->
              <div class="rounded-xl border-2 p-6 text-center"
                   [class.border-emerald-300]="results()!.grade.passed"
                   [class.bg-emerald-50]="results()!.grade.passed"
                   [class.border-rose-300]="!results()!.grade.passed"
                   [class.bg-rose-50]="!results()!.grade.passed">
                <div class="mb-3">
                  @if (results()!.grade.passed) {
                    <lucide-icon [img]="icons.CheckCircle2" [size]="48" class="text-emerald-600 mx-auto"></lucide-icon>
                  } @else {
                    <lucide-icon [img]="icons.XCircle" [size]="48" class="text-rose-600 mx-auto"></lucide-icon>
                  }
                </div>
                <p class="text-3xl font-bold tabular-nums mb-1"
                   [class.text-emerald-700]="results()!.grade.passed"
                   [class.text-rose-700]="!results()!.grade.passed">
                  {{ results()!.grade.score }}%
                </p>
                <p class="text-sm font-semibold mb-2"
                   [class.text-emerald-600]="results()!.grade.passed"
                   [class.text-rose-600]="!results()!.grade.passed">
                  {{ results()!.grade.passed ? 'Passed' : 'Failed' }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ results()!.grade.earned_points }} / {{ results()!.grade.total_points }} points
                </p>
              </div>

              <!-- Question results -->
              @if (results()!.questions.length > 0) {
                <div>
                  <p class="section-label mb-3">Question Results</p>
                  <div class="space-y-3">
                    @for (qr of results()!.questions; track qr.question_id; let i = $index) {
                      <app-quiz-result-item [result]="qr" [questionNumber]="i + 1" />
                    }
                  </div>
                </div>
              }

              <!-- Actions -->
              <div class="flex items-center justify-center gap-4 border-t border-slate-200 pt-4">
                @if (canRetake()) {
                  <button (click)="onRetake()"
                          class="btn-primary px-5">
                    <lucide-icon [img]="icons.RotateCcw" [size]="16"></lucide-icon>
                    Retake Quiz
                  </button>
                }
              </div>
            </div>
          }
        }
      }
    }
  `,
})
export class QuizTakerComponent implements OnDestroy {
  readonly #courseService = inject(CourseService);
  readonly moduleId = input.required<string>();
  readonly quizCompleted = output<void>();

  readonly icons = { Clock, Trophy, AlertTriangle, RotateCcw, CheckCircle2, XCircle, Play, Eye };

  readonly phase = signal<'start' | 'active' | 'results'>('start');
  readonly quizData = signal<QuizTakingData | null>(null);
  readonly pastAttempts = signal<QuizAttempt[]>([]);
  readonly currentAttempt = signal<QuizAttempt | null>(null);
  readonly answers = signal<QuizAnswerMap>({});
  readonly results = signal<QuizResults | null>(null);
  readonly timeRemaining = signal(0);
  readonly submitting = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly confirmingSubmit = signal(false);

  #timerRef: ReturnType<typeof setInterval> | null = null;

  readonly timeLimitDisplay = computed(() => {
    const tl = this.quizData()?.time_limit;
    if (!tl) return 'None';
    const m = Math.floor(tl / 60);
    return m === 1 ? '1 minute' : `${m} minutes`;
  });

  readonly attemptsDisplay = computed(() => {
    const max = this.quizData()?.max_attempts;
    const used = this.pastAttempts().length;
    if (!max) return `${used} / Unlimited`;
    return `${used} / ${max}`;
  });

  readonly hasUnsubmittedAttempt = computed(() => {
    return this.pastAttempts().some(a => !a.submitted_at);
  });

  readonly canStartNewAttempt = computed(() => {
    const max = this.quizData()?.max_attempts;
    if (!max) return true;
    return this.pastAttempts().length < max;
  });

  readonly canRetake = computed(() => {
    const max = this.quizData()?.max_attempts;
    const used = this.pastAttempts().length;
    if (!max) return true;
    return used < max;
  });

  readonly timerDisplay = computed(() => {
    const s = this.timeRemaining();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  readonly timerColor = computed(() => {
    const tl = this.quizData()?.time_limit;
    if (!tl) return 'teal';
    const ratio = this.timeRemaining() / tl;
    if (ratio > 0.5) return 'teal';
    if (ratio > 0.1) return 'amber';
    return 'rose';
  });

  readonly answeredCount = computed(() => {
    return Object.values(this.answers()).filter(a => a !== '').length;
  });

  constructor() {
    effect(() => {
      const mid = this.moduleId();
      if (mid) {
        this.#loadQuiz(mid);
      }
    });
  }

  ngOnDestroy() {
    this.#clearTimer();
  }

  getAnswer(questionId: string): string {
    return this.answers()[questionId] ?? '';
  }

  onAnswerChange(questionId: string, value: string) {
    this.answers.update(prev => ({ ...prev, [questionId]: value }));
  }

  async onStartQuiz() {
    const quiz = this.quizData();
    if (!quiz) return;

    try {
      this.error.set('');
      const attempt = await this.#courseService.startQuizAttempt(quiz.id);
      this.currentAttempt.set(attempt);
      this.answers.set({});
      this.confirmingSubmit.set(false);
      this.phase.set('active');

      if (quiz.time_limit) {
        this.#startTimer(quiz.time_limit, attempt.started_at);
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to start quiz');
    }
  }

  async onConfirmSubmit() {
    await this.#onSubmit();
  }

  async onViewResults(attemptId: string) {
    try {
      this.loading.set(true);
      this.error.set('');
      const results = await this.#courseService.getQuizAttemptResults(attemptId);
      this.results.set(results);
      this.phase.set('results');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load results');
    } finally {
      this.loading.set(false);
    }
  }

  async onRetake() {
    // Reload quiz data to refresh past attempts and re-randomize
    await this.#loadQuiz(this.moduleId());
    this.results.set(null);
    this.phase.set('start');
  }

  readonly formatDate = formatDate;

  async #loadQuiz(moduleId: string) {
    try {
      this.loading.set(true);
      this.error.set('');
      const data = await this.#courseService.loadQuizForTaking(moduleId);
      if (!data) {
        this.error.set('Quiz not found');
        return;
      }
      this.quizData.set(data.quiz);
      this.pastAttempts.set(data.pastAttempts);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load quiz');
    } finally {
      this.loading.set(false);
    }
  }

  async #onSubmit() {
    const attempt = this.currentAttempt();
    if (!attempt || this.submitting()) return;

    try {
      this.submitting.set(true);
      this.error.set('');
      this.#clearTimer();

      const results = await this.#courseService.submitQuizAttempt(attempt.id, this.answers());
      this.results.set(results);
      this.phase.set('results');

      // Refresh past attempts with the new one
      this.pastAttempts.update(prev => [results.attempt, ...prev.filter(a => a.id !== attempt.id)]);

      if (results.grade.passed) {
        this.quizCompleted.emit();
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to submit quiz');
    } finally {
      this.submitting.set(false);
      this.confirmingSubmit.set(false);
    }
  }

  #startTimer(timeLimitSeconds: number, startedAt: string) {
    this.#clearTimer();
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const remaining = Math.max(0, timeLimitSeconds - elapsed);
    this.timeRemaining.set(remaining);

    if (remaining <= 0) {
      this.#onSubmit();
      return;
    }

    this.#timerRef = setInterval(() => {
      const r = this.timeRemaining() - 1;
      this.timeRemaining.set(r);
      if (r <= 0) {
        this.#clearTimer();
        this.#onSubmit();
      }
    }, 1000);
  }

  #clearTimer() {
    if (this.#timerRef) {
      clearInterval(this.#timerRef);
      this.#timerRef = null;
    }
  }
}
