import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Loader2, BookOpen } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { LectureAccordionComponent } from '../components/lecture-accordion.component';

const BADGE_STYLES: Record<string, string> = {
  open: 'bg-emerald-100 text-emerald-700',
  invite_only: 'bg-amber-100 text-amber-700',
  password_protected: 'bg-slate-100 text-slate-600',
};

const BADGE_LABELS: Record<string, string> = {
  open: 'Open',
  invite_only: 'Invite only',
  password_protected: 'Password',
};

@Component({
  selector: 'app-course-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, LectureAccordionComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <a routerLink="/courses" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
        Back to courses
      </a>

      @if (courseService.loading()) {
        <div class="animate-pulse space-y-4">
          <div class="h-6 bg-slate-200 rounded w-1/3"></div>
          <div class="h-4 bg-slate-200 rounded w-2/3"></div>
          <div class="h-2 bg-slate-200 rounded-full w-1/2"></div>
          <div class="space-y-3 mt-6">
            @for (i of [1, 2, 3]; track i) {
              <div class="h-12 bg-slate-200 rounded-xl"></div>
            }
          </div>
        </div>
      } @else if (courseService.error()) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {{ courseService.error() }}
        </div>
      } @else if (courseService.courseDetail()) {
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-start gap-3 mb-2">
            <h1 class="text-xl font-bold text-slate-900 flex-1">{{ courseService.courseDetail()!.title }}</h1>
            <span [class]="'shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' + badgeStyle()">
              {{ badgeLabel() }}
            </span>
          </div>

          @if (courseService.courseDetail()!.description) {
            <p class="text-sm text-slate-500 mb-4">{{ courseService.courseDetail()!.description }}</p>
          }

          <!-- Progress summary -->
          @if (totalModules() > 0) {
            <div class="flex items-center gap-3">
              <div class="flex-1">
                <div class="bg-slate-200 rounded-full h-2">
                  <div class="bg-teal-600 rounded-full h-2 transition-all duration-300"
                       [style.width.%]="progressPercent()"></div>
                </div>
              </div>
              <span class="text-sm font-semibold text-slate-700 tabular-nums shrink-0">
                {{ completedModules() }}/{{ totalModules() }} modules completed
              </span>
            </div>
          }
        </div>

        <!-- Lectures -->
        @if (courseService.courseDetail()!.lectures.length === 0) {
          <div class="text-center py-12">
            <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
            <p class="text-sm text-slate-500">No lectures added yet.</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (lecture of courseService.courseDetail()!.lectures; track lecture.id) {
              <app-lecture-accordion
                [lecture]="lecture"
                [progressMap]="courseService.courseDetail()!.progressMap"
              />
            }
          </div>
        }
      }
    </div>
  `,
})
export class CourseDetailPageComponent implements OnInit {
  readonly courseService = inject(CourseService);
  #route = inject(ActivatedRoute);
  readonly icons = { ArrowLeft, Loader2, BookOpen };

  readonly badgeStyle = computed(() => {
    const detail = this.courseService.courseDetail();
    return BADGE_STYLES[detail?.enrollment_type ?? 'open'] ?? BADGE_STYLES['open'];
  });

  readonly badgeLabel = computed(() => {
    const detail = this.courseService.courseDetail();
    return BADGE_LABELS[detail?.enrollment_type ?? 'open'] ?? detail?.enrollment_type ?? '';
  });

  readonly totalModules = computed(() => {
    const detail = this.courseService.courseDetail();
    if (!detail) return 0;
    return detail.lectures.reduce((sum, l) => sum + l.modules.length, 0);
  });

  readonly completedModules = computed(() => {
    const detail = this.courseService.courseDetail();
    if (!detail) return 0;
    return Object.values(detail.progressMap).filter(p => p.status === 'completed').length;
  });

  readonly progressPercent = computed(() => {
    const total = this.totalModules();
    if (total === 0) return 0;
    return Math.round((this.completedModules() / total) * 100);
  });

  ngOnInit() {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (courseId) {
      this.courseService.loadCourseDetail(courseId);
    }
  }
}
