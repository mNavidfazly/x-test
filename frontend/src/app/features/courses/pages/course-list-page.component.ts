import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, BookOpen, Loader2, Plus } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { CourseCardComponent } from '../components/course-card.component';

@Component({
  selector: 'app-course-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, CourseCardComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900">My Courses</h1>
        @if (isPlatformAdmin()) {
          <a routerLink="/courses/new"
             class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 inline-flex items-center gap-2 text-sm">
            <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
            Create Course
          </a>
        }
      </div>

      @if (courseService.loading()) {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (i of skeletons; track i) {
            <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-pulse">
              <div class="aspect-video bg-slate-200"></div>
              <div class="p-4 space-y-3">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                <div class="h-2 bg-slate-200 rounded-full"></div>
              </div>
            </div>
          }
        </div>
      } @else if (courseService.error()) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {{ courseService.error() }}
        </div>
      } @else if (courseService.courses().length === 0) {
        <div class="text-center py-16">
          <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm text-slate-500">No courses available yet.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (course of courseService.courses(); track course.id) {
            <app-course-card [course]="course" />
          }
        </div>
      }
    </div>
  `,
})
export class CourseListPageComponent implements OnInit {
  readonly courseService = inject(CourseService);
  #auth = inject(AuthService);
  readonly icons = { BookOpen, Loader2, Plus };
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims?.is_platform_admin ?? false,
  );

  ngOnInit() {
    this.courseService.loadCourses();
  }
}
