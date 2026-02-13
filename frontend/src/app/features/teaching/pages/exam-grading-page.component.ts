import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  LucideAngularModule, ClipboardCheck, Search, Loader2,
  Download, RotateCcw, Clock, Check, X, AlertTriangle, FileText,
} from 'lucide-angular';
import { ExamGradingService } from '../../../core/services/exam-grading.service';
import { GradingSubmission } from '../../../core/models/course.model';

@Component({
  selector: 'app-exam-grading-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.ClipboardCheck" [size]="24"></lucide-icon>
          Exam Grading
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by learner or exam..."
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
          @for (course of gradingService.courses(); track course.id) {
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
          <option value="graded">Graded</option>
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
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalSubmissions() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pending</div>
          <div class="text-2xl font-bold text-amber-600 tabular-nums">{{ pendingCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Graded</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ gradedCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Avg Score</div>
          <div class="text-2xl font-bold text-teal-600 tabular-nums">{{ avgScore() }}%</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (gradingService.loading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading submissions...</span>
        </div>
      } @else if (gradingService.error()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ gradingService.error() }}
        </div>
      } @else if (filteredSubmissions().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.FileText" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No submissions found.</p>
        </div>
      } @else {
        <!-- Submissions table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Learner</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Course</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Exam</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-20">Score</th>
                <th class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (sub of filteredSubmissions(); track sub.id) {
                <tr
                  class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  (click)="onExpandSubmission(sub)"
                >
                  <td class="px-3 py-3 text-slate-700 truncate max-w-[200px]">
                    {{ sub.learner_email }}
                    @if (sub.learner_name) {
                      <div class="text-xs text-slate-400">{{ sub.learner_name }}</div>
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ sub.course_title }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ sub.exam_title }}</td>
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatDate(sub.submitted_at) }}</td>
                  <td class="px-3 py-3">
                    @if (sub.score === null) {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                        <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                        Pending
                      </span>
                    } @else if (sub.score >= sub.passing_score) {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                        <lucide-icon [img]="icons.Check" [size]="12" class="mr-1"></lucide-icon>
                        Passed
                      </span>
                    } @else {
                      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700">
                        <lucide-icon [img]="icons.X" [size]="12" class="mr-1"></lucide-icon>
                        Failed
                      </span>
                    }
                  </td>
                  <td class="px-3 py-3 text-right font-semibold tabular-nums">
                    {{ sub.score !== null ? sub.score + '%' : '\u2014' }}
                  </td>
                  <td class="px-3 py-3 text-right">
                    <div class="flex items-center justify-end gap-1" (click)="$event.stopPropagation()">
                      <a
                        [href]="sub.file_url"
                        target="_blank"
                        rel="noopener"
                        class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-teal-600 transition-colors"
                        title="Download submission"
                      >
                        <lucide-icon [img]="icons.Download" [size]="16"></lucide-icon>
                      </a>
                      <button
                        type="button"
                        (click)="resetConfirmId.set(sub.id)"
                        class="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
                        title="Reset submission"
                      >
                        <lucide-icon [img]="icons.RotateCcw" [size]="16"></lucide-icon>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Expanded grading form -->
                @if (expandedSubmissionId() === sub.id) {
                  <tr>
                    <td colspan="7" class="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                      <div class="max-w-xl">
                        <div class="flex items-center gap-4 mb-3">
                          <div class="flex-1">
                            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Score (0–100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              [value]="gradeScore() ?? ''"
                              (input)="onScoreInput($any($event.target).value)"
                              class="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 tabular-nums"
                              placeholder="0–100"
                            />
                          </div>
                          @if (sub.passing_score) {
                            <div class="text-xs text-slate-500 mt-5">
                              Passing: {{ sub.passing_score }}%
                            </div>
                          }
                        </div>
                        <div class="mb-3">
                          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Feedback</label>
                          <textarea
                            rows="3"
                            [value]="gradeFeedback()"
                            (input)="gradeFeedback.set($any($event.target).value)"
                            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                            placeholder="Feedback for the learner..."
                          ></textarea>
                        </div>
                        <div class="flex items-center gap-3">
                          <button
                            type="button"
                            (click)="onGradeSubmission(sub.id)"
                            [disabled]="grading() || gradeScore() === null || gradeScore()! < 0 || gradeScore()! > 100"
                            class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
                          >
                            @if (grading()) {
                              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                            }
                            {{ sub.score !== null ? 'Update Grade' : 'Grade Exam' }}
                          </button>
                          <button
                            type="button"
                            (click)="expandedSubmissionId.set(null)"
                            class="text-sm text-slate-600 hover:text-slate-800"
                          >Cancel</button>
                        </div>
                        @if (gradeError()) {
                          <div class="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                            {{ gradeError() }}
                          </div>
                        }
                      </div>

                      <!-- Reset confirmation -->
                      @if (resetConfirmId() === sub.id) {
                        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                          <div class="flex items-start gap-2 mb-2">
                            <lucide-icon [img]="icons.AlertTriangle" [size]="16" class="text-amber-600 mt-0.5"></lucide-icon>
                            <p class="text-sm text-amber-800">This will delete the submission and allow the learner to resubmit.</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              (click)="onConfirmReset(sub.id)"
                              [disabled]="resetting()"
                              class="bg-rose-50 text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 font-semibold hover:bg-rose-100 disabled:opacity-50 text-sm inline-flex items-center gap-1"
                            >
                              @if (resetting()) {
                                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                              }
                              Yes, Reset
                            </button>
                            <button
                              type="button"
                              (click)="resetConfirmId.set(null)"
                              class="text-sm text-slate-600 hover:text-slate-800"
                            >Cancel</button>
                          </div>
                        </div>
                      }
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
export class ExamGradingPageComponent implements OnInit {
  readonly gradingService = inject(ExamGradingService);

  readonly icons = { ClipboardCheck, Search, Loader2, Download, RotateCcw, Clock, Check, X, AlertTriangle, FileText };

  // Filters
  readonly searchTerm = signal('');
  readonly selectedCourseId = signal<string | null>(null);
  readonly statusFilter = signal<'all' | 'pending' | 'graded'>('all');

  // Grading form state
  readonly expandedSubmissionId = signal<string | null>(null);
  readonly gradeScore = signal<number | null>(null);
  readonly gradeFeedback = signal('');
  readonly grading = signal(false);
  readonly gradeError = signal('');

  // Reset state
  readonly resetConfirmId = signal<string | null>(null);
  readonly resetting = signal(false);

  // Filtered submissions
  readonly filteredSubmissions = computed(() => {
    let subs = this.gradingService.submissions();
    const search = this.searchTerm().toLowerCase();
    const courseId = this.selectedCourseId();
    const status = this.statusFilter();

    if (search) {
      subs = subs.filter(s =>
        s.learner_email.toLowerCase().includes(search) ||
        (s.learner_name && s.learner_name.toLowerCase().includes(search)) ||
        s.exam_title.toLowerCase().includes(search),
      );
    }

    if (courseId) {
      subs = subs.filter(s => s.course_id === courseId);
    }

    if (status === 'pending') {
      subs = subs.filter(s => s.score === null);
    } else if (status === 'graded') {
      subs = subs.filter(s => s.score !== null);
    }

    return subs;
  });

  // Summary stats
  readonly totalSubmissions = computed(() => this.filteredSubmissions().length);

  readonly pendingCount = computed(() =>
    this.filteredSubmissions().filter(s => s.score === null).length,
  );

  readonly gradedCount = computed(() =>
    this.filteredSubmissions().filter(s => s.score !== null).length,
  );

  readonly avgScore = computed(() => {
    const graded = this.filteredSubmissions().filter(s => s.score !== null);
    if (graded.length === 0) return 0;
    const sum = graded.reduce((acc, s) => acc + s.score!, 0);
    return Math.round(sum / graded.length);
  });

  ngOnInit() {
    this.gradingService.loadGradingData();
  }

  onExpandSubmission(sub: GradingSubmission) {
    if (this.expandedSubmissionId() === sub.id) {
      this.expandedSubmissionId.set(null);
      return;
    }
    this.expandedSubmissionId.set(sub.id);
    this.gradeScore.set(sub.score);
    this.gradeFeedback.set(sub.feedback ?? '');
    this.gradeError.set('');
    this.resetConfirmId.set(null);
  }

  onScoreInput(value: string) {
    const num = value === '' ? null : Number(value);
    this.gradeScore.set(num);
  }

  async onGradeSubmission(submissionId: string) {
    const score = this.gradeScore();
    if (score === null || score < 0 || score > 100) return;

    this.grading.set(true);
    this.gradeError.set('');

    try {
      await this.gradingService.gradeSubmission(submissionId, {
        score,
        feedback: this.gradeFeedback(),
      });
      this.expandedSubmissionId.set(null);
      await this.gradingService.loadGradingData();
    } catch (err) {
      this.gradeError.set(err instanceof Error ? err.message : 'Failed to grade submission');
    } finally {
      this.grading.set(false);
    }
  }

  async onConfirmReset(submissionId: string) {
    this.resetting.set(true);

    try {
      await this.gradingService.resetSubmission(submissionId);
      this.expandedSubmissionId.set(null);
      this.resetConfirmId.set(null);
      await this.gradingService.loadGradingData();
    } catch (err) {
      this.gradeError.set(err instanceof Error ? err.message : 'Failed to reset submission');
    } finally {
      this.resetting.set(false);
    }
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCourseId.set(null);
    this.statusFilter.set('all');
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
