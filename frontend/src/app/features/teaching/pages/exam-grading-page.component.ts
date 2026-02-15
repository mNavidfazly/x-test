import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule, ClipboardCheck, Search, Loader2,
  Download, RotateCcw, Clock, Check, X, AlertTriangle, FileText,
} from 'lucide-angular';
import { ExamGradingService } from '../../../core/services/exam-grading.service';
import { ToastService } from '../../../core/services/toast.service';
import { GradingSubmission } from '../../../core/models/course.model';
import { formatDate } from '../../../core/utils/date.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar.component';

@Component({
  selector: 'app-exam-grading-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, UserAvatarComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
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
            class="search-input"
          />
        </div>
        <select
          class="select-field"
          (change)="selectedCourseId.set($any($event.target).value || null)"
        >
          <option value="" [selected]="!selectedCourseId()">All Courses</option>
          @for (course of gradingService.courses(); track course.id) {
            <option [value]="course.id" [selected]="course.id === selectedCourseId()">{{ course.title }}</option>
          }
        </select>
        <select
          class="select-field"
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
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total" [value]="totalSubmissions()" />
        <app-stat-card label="Pending" [value]="pendingCount()" color="text-amber-600" />
        <app-stat-card label="Graded" [value]="gradedCount()" color="text-emerald-600" />
        <app-stat-card label="Avg Score" [value]="avgScore() + '%'" color="text-teal-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (gradingService.loading()) {
        <app-loading-spinner message="Loading submissions..." />
      } @else if (gradingService.error()) {
        <app-error-alert [message]="gradingService.error()!" />
      } @else if (filteredSubmissions().length === 0) {
        <app-empty-state [icon]="icons.FileText" message="No submissions found." />
      } @else {
        <!-- Submissions table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th">Learner</th>
                <th class="th">Course</th>
                <th class="th">Exam</th>
                <th class="th">Submitted</th>
                <th class="th">Status</th>
                <th class="th text-right w-20">Score</th>
                <th class="th text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (sub of filteredSubmissions(); track sub.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandSubmission(sub)"
                >
                  <td class="px-3 py-3">
                    <div class="flex items-center gap-2 max-w-[200px]">
                      <app-user-avatar
                        [avatarUrl]="sub.learner_avatar_url"
                        [name]="sub.learner_name ?? sub.learner_email"
                        size="sm"
                        class="shrink-0"
                      />
                      <div class="min-w-0">
                        <div class="text-sm text-slate-700 truncate">{{ sub.learner_email }}</div>
                        @if (sub.learner_name) {
                          <div class="text-xs text-slate-400 truncate">{{ sub.learner_name }}</div>
                        }
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ sub.course_title }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ sub.exam_title }}</td>
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatDate(sub.submitted_at) }}</td>
                  <td class="px-3 py-3">
                    @if (sub.score === null) {
                      <app-status-badge variant="warning">
                        <lucide-icon [img]="icons.Clock" [size]="12" class="mr-1"></lucide-icon>
                        Pending
                      </app-status-badge>
                    } @else if (sub.score >= sub.passing_score) {
                      <app-status-badge variant="success">
                        <lucide-icon [img]="icons.Check" [size]="12" class="mr-1"></lucide-icon>
                        Passed
                      </app-status-badge>
                    } @else {
                      <app-status-badge variant="error">
                        <lucide-icon [img]="icons.X" [size]="12" class="mr-1"></lucide-icon>
                        Failed
                      </app-status-badge>
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
                            <label class="section-label block mb-1">Score (0–100)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              [value]="gradeScore() ?? ''"
                              (input)="onScoreInput($any($event.target).value)"
                              class="input-field w-24 tabular-nums"
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
                          <label class="section-label block mb-1">Feedback</label>
                          <textarea
                            rows="3"
                            [value]="gradeFeedback()"
                            (input)="gradeFeedback.set($any($event.target).value)"
                            class="input-field"
                            placeholder="Feedback for the learner..."
                          ></textarea>
                        </div>
                        <div class="flex items-center gap-3">
                          <button
                            type="button"
                            (click)="onGradeSubmission(sub.id)"
                            [disabled]="grading() || gradeScore() === null || gradeScore()! < 0 || gradeScore()! > 100"
                            class="btn-primary"
                          >
                            @if (grading()) {
                              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                            }
                            {{ sub.score !== null ? 'Update Grade' : 'Grade Exam' }}
                          </button>
                          <button
                            type="button"
                            (click)="expandedSubmissionId.set(null)"
                            class="btn-ghost"
                          >Cancel</button>
                        </div>
                      </div>

                      <!-- Reset confirmation -->
                      @if (resetConfirmId() === sub.id) {
                        <div class="alert-warning mt-4">
                          <div class="flex items-start gap-2 mb-2">
                            <lucide-icon [img]="icons.AlertTriangle" [size]="16" class="text-amber-600 mt-0.5"></lucide-icon>
                            <p class="text-sm text-amber-800">This will delete the submission and allow the learner to resubmit.</p>
                          </div>
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              (click)="onConfirmReset(sub.id)"
                              [disabled]="resetting()"
                              class="btn-danger"
                            >
                              @if (resetting()) {
                                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                              }
                              Yes, Reset
                            </button>
                            <button
                              type="button"
                              (click)="resetConfirmId.set(null)"
                              class="btn-ghost"
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
  #toast = inject(ToastService);
  #route = inject(ActivatedRoute);

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
    const courseId = this.#route.snapshot.queryParamMap.get('courseId');
    if (courseId) {
      this.selectedCourseId.set(courseId);
    }
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

    try {
      await this.gradingService.gradeSubmission(submissionId, {
        score,
        feedback: this.gradeFeedback(),
      });
      this.#toast.success('Submission graded');
      this.expandedSubmissionId.set(null);
      await this.gradingService.loadGradingData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grade submission';
      this.#toast.error(msg);
    } finally {
      this.grading.set(false);
    }
  }

  async onConfirmReset(submissionId: string) {
    this.resetting.set(true);

    try {
      await this.gradingService.resetSubmission(submissionId);
      this.#toast.success('Submission reset');
      this.expandedSubmissionId.set(null);
      this.resetConfirmId.set(null);
      await this.gradingService.loadGradingData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset submission';
      this.#toast.error(msg);
    } finally {
      this.resetting.set(false);
    }
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCourseId.set(null);
    this.statusFilter.set('all');
  }

  readonly formatDate = formatDate;
}
