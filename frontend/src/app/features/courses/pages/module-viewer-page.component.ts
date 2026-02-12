import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, BookOpen } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { VideoViewerComponent } from '../components/video-viewer.component';
import { PdfViewerComponent } from '../components/pdf-viewer.component';
import { MarkdownViewerComponent } from '../components/markdown-viewer.component';
import { ModuleFilesListComponent } from '../components/module-files-list.component';
import { ExternalQuizViewerComponent } from '../components/external-quiz-viewer.component';

@Component({
  selector: 'app-module-viewer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, VideoViewerComponent, PdfViewerComponent, MarkdownViewerComponent, ExternalQuizViewerComponent, ModuleFilesListComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <a [routerLink]="['/courses', courseId()]" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
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
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {{ courseService.error() }}
        </div>
      } @else if (courseService.moduleViewer()) {
        <!-- Header -->
        <div class="mb-6">
          <p class="text-xs text-slate-400 mb-1">{{ courseService.moduleViewer()!.navigation.current }} of {{ courseService.moduleViewer()!.navigation.total }} modules</p>
          <h1 class="text-xl font-bold text-slate-900">{{ courseService.moduleViewer()!.module.title }}</h1>
          @if (courseService.moduleViewer()!.module.description) {
            <p class="text-sm text-slate-500 mt-1">{{ courseService.moduleViewer()!.module.description }}</p>
          }
        </div>

        <!-- Content -->
        <div class="mb-6">
          @switch (courseService.moduleViewer()!.content.type) {
            @case ('video') {
              <app-video-viewer [video]="$any(courseService.moduleViewer()!.content.data)" />
            }
            @case ('pdf') {
              <app-pdf-viewer [pdf]="$any(courseService.moduleViewer()!.content.data)" />
            }
            @case ('markdown') {
              <app-markdown-viewer [content]="$any(courseService.moduleViewer()!.content.data).content" />
            }
            @case ('external_quiz') {
              <app-external-quiz-viewer [content]="$any(courseService.moduleViewer()!.content.data)" />
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

        <!-- Bottom navigation bar -->
        <div class="flex items-center justify-between border-t border-slate-200 pt-4 mt-6">
          <div>
            @if (courseService.moduleViewer()!.navigation.prev; as prev) {
              <a [routerLink]="['/courses', courseId(), 'modules', prev.id]"
                 class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                <lucide-icon [img]="icons.ChevronLeft" [size]="16"></lucide-icon>
                Previous
              </a>
            }
          </div>

          <div class="flex items-center gap-3">
            @if (canMarkComplete()) {
              @if (isCompleted()) {
                <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <lucide-icon [img]="icons.Check" [size]="16"></lucide-icon>
                  Completed
                </span>
              } @else {
                <button
                  (click)="onMarkComplete()"
                  class="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200"
                >
                  Mark as complete
                </button>
              }
            }
          </div>

          <div>
            @if (courseService.moduleViewer()!.navigation.next; as next) {
              <a [routerLink]="['/courses', courseId(), 'modules', next.id]"
                 class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
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
  #route = inject(ActivatedRoute);

  readonly icons = { ArrowLeft, ChevronLeft, ChevronRight, Check, Loader2, BookOpen };

  // Reactive route params — toSignal converts the paramMap observable to a signal
  // so the effect below fires on every param change (e.g. Next/Previous navigation).
  readonly #params = toSignal(this.#route.paramMap);
  readonly courseId = computed(() => this.#params()?.get('courseId') ?? '');
  readonly #moduleId = computed(() => this.#params()?.get('moduleId') ?? '');

  readonly canMarkComplete = computed(() => {
    const viewer = this.courseService.moduleViewer();
    if (!viewer) return false;
    const detail = this.courseService.courseDetail();
    if (!detail?.isEnrolled) return false;
    const t = viewer.module.module_type;
    return t === 'video' || t === 'pdf' || t === 'markdown' || t === 'external_quiz';
  });

  readonly isCompleted = computed(() => {
    return this.courseService.moduleViewer()?.progress?.status === 'completed';
  });

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

  onMarkComplete() {
    const moduleId = this.courseService.moduleViewer()?.module.id;
    if (moduleId) {
      this.courseService.markModuleComplete(moduleId);
    }
  }
}
