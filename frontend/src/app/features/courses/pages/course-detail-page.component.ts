import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, BookOpen, Clock, Pencil, Trash2, Plus } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LectureFormData } from '../../../core/models/course.model';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { formatDuration } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { StatusBadgeComponent, BadgeVariant } from '../../../shared/components/status-badge.component';
import { LectureAccordionComponent } from '../components/lecture-accordion.component';
import { LectureFormComponent } from '../components/lecture-form.component';
import { EnrollmentCtaComponent } from '../components/enrollment-cta.component';
import { EnrollmentManagerComponent } from '../components/enrollment-manager.component';
import { ProgressManagerComponent } from '../components/progress-manager.component';

const BADGE_VARIANTS: Record<string, BadgeVariant> = {
  open: 'success',
  invite_only: 'warning',
  password_protected: 'neutral',
};

const BADGE_LABELS: Record<string, string> = {
  open: 'Open',
  invite_only: 'Invite only',
  password_protected: 'Password',
};

@Component({
  selector: 'app-course-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, LectureAccordionComponent, LectureFormComponent, EnrollmentCtaComponent, EnrollmentManagerComponent, ProgressManagerComponent, ErrorAlertComponent, StatusBadgeComponent],
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
        <app-error-alert [message]="courseService.error()!" />
      } @else if (courseService.courseDetail()) {
        <!-- Header -->
        <div class="mb-6">
          <div class="flex items-start gap-3 mb-2">
            <h1 class="page-title flex-1">{{ courseService.courseDetail()!.title }}</h1>
            <app-status-badge [variant]="badgeVariant()" class="shrink-0">{{ badgeLabel() }}</app-status-badge>
            @if (canEdit()) {
              <a [routerLink]="['/courses', courseService.courseDetail()!.id, 'edit']"
                 class="shrink-0 btn-secondary px-3 py-1.5 inline-flex items-center gap-1.5">
                <lucide-icon [img]="icons.Pencil" [size]="14"></lucide-icon>
                Edit
              </a>
            }
          </div>

          @if (courseService.courseDetail()!.description) {
            <p class="text-sm text-slate-500 mb-3">{{ courseService.courseDetail()!.description }}</p>
          }

          @if (totalDurationMinutes() > 0) {
            <p class="flex items-center gap-1.5 text-sm text-slate-500 mb-4">
              <lucide-icon [img]="icons.Clock" [size]="14" class="text-slate-400"></lucide-icon>
              {{ formattedTotalDuration() }} total
            </p>
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

        <!-- Enrollment CTA -->
        @if (!canEdit()) {
          <div class="mb-6">
            <app-enrollment-cta
              [enrollmentType]="courseService.courseDetail()!.enrollment_type"
              [isEnrolled]="courseService.courseDetail()!.isEnrolled"
              [canEdit]="canEdit()"
              (enroll)="onEnroll()"
              (enrollWithPassword)="onEnrollWithPassword($event)"
            />
          </div>
        }

        <!-- Add Lecture button -->
        @if (canEdit() && !editingLectureId()) {
          <button
            type="button"
            (click)="startAddLecture()"
            class="w-full mb-4 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30 transition-all duration-200 inline-flex items-center justify-center gap-2"
          >
            <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
            Add Lecture
          </button>
        }

        <!-- New lecture form -->
        @if (editingLectureId() === 'new') {
          <div class="mb-4">
            <app-lecture-form
              [initialData]="editingLectureData()"
              (save)="onSaveLecture($event)"
              (cancel)="cancelLectureEdit()"
            />
          </div>
        }

        <!-- Lectures -->
        @if (courseService.courseDetail()!.lectures.length === 0 && editingLectureId() !== 'new') {
          <div class="text-center py-12">
            <lucide-icon [img]="icons.BookOpen" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
            <p class="text-sm text-slate-500">No lectures added yet.</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (lecture of courseService.courseDetail()!.lectures; track lecture.id; let first = $first; let last = $last) {
              @if (editingLectureId() === lecture.id) {
                <app-lecture-form
                  [initialData]="editingLectureData()"
                  [isEditMode]="true"
                  (save)="onSaveLecture($event)"
                  (cancel)="cancelLectureEdit()"
                />
              } @else {
                <app-lecture-accordion
                  [lecture]="lecture"
                  [courseId]="courseService.courseDetail()!.id"
                  [progressMap]="courseService.courseDetail()!.progressMap"
                  [canEdit]="canEdit()"
                  [isFirst]="first"
                  [isLast]="last"
                  (edit)="startEditLecture(lecture.id)"
                  (deleteConfirmed)="onDeleteLecture(lecture.id)"
                  (moveUp)="onMoveLecture(lecture.id, 'up')"
                  (moveDown)="onMoveLecture(lecture.id, 'down')"
                  (addModule)="onAddModule(lecture.id)"
                  (editModule)="onEditModule($event)"
                  (deleteModule)="onDeleteModule($event)"
                  (moveModuleUp)="onMoveModule($event, lecture.id, 'up')"
                  (moveModuleDown)="onMoveModule($event, lecture.id, 'down')"
                />
              }
            }
          </div>
        }

        <!-- Enrollment Manager (TA/PA only) -->
        @if (canManageEnrollments()) {
          <div class="mt-8 pt-6 border-t border-slate-200">
            <app-enrollment-manager
              [courseId]="courseService.courseDetail()!.id"
              [enrollmentType]="courseService.courseDetail()!.enrollment_type"
            />
          </div>
        }

        <!-- Progress Manager (TA/PA only) -->
        @if (canManageEnrollments()) {
          <div class="mt-8 pt-6 border-t border-slate-200">
            <app-progress-manager
              [courseId]="courseService.courseDetail()!.id"
              [lectures]="courseService.courseDetail()!.lectures"
            />
          </div>
        }

        @if (isPlatformAdmin()) {
          <div class="mt-8 pt-6 border-t border-slate-200">
            @if (!confirmingDelete()) {
              <button
                type="button"
                (click)="confirmingDelete.set(true)"
                class="btn-danger"
              >
                <lucide-icon [img]="icons.Trash2" [size]="16"></lucide-icon>
                Delete Course
              </button>
            } @else {
              <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
                <p class="text-sm text-rose-700 font-semibold mb-3">Are you sure? This will permanently delete this course and all its content.</p>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    (click)="onDelete()"
                    [disabled]="deleting()"
                    class="btn-danger-solid"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    (click)="confirmingDelete.set(false)"
                    class="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class CourseDetailPageComponent implements OnInit {
  readonly courseService = inject(CourseService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  readonly icons = { ArrowLeft, BookOpen, Clock, Pencil, Trash2, Plus };

  private readonly enrollmentCta = viewChild(EnrollmentCtaComponent);

  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);

  // Lecture CRUD state
  readonly editingLectureId = signal<string | null>(null);
  readonly lectureSaving = signal(false);

  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims?.is_platform_admin ?? false,
  );

  readonly canManageEnrollments = computed(() => {
    const user = this.#auth.currentUser();
    if (!user) return false;
    return user.claims.is_platform_admin || user.claims.is_tenant_admin;
  });

  readonly canEdit = computed(() => {
    const user = this.#auth.currentUser();
    if (!user) return false;
    if (user.claims.is_platform_admin) return true;
    const cid = this.#route.snapshot.paramMap.get('courseId');
    return cid ? user.claims.lecturer_can_edit_course_ids.includes(cid) : false;
  });

  readonly editingLectureData = computed((): LectureFormData => {
    const editId = this.editingLectureId();
    if (!editId || editId === 'new') return { title: '', description: null };
    const lecture = this.courseService.courseDetail()?.lectures.find(l => l.id === editId);
    return lecture ? { title: lecture.title, description: lecture.description } : { title: '', description: null };
  });

  readonly badgeVariant = computed((): BadgeVariant => {
    const detail = this.courseService.courseDetail();
    return BADGE_VARIANTS[detail?.enrollment_type ?? 'open'] ?? BADGE_VARIANTS['open'];
  });

  readonly badgeLabel = computed(() => {
    const detail = this.courseService.courseDetail();
    return BADGE_LABELS[detail?.enrollment_type ?? 'open'] ?? detail?.enrollment_type ?? '';
  });

  readonly totalDurationMinutes = computed(() => {
    const detail = this.courseService.courseDetail();
    if (!detail) return 0;
    return detail.lectures.reduce(
      (sum, l) => sum + l.modules.reduce((s, m) => s + m.estimated_duration_minutes, 0), 0,
    );
  });

  readonly formattedTotalDuration = computed(() => formatDuration(this.totalDurationMinutes()));

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

  async onEnroll() {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;
    try {
      await this.courseService.enrollInOpenCourse(courseId);
    } catch (err) {
      this.enrollmentCta()?.setError(err instanceof Error ? err.message : 'Enrollment failed');
    }
  }

  async onEnrollWithPassword(password: string) {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;
    try {
      await this.courseService.enrollWithPassword(courseId, password);
    } catch (err) {
      this.enrollmentCta()?.setError(err instanceof Error ? err.message : 'Enrollment failed');
    }
  }

  startAddLecture() {
    this.editingLectureId.set('new');
  }

  startEditLecture(id: string) {
    this.editingLectureId.set(id);
  }

  cancelLectureEdit() {
    this.editingLectureId.set(null);
  }

  async onSaveLecture(data: LectureFormData) {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;

    const editId = this.editingLectureId();
    this.lectureSaving.set(true);

    try {
      if (editId === 'new') {
        await this.courseService.createLecture(courseId, data);
      } else if (editId) {
        await this.courseService.updateLecture(editId, data);
      }
      this.editingLectureId.set(null);
      await this.courseService.loadCourseDetail(courseId);
      this.#toast.success('Lecture saved');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to save lecture'));
    } finally {
      this.lectureSaving.set(false);
    }
  }

  async onDeleteLecture(lectureId: string) {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;

    try {
      await this.courseService.deleteLecture(lectureId);
      await this.courseService.loadCourseDetail(courseId);
      this.#toast.success('Lecture deleted');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to delete lecture'));
    }
  }

  async onMoveLecture(lectureId: string, direction: 'up' | 'down') {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    const detail = this.courseService.courseDetail();
    if (!courseId || !detail) return;

    const lectures = detail.lectures;
    const idx = lectures.findIndex(l => l.id === lectureId);
    if (idx < 0) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= lectures.length) return;

    try {
      await this.courseService.swapLectureSortOrder(
        lectures[idx].id, lectures[idx].sort_order,
        lectures[targetIdx].id, lectures[targetIdx].sort_order,
      );
      await this.courseService.loadCourseDetail(courseId);
      this.#toast.success('Lecture moved');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to reorder lectures'));
    }
  }

  // --- Module CRUD handlers ---

  onAddModule(lectureId: string) {
    const cid = this.#route.snapshot.paramMap.get('courseId');
    this.#router.navigate(['/courses', cid, 'modules', 'new'], { queryParams: { lectureId } });
  }

  onEditModule(moduleId: string) {
    const cid = this.#route.snapshot.paramMap.get('courseId');
    this.#router.navigate(['/courses', cid, 'modules', moduleId, 'edit']);
  }

  async onDeleteModule(moduleId: string) {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;

    try {
      await this.courseService.deleteModule(moduleId);
      await this.courseService.loadCourseDetail(courseId);
      this.#toast.success('Module deleted');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to delete module'));
    }
  }

  async onMoveModule(moduleId: string, lectureId: string, direction: 'up' | 'down') {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    const detail = this.courseService.courseDetail();
    if (!courseId || !detail) return;

    const lecture = detail.lectures.find(l => l.id === lectureId);
    if (!lecture) return;

    const modules = lecture.modules;
    const idx = modules.findIndex(m => m.id === moduleId);
    if (idx < 0) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;

    try {
      await this.courseService.swapModuleSortOrder(
        modules[idx].id, modules[idx].sort_order,
        modules[targetIdx].id, modules[targetIdx].sort_order,
      );
      await this.courseService.loadCourseDetail(courseId);
      this.#toast.success('Module moved');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to reorder modules'));
    }
  }

  async onDelete() {
    const courseId = this.#route.snapshot.paramMap.get('courseId');
    if (!courseId) return;

    this.deleting.set(true);
    try {
      await this.courseService.deleteCourse(courseId);
      this.#router.navigate(['/courses']);
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to delete course'));
      this.confirmingDelete.set(false);
    } finally {
      this.deleting.set(false);
    }
  }
}
