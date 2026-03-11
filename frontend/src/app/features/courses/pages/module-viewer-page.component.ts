import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, BookOpen, Clock } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { XpService } from '../../../core/services/xp.service';
import { formatDuration } from '../../../core/utils/date.utils';
import { VideoViewerComponent } from '../components/video-viewer.component';
import { PdfViewerComponent } from '../components/pdf-viewer.component';
import { MarkdownViewerComponent } from '../components/markdown-viewer.component';
import { ModuleFilesListComponent } from '../components/module-files-list.component';
import { ExternalQuizViewerComponent } from '../components/external-quiz-viewer.component';
import { QuizTakerComponent } from '../components/quiz-taker.component';
import { ExamTakerComponent } from '../components/exam-taker.component';
import { AudioViewerComponent } from '../components/audio-viewer.component';
import { DownloadViewerComponent } from '../components/download-viewer.component';
import { CommentSectionComponent } from '../components/comment-section.component';
import { AskExpertComponent } from '../components/ask-expert.component';
import { ReportIssueComponent } from '../components/report-issue.component';
import { ModuleNotesComponent } from '../components/module-notes.component';
import { KnowledgeCheckSectionComponent } from '../components/knowledge-check-section.component';

@Component({
  selector: 'app-module-viewer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, VideoViewerComponent, PdfViewerComponent, MarkdownViewerComponent, ExternalQuizViewerComponent, ModuleFilesListComponent, QuizTakerComponent, ExamTakerComponent, AudioViewerComponent, DownloadViewerComponent, CommentSectionComponent, AskExpertComponent, ReportIssueComponent, ModuleNotesComponent, KnowledgeCheckSectionComponent],
  // Note: CommentSectionComponent, AskExpertComponent, ReportIssueComponent are kept in imports
  // for type checking but automatically deferred by @defer blocks in the template.
  host: { class: 'block page-enter' },
  template: `
    <div class="max-w-5xl mx-auto">
      <a [routerLink]="['/courses', courseId()]" class="back-link mb-4">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
        Back to course
      </a>

      @if (courseService.loading()) {
        <div class="animate-pulse space-y-4">
          <div class="h-6 bg-slate-200 rounded w-1/3"></div>
          <div class="h-4 bg-slate-200 rounded w-2/3"></div>
          <div class="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      } @else if (courseService.error()) {
        <div class="alert-error rounded-lg">
          {{ courseService.error() }}
        </div>
      } @else if (courseService.moduleViewer()) {
        <!-- Header -->
        <div class="mb-6">
          <h1 class="page-title">{{ courseService.moduleViewer()!.module.title }}</h1>
          @if (courseService.moduleViewer()!.module.description) {
            <p class="text-sm text-slate-500 mt-1">{{ courseService.moduleViewer()!.module.description }}</p>
          }
        </div>

        <!-- Action bar -->
        <div class="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-2.5 flex items-center justify-between mb-6">
          <!-- Previous -->
          <div class="min-w-[100px]">
            @if (courseService.moduleViewer()!.navigation.prev; as prev) {
              <a [routerLink]="['/courses', courseId(), 'modules', prev.id]"
                 class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200">
                <lucide-icon [img]="icons.ChevronLeft" [size]="16"></lucide-icon>
                Previous
              </a>
            }
          </div>

          <!-- Center: position + completion -->
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-400 tabular-nums">
              {{ courseService.moduleViewer()!.navigation.current }} of {{ courseService.moduleViewer()!.navigation.total }} modules
            </span>
            <span class="text-slate-200">|</span>
            <span class="flex items-center gap-1 text-xs text-slate-400 tabular-nums">
              <lucide-icon [img]="icons.Clock" [size]="12"></lucide-icon>
              {{ moduleDuration() }}
            </span>
            @if (canMarkComplete()) {
              <span class="text-slate-200">|</span>
              @if (isCompleted()) {
                <span class="badge-success inline-flex items-center gap-1">
                  <lucide-icon [img]="icons.Check" [size]="14"></lucide-icon>
                  Completed
                </span>
              } @else {
                <button (click)="onMarkComplete()" class="btn-primary btn-sm">
                  Mark as complete
                </button>
              }
            }
          </div>

          <!-- Next -->
          <div class="min-w-[100px] text-right">
            @if (courseService.moduleViewer()!.navigation.next; as next) {
              <a [routerLink]="['/courses', courseId(), 'modules', next.id]"
                 class="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-800 transition-colors duration-200">
                Next
                <lucide-icon [img]="icons.ChevronRight" [size]="16"></lucide-icon>
              </a>
            }
          </div>
        </div>

        <!-- Content -->
        <div class="mb-6">
          @switch (courseService.moduleViewer()!.content.type) {
            @case ('video') {
              <app-video-viewer [video]="$any(courseService.moduleViewer()!.content.data)" />
            }
            @case ('pdf') {
              <app-pdf-viewer
                [pdf]="$any(courseService.moduleViewer()!.content.data)"
                [initialPage]="courseService.getViewerState(courseService.moduleViewer()!.module.id)?.pdfPage ?? 1"
                (pageChange)="onPdfPageChange($event)"
              />
            }
            @case ('markdown') {
              <app-markdown-viewer [content]="$any(courseService.moduleViewer()!.content.data).content" />
            }
            @case ('external_quiz') {
              <app-external-quiz-viewer [content]="$any(courseService.moduleViewer()!.content.data)" />
            }
            @case ('quiz') {
              <app-quiz-taker
                [moduleId]="courseService.moduleViewer()!.module.id"
                (quizCompleted)="onQuizCompleted()" />
            }
            @case ('exam') {
              <app-exam-taker
                [moduleId]="courseService.moduleViewer()!.module.id"
                (examCompleted)="onExamCompleted()" />
            }
            @case ('audio') {
              <app-audio-viewer
                [audio]="$any(courseService.moduleViewer()!.content.data)"
                [moduleId]="courseService.moduleViewer()!.module.id"
                [courseId]="courseId()"
                [moduleTitle]="courseService.moduleViewer()!.module.title"
              />
            }
            @case ('download') {
              <app-download-viewer
                [download]="$any(courseService.moduleViewer()!.content.data)"
                [description]="courseService.moduleViewer()!.module.description"
              />
            }
            @default {
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
                <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
                <p class="text-sm font-semibold text-slate-600">Coming soon</p>
                <p class="text-xs text-slate-400 mt-1">This module type will be available in a future update.</p>
              </div>
            }
          }
        </div>

        <!-- Files -->
        @if (courseService.moduleViewer()!.files.length > 0) {
          <div class="mb-6">
            <app-module-files-list [files]="courseService.moduleViewer()!.files" />
          </div>
        }

        <!-- Knowledge Check (only for enrolled users, deferred) -->
        @if (isEnrolled()) {
          @defer (on viewport) {
            <div class="mb-6">
              <app-knowledge-check-section
                [moduleId]="courseService.moduleViewer()!.module.id"
              />
            </div>
          } @placeholder {
            <div class="mb-6 h-10"></div>
          }
        }

        <!-- Notes (only for enrolled users) -->
        @if (isEnrolled()) {
          <div class="mb-6">
            <app-module-notes
              [moduleId]="courseService.moduleViewer()!.module.id"
              [initialNotes]="courseService.moduleViewer()!.progress?.notes ?? null"
            />
          </div>
        }

        <!-- Ask Expert (deferred — below the fold) -->
        @defer (on viewport) {
          <div class="mt-6 mb-6">
            <app-ask-expert
              [courseId]="courseId()"
              [moduleId]="courseService.moduleViewer()!.module.id"
              [lecturers]="courseService.courseDetail()?.lecturers ?? []"
            />
          </div>
        } @placeholder {
          <div class="mt-6 mb-6 h-10"></div>
        }

        <!-- Report Issue (deferred — below the fold) -->
        @defer (on viewport) {
          <div class="mt-4 mb-6">
            <app-report-issue
              [courseId]="courseId()"
              [moduleId]="courseService.moduleViewer()!.module.id"
            />
          </div>
        } @placeholder {
          <div class="mt-4 mb-6 h-10"></div>
        }

        <!-- Comments (deferred — below the fold) -->
        @defer (on viewport) {
          <div class="mt-8 pt-6 border-t border-slate-200">
            <app-comment-section
              [moduleId]="courseService.moduleViewer()!.module.id"
              [courseId]="courseId()"
            />
          </div>
        } @placeholder {
          <div class="mt-8 pt-6 border-t border-slate-200 h-20"></div>
        }

        <!-- Bottom action bar -->
        <div class="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
          <div class="min-w-[100px]">
            @if (courseService.moduleViewer()!.navigation.prev; as prev) {
              <a [routerLink]="['/courses', courseId(), 'modules', prev.id]"
                 class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-200">
                <lucide-icon [img]="icons.ChevronLeft" [size]="16"></lucide-icon>
                Previous
              </a>
            }
          </div>
          <div class="relative flex items-center gap-3">
            @if (canMarkComplete()) {
              @if (isCompleted()) {
                <span class="badge-success inline-flex items-center gap-1">
                  <lucide-icon [img]="icons.Check" [size]="14"></lucide-icon>
                  Completed
                </span>
              } @else {
                <button (click)="onMarkComplete()" class="btn-primary btn-sm">
                  Mark as complete
                </button>
              }
            }
            @if (xpGainAmount(); as amount) {
              <span class="absolute -top-8 left-1/2 -translate-x-1/2 xp-float text-base font-bold text-teal-600 whitespace-nowrap z-10">
                +{{ amount }} XP
              </span>
            }
          </div>
          <div class="min-w-[100px] text-right">
            @if (courseService.moduleViewer()!.navigation.next; as next) {
              <a [routerLink]="['/courses', courseId(), 'modules', next.id]"
                 class="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-800 transition-colors duration-200">
                Next
                <lucide-icon [img]="icons.ChevronRight" [size]="16"></lucide-icon>
              </a>
            }
          </div>
        </div>

      }
    </div>
  `,
})
export class ModuleViewerPageComponent {
  readonly courseService = inject(CourseService);
  #xpService = inject(XpService);
  #route = inject(ActivatedRoute);

