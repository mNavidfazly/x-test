import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, output, signal } from '@angular/core';
import { LucideAngularModule, Clock, Play, Upload, Download, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { ExamTakingData, ExamSubmission } from '../../../core/models/course.model';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';

@Component({
  selector: 'app-exam-taker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FileUploadComponent],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <div class="animate-pulse space-y-4">
        <div class="h-6 bg-slate-200 rounded w-1/3"></div>
        <div class="h-4 bg-slate-200 rounded w-2/3"></div>
        <div class="h-48 bg-slate-200 rounded-lg"></div>
      </div>
    } @else if (error()) {
      <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
        {{ error() }}
      </div>
    } @else if (examData()) {
      @switch (phase()) {

        @case ('info') {
          <div class="space-y-6">
            <div class="rounded-xl border border-slate-200 bg-white p-6">
              @if (examData()!.description) {
                <p class="text-sm text-slate-600 mb-4">{{ examData()!.description }}</p>
              }

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Duration</p>
                  <p class="text-lg font-bold text-slate-900">{{ examData()!.duration_minutes }} min</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Passing Score</p>
                  <p class="text-lg font-bold text-slate-900">{{ examData()!.passing_score }}%</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Accepted Files</p>
                  <p class="text-lg font-bold text-slate-900">{{ fileTypeLabels() }}</p>
                </div>
                <div class="text-center">
                  <p class="text-xs text-slate-500 mb-1">Max File Size</p>
                  <p class="text-lg font-bold text-slate-900">{{ maxFileSizeMB() }} MB</p>
                </div>
              </div>
            </div>

            <div class="flex justify-center">
              <button (click)="onStartExam()"
                      class="bg-teal-600 text-white rounded-lg px-6 py-3 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 inline-flex items-center gap-2">
                <lucide-icon [img]="icons.Play" [size]="18"></lucide-icon>
                Start Exam
              </button>
            </div>
          </div>
        }

        @case ('active') {
          <div class="space-y-4">
            <!-- Timer bar -->
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
                  {{ isOverDeadline() ? 'Time expired' : timerDisplay() }}
                </span>
              </div>
              <span class="text-xs"
                [class.text-teal-600]="timerColor() === 'teal'"
                [class.text-amber-600]="timerColor() === 'amber'"
                [class.text-rose-600]="timerColor() === 'rose'">
                {{ isOverDeadline() ? 'You may still submit' : 'Time remaining' }}
              </span>
            </div>

            <!-- Download exam file -->
            @if (examData()!.exam_file_url) {
              <div class="rounded-xl border border-slate-200 bg-white p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Exam Instructions</p>
                <a [href]="examData()!.exam_file_url" target="_blank" rel="noopener"
                   class="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-all duration-200 inline-flex items-center gap-2">
                  <lucide-icon [img]="icons.Download" [size]="16"></lucide-icon>
                  Download Exam File
                </a>
              </div>
            }

            <!-- File upload -->
            <div class="rounded-xl border border-slate-200 bg-white p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Your Submission</p>
              <app-file-upload
                [accept]="examData()!.allowed_file_types.join(',')"
                [maxSizeMB]="maxFileSizeMB()"
                (fileSelected)="onFileSelected($event)"
                (removeFile)="selectedFile.set(null)" />
            </div>

            <!-- Submit -->
            <div class="flex items-center justify-end border-t border-slate-200 pt-4 mt-2">
              @if (confirmingSubmit()) {
                <div class="flex items-center gap-3">
                  <span class="text-sm text-slate-600">Submit your exam?</span>
                  <button (click)="onConfirmSubmit()"
                          [disabled]="submitting()"
                          class="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50">
                    {{ submitting() ? 'Submitting...' : 'Yes, Submit' }}
                  </button>
                  <button (click)="confirmingSubmit.set(false)"
                          [disabled]="submitting()"
                          class="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-all duration-200">
                    Cancel
                  </button>
                </div>
              } @else {
                <button (click)="confirmingSubmit.set(true)"
                        [disabled]="!selectedFile() || submitting()"
                        class="bg-teal-600 text-white rounded-lg px-5 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 inline-flex items-center gap-2">
                  <lucide-icon [img]="icons.Upload" [size]="16"></lucide-icon>
                  Submit Exam
                </button>
              }
            </div>
          </div>
        }

        @case ('submitted') {
          @if (submission()) {
            <div class="space-y-6">
              <!-- Submission info card -->
              <div class="rounded-xl border border-slate-200 bg-white p-6">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Submission Details</p>
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="text-slate-500 text-xs mb-0.5">Submitted</p>
                    <p class="text-slate-900 font-medium">{{ formatDate(submission()!.submitted_at) }}</p>
                  </div>
                  <div>
                    <p class="text-slate-500 text-xs mb-0.5">Deadline</p>
                    <p class="text-slate-900 font-medium">{{ formatDate(submission()!.deadline) }}</p>
                  </div>
                  <div>
                    <p class="text-slate-500 text-xs mb-0.5">Status</p>
                    @if (wasOnTime()) {
                      <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">On time</span>
                    } @else {
                      <span class="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">Late</span>
                    }
                  </div>
                  <div>
                    <p class="text-slate-500 text-xs mb-0.5">File</p>
                    <a [href]="submission()!.file_url" target="_blank" rel="noopener"
                       class="text-teal-600 hover:text-teal-800 font-semibold text-xs inline-flex items-center gap-1 transition-colors">
                      <lucide-icon [img]="icons.FileText" [size]="12"></lucide-icon>
                      Download
                    </a>
                  </div>
                </div>
              </div>

              <!-- Grading status -->
              @if (isGraded()) {
                <div class="rounded-xl border-2 p-6 text-center"
                     [class.border-emerald-300]="isPassed()"
                     [class.bg-emerald-50]="isPassed()"
                     [class.border-rose-300]="!isPassed()"
                     [class.bg-rose-50]="!isPassed()">
                  <div class="mb-3">
                    @if (isPassed()) {
                      <lucide-icon [img]="icons.CheckCircle2" [size]="48" class="text-emerald-600 mx-auto"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.XCircle" [size]="48" class="text-rose-600 mx-auto"></lucide-icon>
                    }
                  </div>
                  <p class="text-3xl font-bold tabular-nums mb-1"
                     [class.text-emerald-700]="isPassed()"
                     [class.text-rose-700]="!isPassed()">
                    {{ submission()!.score }}%
                  </p>
                  <p class="text-sm font-semibold mb-2"
                     [class.text-emerald-600]="isPassed()"
                     [class.text-rose-600]="!isPassed()">
                    {{ isPassed() ? 'Passed' : 'Failed' }}
                  </p>
                  @if (submission()!.feedback) {
                    <div class="mt-4 text-left rounded-lg bg-white/60 p-4">
                      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Feedback</p>
                      <p class="text-sm text-slate-700">{{ submission()!.feedback }}</p>
                    </div>
                  }
                </div>
              } @else {
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <lucide-icon [img]="icons.Clock" [size]="48" class="text-slate-300 mx-auto mb-3"></lucide-icon>
                  <p class="text-sm font-semibold text-slate-600">Awaiting grading</p>
                  <p class="text-xs text-slate-400 mt-1">Your submission is being reviewed by a lecturer.</p>
                </div>
              }
            </div>
          }
        }
      }
    }
  `,
})
export class ExamTakerComponent implements OnDestroy {
  readonly #courseService = inject(CourseService);
  readonly moduleId = input.required<string>();
  readonly examCompleted = output<void>();

  readonly icons = { Clock, Play, Upload, Download, CheckCircle2, XCircle, AlertTriangle, FileText };

  readonly phase = signal<'info' | 'active' | 'submitted'>('info');
  readonly examData = signal<ExamTakingData | null>(null);
  readonly submission = signal<ExamSubmission | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly timeRemaining = signal(0);
  readonly startedAt = signal<string | null>(null);
  readonly confirmingSubmit = signal(false);

  #timerRef: ReturnType<typeof setInterval> | null = null;

  readonly timerDisplay = computed(() => {
    const s = Math.max(0, this.timeRemaining());
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  readonly timerColor = computed(() => {
    const exam = this.examData();
    if (!exam) return 'teal';
    const totalSeconds = exam.duration_minutes * 60;
    const ratio = this.timeRemaining() / totalSeconds;
    if (ratio > 0.5) return 'teal';
    if (ratio > 0.1) return 'amber';
    return 'rose';
  });

  readonly isOverDeadline = computed(() => {
    return this.timeRemaining() <= 0 && this.startedAt() !== null;
  });

  readonly isGraded = computed(() => {
    return this.submission()?.score != null;
  });

  readonly isPassed = computed(() => {
    const sub = this.submission();
    const exam = this.examData();
    if (!sub || sub.score == null || !exam) return false;
    return sub.score >= exam.passing_score;
  });

  readonly fileTypeLabels = computed(() => {
    const types = this.examData()?.allowed_file_types ?? [];
    return types.map(t => {
      const ext = t.split('/')[1]?.toUpperCase();
      return ext ?? t;
    }).join(', ');
  });

  readonly maxFileSizeMB = computed(() => {
    const bytes = this.examData()?.max_file_size ?? 0;
    return Math.round(bytes / (1024 * 1024));
  });

  readonly wasOnTime = computed(() => {
    const sub = this.submission();
    if (!sub) return true;
    return new Date(sub.submitted_at) <= new Date(sub.deadline);
  });

  constructor() {
    effect(() => {
      const mid = this.moduleId();
      if (mid) {
        this.#loadExam(mid);
      }
    });
  }

  ngOnDestroy() {
    this.#clearTimer();
  }

  onStartExam() {
    const exam = this.examData();
    if (!exam) return;

    const storageKey = `exam_start_${exam.id}`;
    let start = localStorage.getItem(storageKey);
    if (!start) {
      start = new Date().toISOString();
      localStorage.setItem(storageKey, start);
    }

    this.startedAt.set(start);
    this.phase.set('active');
    this.#startTimer(exam.duration_minutes * 60, start);
  }

  onFileSelected(file: File) {
    this.selectedFile.set(file);
  }

  async onConfirmSubmit() {
    const exam = this.examData();
    const file = this.selectedFile();
    const start = this.startedAt();
    if (!exam || !file || !start || this.submitting()) return;

    const courseId = this.#courseService.moduleViewer()?.module.course_id;
    if (!courseId) return;

    try {
      this.submitting.set(true);
      this.error.set('');
      this.#clearTimer();

      const result = await this.#courseService.submitExamSubmission(
        exam.id, courseId, file, start, exam.duration_minutes,
      );

      this.submission.set(result);
      this.phase.set('submitted');

      // Clear localStorage start time on success
      localStorage.removeItem(`exam_start_${exam.id}`);

      this.examCompleted.emit();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to submit exam';
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        this.error.set('You have already submitted this exam');
      } else {
        this.error.set(msg);
      }
    } finally {
      this.submitting.set(false);
      this.confirmingSubmit.set(false);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async #loadExam(moduleId: string) {
    try {
      this.loading.set(true);
      this.error.set('');
      const data = await this.#courseService.loadExamForTaking(moduleId);
      if (!data) {
        this.error.set('Exam not found');
        return;
      }
      this.examData.set(data.exam);
      if (data.submission) {
        this.submission.set(data.submission);
        this.phase.set('submitted');
      }
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load exam');
    } finally {
      this.loading.set(false);
    }
  }

  #startTimer(totalSeconds: number, startedAt: string) {
    this.#clearTimer();
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const remaining = Math.max(0, totalSeconds - elapsed);
    this.timeRemaining.set(remaining);

    if (remaining <= 0) return;

    this.#timerRef = setInterval(() => {
      const r = this.timeRemaining() - 1;
      this.timeRemaining.set(r);
      if (r <= 0) {
        this.#clearTimer();
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
