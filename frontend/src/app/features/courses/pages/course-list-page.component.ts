import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, BookOpen, Plus } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { CourseCardComponent } from '../components/course-card.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { CourseWithProgress } from '../../../core/models/course.model';

@Component({
  selector: 'app-course-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, CourseCardComponent, ErrorAlertComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title">My Courses</h1>
        @if (isPlatformAdmin()) {
          <a routerLink="/courses/new"
             class="btn-primary">
            <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
            Create Course
          </a>
        }
      </div>

      @if (courseService.error()) {
        <app-error-alert [message]="courseService.error()!" />
      } @else if (!batchReady()) {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (i of skeletons; track i) {
            <div class="card overflow-hidden animate-pulse">
              <div class="aspect-video bg-slate-200"></div>
              <div class="p-4 space-y-3">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                <div class="h-2 bg-slate-200 rounded-full"></div>
              </div>
            </div>
          }
        </div>
      } @else if (courseService.courses().length === 0) {
        <div class="text-center py-16">
          <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm text-slate-500">No courses available yet.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (course of courseService.courses(); track course.id; let i = $index) {
            <app-course-card [course]="course" [preloaded]="i < BATCH_SIZE" />
          }
        </div>
      }
    </div>
  `,
})
export class CourseListPageComponent implements OnInit {
  readonly courseService = inject(CourseService);
  #auth = inject(AuthService);
  readonly icons = { BookOpen, Plus };
  readonly skeletons = [1, 2, 3, 4, 5, 6];
  readonly BATCH_SIZE = 9;
  readonly batchReady = signal(false);

  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims?.is_platform_admin ?? false,
  );

  async ngOnInit() {
    await this.courseService.loadCourses();
    const courses = this.courseService.courses();
    if (this.courseService.error() || courses.length === 0) {
      this.batchReady.set(true);
      return;
    }
    this.#preloadBatch(courses);
  }

  #preloadBatch(courses: CourseWithProgress[]) {
    const urls = courses
      .slice(0, this.BATCH_SIZE)
      .map(c => c.thumbnail_url)
      .filter((url): url is string => !!url);

    if (urls.length === 0) {
      this.batchReady.set(true);
      return;
    }

    let loaded = 0;
    const checkDone = () => {
      loaded++;
      if (loaded >= urls.length) this.batchReady.set(true);
    };

    // Safety timeout — never block skeleton more than 3 seconds
    setTimeout(() => this.batchReady.set(true), 3000);

    for (const url of urls) {
      const img = new Image();
      img.onload = checkDone;
      img.onerror = checkDone;
      img.src = url;
    }
  }
}