  readonly icons = { ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, BookOpen, Clock };
  readonly xpGainAmount = signal<number | null>(null);

  // Reactive route params — toSignal converts the paramMap observable to a signal
  // so the effect below fires on every param change (e.g. Next/Previous navigation).
  readonly #params = toSignal(this.#route.paramMap);
  readonly courseId = computed(() => this.#params()?.get('courseId') ?? '');
  readonly #moduleId = computed(() => this.#params()?.get('moduleId') ?? '');

  readonly moduleDuration = computed(() => {
    const viewer = this.courseService.moduleViewer();
    return viewer ? formatDuration(viewer.module.estimated_duration_minutes) : '';
  });

  readonly canMarkComplete = computed(() => {
    const viewer = this.courseService.moduleViewer();
    if (!viewer) return false;
    const detail = this.courseService.courseDetail();
    if (!detail?.isEnrolled) return false;
    const t = viewer.module.module_type;
    return t === 'video' || t === 'pdf' || t === 'markdown' || t === 'external_quiz' || t === 'audio' || t === 'download';
  });

  readonly isCompleted = computed(() => {
    return this.courseService.moduleViewer()?.progress?.status === 'completed';
  });

  readonly isEnrolled = computed(() => this.courseService.courseDetail()?.isEnrolled ?? false);

  constructor() {
    // Effect re-runs whenever courseId or moduleId signals change,
    // triggering a fresh data load. This fixes the stale navigation bug
    // where clicking Next/Previous changed the URL but didn't reload content.
    effect(() => {
      const cId = this.courseId();
      const mId = this.#moduleId();
      if (cId && mId) {
        this.courseService.loadModuleViewer(cId, mId);
      }
    });
  }

  async onMarkComplete() {
    const moduleId = this.courseService.moduleViewer()?.module.id;
    if (moduleId) {
      await this.courseService.markModuleComplete(moduleId);
      if (!this.courseService.error()) {
        this.xpGainAmount.set(10);
        setTimeout(() => this.xpGainAmount.set(null), 1600);
        this.#xpService.loadXp(true);
      }
    }
  }

  onQuizCompleted() {
    // No-op: quiz-taker handles its own results display internally.
    // Progress will update when the user navigates back to course detail.
    // Calling loadModuleViewer here would destroy the quiz-taker component
    // (loading=true removes it from DOM), losing the results view.
  }

  onExamCompleted() {
    // No-op: exam grading happens asynchronously by a lecturer.
    // Progress auto-marks via on_exam_passed_auto_mark trigger when graded.
  }

  onPdfPageChange(page: number) {
    const moduleId = this.courseService.moduleViewer()?.module.id;
    if (moduleId) {
      this.courseService.setViewerState(moduleId, { pdfPage: page });
    }
  }
}
