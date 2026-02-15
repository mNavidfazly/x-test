import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Loader2, Trash2 } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { CourseFormComponent, CourseFormSaveEvent } from '../components/course-form.component';
import { TenantAssignmentComponent } from '../components/tenant-assignment.component';
import { CourseFormData, TenantSummary, EnrollmentType } from '../../../core/models/course.model';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { isStoragePath } from '../../../core/utils/storage.utils';

@Component({
  selector: 'app-course-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, CourseFormComponent, TenantAssignmentComponent],
  host: { class: 'block page-enter' },
  template: `
    <div class="max-w-2xl">
      <a routerLink="/courses" class="back-link mb-4">
        <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
        Back to courses
      </a>

      <h1 class="page-title mb-6">
        {{ isEditMode() ? 'Edit Course' : 'New Course' }}
      </h1>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
          Loading...
        </div>
      } @else if (errorMessage()) {
        <div class="alert-error rounded-lg">
          {{ errorMessage() }}
        </div>
      } @else {
        <app-course-form
          [initialData]="formData()"
          [isEditMode]="isEditMode()"
          [currentThumbnailSignedUrl]="currentThumbnailSignedUrl()"
          (save)="onSave($event)"
          (cancel)="onCancel()"
        />

        <!-- Tenant Assignment (edit mode + platform admin only) -->
        @if (isEditMode() && isPlatformAdmin()) {
          <div class="mt-8 pt-6 border-t border-slate-200">
            <app-tenant-assignment
              [tenants]="tenants()"
              [assignedTenantIds]="assignedTenantIds()"
              (assign)="onAssignTenant($event)"
              (unassign)="onUnassignTenant($event)"
            />
          </div>
        }

        <!-- Delete (edit mode + platform admin only) -->
        @if (isEditMode() && isPlatformAdmin()) {
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
                    [disabled]="saving()"
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
export class CourseFormPageComponent implements OnInit {
  #courseService = inject(CourseService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);
  #route = inject(ActivatedRoute);
  #router = inject(Router);

  readonly icons = { ArrowLeft, Loader2, Trash2 };

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly confirmingDelete = signal(false);

  readonly tenants = signal<TenantSummary[]>([]);
  readonly assignedTenantIds = signal<string[]>([]);
  readonly currentThumbnailSignedUrl = signal<string | null>(null);

  readonly courseId = computed(() => this.#route.snapshot.paramMap.get('courseId'));
  readonly isEditMode = computed(() => !!this.courseId());

  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims?.is_platform_admin ?? false,
  );

  readonly canEdit = computed(() => {
    const user = this.#auth.currentUser();
    if (!user) return false;
    if (user.claims.is_platform_admin) return true;
    const cid = this.courseId();
    return cid ? user.claims.lecturer_can_edit_course_ids.includes(cid) : false;
  });

  readonly formData = signal<CourseFormData>({
    title: '',
    description: null,
    thumbnail_url: null,
    enrollment_type: 'open' as EnrollmentType,
    password_hash: null,
    staleness_threshold_days: null,
  });

  async ngOnInit() {
    const cid = this.courseId();

    if (!cid) {
      // Create mode — only platform admin
      if (!this.isPlatformAdmin()) {
        this.#router.navigate(['/courses']);
        return;
      }
      return;
    }

    // Edit mode — check permission
    if (!this.canEdit()) {
      this.#router.navigate(['/courses']);
      return;
    }

    this.loading.set(true);
    try {
      // Load course detail for form pre-population
      await this.#courseService.loadCourseDetail(cid);
      const detail = this.#courseService.courseDetail();
      if (!detail) {
        this.errorMessage.set('Course not found');
        return;
      }

      // detail.thumbnail_url is already resolved by loadCourseDetail (signed URL if storage path)
      // We pass the resolved URL for preview, but keep the raw value for the form
      this.currentThumbnailSignedUrl.set(detail.thumbnail_url);

      this.formData.set({
        title: detail.title,
        description: detail.description,
        thumbnail_url: detail.thumbnail_url,
        enrollment_type: detail.enrollment_type,
        password_hash: null, // never expose existing hash
        staleness_threshold_days: null, // loaded from course detail would require extended select
      });

      // Load tenants + assignments (platform admin only)
      if (this.isPlatformAdmin()) {
        const [allTenants, assignments] = await Promise.all([
          this.#courseService.loadTenants(),
          this.#courseService.loadTenantAssignments(cid),
        ]);
        this.tenants.set(allTenants);
        this.assignedTenantIds.set(assignments.map(a => a.tenant_id));
      }
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load course');
    } finally {
      this.loading.set(false);
    }
  }

  async onSave(event: CourseFormSaveEvent) {
    this.saving.set(true);
    const { data, thumbnailFile } = event;

    try {
      const cid = this.courseId();
      if (cid) {
        // Edit mode
        if (thumbnailFile) {
          // Delete old thumbnail if it was a storage path
          const oldUrl = this.formData().thumbnail_url;
          await this.#courseService.deleteThumbnailIfStoragePath(oldUrl);
          // Upload new
          const storagePath = await this.#courseService.uploadThumbnail(cid, thumbnailFile);
          data.thumbnail_url = storagePath;
        }
        await this.#courseService.updateCourse(cid, data);
        this.#router.navigate(['/courses', cid]);
      } else {
        // Create mode: create course first, then upload thumbnail
        const { id } = await this.#courseService.createCourse(data);
        if (thumbnailFile) {
          const storagePath = await this.#courseService.uploadThumbnail(id, thumbnailFile);
          await this.#courseService.updateCourse(id, { ...data, thumbnail_url: storagePath });
        }
        this.#router.navigate(['/courses', id]);
      }
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to save course'));
    } finally {
      this.saving.set(false);
    }
  }

  onCancel() {
    const cid = this.courseId();
    if (cid) {
      this.#router.navigate(['/courses', cid]);
    } else {
      this.#router.navigate(['/courses']);
    }
  }

  async onDelete() {
    const cid = this.courseId();
    if (!cid) return;

    this.saving.set(true);
    try {
      await this.#courseService.deleteCourse(cid);
      this.#router.navigate(['/courses']);
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to delete course'));
    } finally {
      this.saving.set(false);
      this.confirmingDelete.set(false);
    }
  }

  async onAssignTenant(tenantId: string) {
    const cid = this.courseId();
    if (!cid) return;

    try {
      await this.#courseService.assignCourseToTenant(cid, tenantId);
      this.assignedTenantIds.update(ids => [...ids, tenantId]);
      this.#toast.success('Course assigned to tenant');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to assign tenant'));
    }
  }

  async onUnassignTenant(tenantId: string) {
    const cid = this.courseId();
    if (!cid) return;

    try {
      await this.#courseService.removeCourseFromTenant(cid, tenantId);
      this.assignedTenantIds.update(ids => ids.filter(id => id !== tenantId));
      this.#toast.success('Course removed from tenant');
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to remove tenant'));
    }
  }
}
