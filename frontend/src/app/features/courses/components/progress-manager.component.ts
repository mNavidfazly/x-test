import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { LucideAngularModule, BarChart3, ChevronDown, ChevronUp, Check, RotateCcw, Loader2 } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { ToastService } from '../../../core/services/toast.service';
import { LectureWithModules, UserProgressSummary } from '../../../core/models/course.model';

@Component({
  selector: 'app-progress-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div>
      <h3 class="section-label mb-4 flex items-center gap-2">
        <lucide-icon [img]="icons.BarChart3" [size]="14"></lucide-icon>
        User Progress ({{ users().length }} users)
      </h3>

      @if (loading()) {
        <div class="flex items-center gap-2 py-4">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="text-slate-400 animate-spin"></lucide-icon>
          <span class="text-sm text-slate-500">Loading progress data...</span>
        </div>
      } @else if (error()) {
        <div class="alert-error rounded-lg px-3 py-2 text-xs mb-4">
          {{ error() }}
        </div>
      } @else if (users().length === 0) {
        <div class="text-center py-6">
          <lucide-icon [img]="icons.BarChart3" [size]="32" class="text-slate-300 mx-auto mb-2"></lucide-icon>
          <p class="text-sm text-slate-500">No enrolled users to show progress for.</p>
        </div>
      } @else {
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          @for (user of users(); track user.user_id) {
            <!-- User row -->
            <div
              class="border-b border-slate-100 last:border-b-0"
            >
              <button
                type="button"
                (click)="toggleUser(user.user_id)"
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-700 truncate">{{ user.email }}</div>
                  <div class="text-xs text-slate-500">{{ user.full_name ?? '—' }}</div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  <div class="flex items-center gap-2">
                    <div class="progress-track w-24 h-1.5">
                      <div
                        class="progress-fill"
                        [style.width.%]="user.total > 0 ? (user.completed / user.total) * 100 : 0"
                      ></div>
                    </div>
                    <span class="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {{ user.completed }}/{{ user.total }}
                    </span>
                  </div>
                  <lucide-icon
                    [img]="expandedUserId() === user.user_id ? icons.ChevronUp : icons.ChevronDown"
                    [size]="14"
                    class="text-slate-400"
                  ></lucide-icon>
                </div>
              </button>

              <!-- Expanded module list -->
              @if (expandedUserId() === user.user_id) {
                <div class="bg-slate-50/50 border-t border-slate-100 px-4 py-3">
                  @for (lecture of lectures(); track lecture.id) {
                    <div class="mb-3 last:mb-0">
                      <div class="section-label text-slate-400 mb-1.5">
                        {{ lecture.title }}
                      </div>
                      @for (mod of lecture.modules; track mod.id) {
                        <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/60 transition-colors">
                          <div class="flex items-center gap-2 min-w-0">
                            @if (user.modules[mod.id]?.status === 'completed') {
                              <span class="badge-success">
                                <lucide-icon [img]="icons.Check" [size]="10" class="mr-0.5"></lucide-icon>
                                Done
                              </span>
                            } @else if (user.modules[mod.id]?.status === 'in_progress') {
                              <span class="badge-warning">
                                In Progress
                              </span>
                            } @else {
                              <span class="badge-neutral">
                                Not Started
                              </span>
                            }
                            <span class="text-sm text-slate-700 truncate">{{ mod.title }}</span>
                          </div>
                          <div class="shrink-0 ml-2">
                            @if (user.modules[mod.id]?.status === 'completed') {
                              <button
                                type="button"
                                (click)="onReset(user, mod.id); $event.stopPropagation()"
                                [disabled]="actionInProgress()"
                                class="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded px-2 py-1 font-medium transition-colors duration-200 inline-flex items-center gap-1"
                              >
                                <lucide-icon [img]="icons.RotateCcw" [size]="10"></lucide-icon>
                                Reset
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="onMarkComplete(user, lecture.id, mod.id); $event.stopPropagation()"
                                [disabled]="actionInProgress()"
                                class="text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded px-2 py-1 font-medium transition-colors duration-200 inline-flex items-center gap-1"
                              >
                                <lucide-icon [img]="icons.Check" [size]="10"></lucide-icon>
                                Mark Complete
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ProgressManagerComponent implements OnInit {
  readonly courseId = input.required<string>();
  readonly lectures = input.required<LectureWithModules[]>();

  #courseService = inject(CourseService);
  #toast = inject(ToastService);

  readonly users = signal<UserProgressSummary[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly expandedUserId = signal<string | null>(null);
  readonly actionInProgress = signal(false);

  readonly icons = { BarChart3, ChevronDown, ChevronUp, Check, RotateCcw, Loader2 };

  ngOnInit() {
    this.#loadProgress();
  }

  toggleUser(userId: string) {
    this.expandedUserId.set(this.expandedUserId() === userId ? null : userId);
  }

  async onMarkComplete(user: UserProgressSummary, lectureId: string, moduleId: string) {
    this.actionInProgress.set(true);
    try {
      await this.#courseService.adminMarkModuleComplete(user.user_id, user.tenant_id, this.courseId(), lectureId, moduleId);
      this.#toast.success('Progress marked as complete');
      await this.#loadProgress();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to mark complete');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async onReset(user: UserProgressSummary, moduleId: string) {
    this.actionInProgress.set(true);
    try {
      await this.#courseService.adminResetModuleProgress(user.user_id, moduleId);
      this.#toast.success('Progress reset');
      await this.#loadProgress();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to reset progress');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async #loadProgress() {
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.#courseService.loadCourseProgressAdmin(this.courseId());
      this.users.set(data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      this.loading.set(false);
    }
  }
}
