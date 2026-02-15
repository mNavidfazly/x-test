import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule, BarChart3, Search, Mail, Loader2,
  Users, Check, X, AlertTriangle, Filter, ChevronLeft, ChevronRight,
} from 'lucide-angular';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { DashboardUserProgress } from '../../../core/models/course.model';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { isToastedByInterceptor } from '../../../core/interceptors/http-error.interceptor';
import { debouncedSignal } from '../../../core/utils/debounce.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';

@Component({
  selector: 'app-progress-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, CustomSelectComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.BarChart3" [size]="24"></lucide-icon>
          Progress Dashboard
        </h1>
        @if (selectedUserIds().size > 0) {
          <button
            type="button"
            (click)="reminderMode.set(!reminderMode())"
            class="btn-primary"
          >
            <lucide-icon [img]="icons.Mail" [size]="16"></lucide-icon>
            Send Reminder ({{ selectedUserIds().size }})
          </button>
        }
      </div>

      <!-- Reminder panel -->
      @if (reminderMode()) {
        <div class="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-teal-800">Send Reminder to {{ selectedUserIds().size }} user(s)</h3>
            <button type="button" (click)="reminderMode.set(false)" class="text-teal-600 hover:text-teal-800">
              <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
            </button>
          </div>
          <textarea
            class="w-full rounded-lg border border-teal-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 mb-3"
            rows="3"
            [value]="reminderMessage()"
            (input)="reminderMessage.set($any($event.target).value)"
            placeholder="Custom reminder message..."
          ></textarea>
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="onSendReminders()"
              [disabled]="reminderSending()"
              class="btn-primary"
            >
              @if (reminderSending()) {
                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
              }
              Send
            </button>
            <button type="button" (click)="reminderMode.set(false)" class="btn-ghost">Cancel</button>
          </div>
        </div>
      }

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by name or email..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="search-input"
          />
        </div>
        <app-custom-select
          [options]="courseFilterOptions()"
          [value]="selectedCourseId() ?? ''"
          (valueChange)="selectedCourseId.set($event || null)"
        />
        <div class="flex items-center gap-1 text-sm text-slate-600">
          <lucide-icon [img]="icons.Filter" [size]="14" class="text-slate-400"></lucide-icon>
          <input
            type="number"
            min="0"
            max="100"
            [value]="progressMin()"
            (input)="progressMin.set(+$any($event.target).value)"
            class="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm text-center"
          />
          <span>–</span>
          <input
            type="number"
            min="0"
            max="100"
            [value]="progressMax()"
            (input)="progressMax.set(+$any($event.target).value)"
            class="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm text-center"
          />
          <span>%</span>
        </div>
        @if (searchTerm() || selectedCourseId() || progressMin() > 0 || progressMax() < 100) {
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total Users" [value]="totalUsers()" />
        <app-stat-card label="Avg Progress" [value]="avgProgress() + '%'" color="text-teal-600" />
        <app-stat-card label="Completed" [value]="completedCount()" color="text-emerald-600" />
        <app-stat-card label="At Risk" [value]="atRiskCount()" color="text-rose-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (progressService.loading()) {
        <app-loading-spinner message="Loading progress data..." />
      } @else if (progressService.error()) {
        <app-error-alert [message]="progressService.error()!" />
      } @else if (filteredUsers().length === 0) {
        <app-empty-state [icon]="icons.Users" message="No users match the current filters." />
      } @else {
        <!-- User table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    [checked]="allSelected()"
                    (change)="toggleSelectAll()"
                    class="checkbox-field"
                  />
                </th>
                <th class="th">Email</th>
                <th class="th">Name</th>
                @if (showTenantColumn()) {
                  <th class="th">Tenant</th>
                }
                <th class="th">Courses</th>
                <th class="th text-right w-24">Overall</th>
                <th class="th text-right w-32">Last Active</th>
              </tr>
            </thead>
            <tbody>
              @for (user of paginatedUsers(); track user.user_id) {
                <tr class="table-row">
                  <td class="table-cell">
                    <input
                      type="checkbox"
                      [checked]="selectedUserIds().has(user.user_id)"
                      (change)="toggleUser(user.user_id)"
                      class="checkbox-field"
                    />
                  </td>
                  <td class="table-cell text-slate-700 truncate max-w-[200px]">{{ user.email }}</td>
                  <td class="table-cell truncate max-w-[150px]">{{ user.full_name ?? '—' }}</td>
                  @if (showTenantColumn()) {
                    <td class="table-cell text-slate-500 truncate max-w-[120px]">{{ user.tenant_name ?? '—' }}</td>
                  }
                  <td class="table-cell">
                    <div class="flex flex-col gap-1">
                      @for (course of user.courses; track course.course_id) {
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-slate-500 truncate max-w-[120px]" [title]="course.course_title">{{ course.course_title }}</span>
                          <div class="progress-track w-16 h-1.5 shrink-0">
                            <div
                              class="progress-fill"
                              [style.width.%]="course.percent"
                            ></div>
                          </div>
                          <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{{ course.completed }}/{{ course.total }}</span>
                        </div>
                      }
                    </div>
                  </td>
                  <td class="table-cell text-right">
                    <span
                      class="text-sm font-semibold tabular-nums"
                      [class]="user.overallPercent === 100 ? 'text-emerald-600' : user.overallPercent < 25 ? 'text-rose-600' : 'text-teal-600'"
                    >
                      {{ user.overallPercent }}%
                    </span>
                  </td>
                  <td class="table-cell text-right text-xs text-slate-500">
                    {{ formatLastActive(user.lastActive) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <span class="text-sm text-slate-600">
                Showing {{ pageStart() }}–{{ pageEnd() }} of {{ filteredUsers().length }}
              </span>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  (click)="currentPage.set(currentPage() - 1)"
                  [disabled]="currentPage() === 1"
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <lucide-icon [img]="icons.ChevronLeft" [size]="14"></lucide-icon>
                  Previous
                </button>
                <span class="text-sm text-slate-500 tabular-nums">{{ currentPage() }} / {{ totalPages() }}</span>
                <button
                  type="button"
                  (click)="currentPage.set(currentPage() + 1)"
                  [disabled]="currentPage() === totalPages()"
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Next
                  <lucide-icon [img]="icons.ChevronRight" [size]="14"></lucide-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ProgressDashboardPageComponent implements OnInit {
  readonly progressService = inject(ProgressService);
  #auth = inject(AuthService);
  readonly #toast = inject(ToastService);

  readonly icons = { BarChart3, Search, Mail, Loader2, Users, Check, X, AlertTriangle, Filter, ChevronLeft, ChevronRight };

  readonly courseFilterOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All Courses' },
    ...this.progressService.courses().map(c => ({ value: c.id, label: c.title })),
  ]);

  // Filters
  readonly searchTerm = signal('');
  readonly debouncedSearch = debouncedSignal(this.searchTerm, 300);
  readonly selectedCourseId = signal<string | null>(null);
  readonly progressMin = signal(0);
  readonly progressMax = signal(100);

  // Pagination
  readonly currentPage = signal(1);
  readonly pageSize = 50;

  // Bulk reminder
  readonly selectedUserIds = signal<Set<string>>(new Set());
  readonly reminderMode = signal(false);
  readonly reminderMessage = signal('You have incomplete courses. Continue learning to stay on track!');
  readonly reminderSending = signal(false);

  // Role checks
  readonly showTenantColumn = computed(() => {
    const claims = this.#auth.currentUser()?.claims;
    return !!(claims?.is_platform_admin || (claims?.csm_tenant_ids && claims.csm_tenant_ids.length > 0));
  });

  // Filtered users
  readonly filteredUsers = computed(() => {
    let users = this.progressService.users();
    const search = this.debouncedSearch().toLowerCase();
    const courseId = this.selectedCourseId();
    const min = this.progressMin();
    const max = this.progressMax();

    if (search) {
      users = users.filter(u =>
        u.email.toLowerCase().includes(search) ||
        (u.full_name && u.full_name.toLowerCase().includes(search)),
      );
    }

    if (courseId) {
      users = users.filter(u => u.courses.some(c => c.course_id === courseId));
    }

    if (min > 0 || max < 100) {
      users = users.filter(u => u.overallPercent >= min && u.overallPercent <= max);
    }

    return users;
  });

  // Summary stats
  readonly totalUsers = computed(() => this.filteredUsers().length);

  readonly avgProgress = computed(() => {
    const users = this.filteredUsers();
    if (users.length === 0) return 0;
    const sum = users.reduce((acc, u) => acc + u.overallPercent, 0);
    return Math.round(sum / users.length);
  });

  readonly completedCount = computed(() =>
    this.filteredUsers().filter(u => u.overallPercent === 100).length,
  );

  readonly atRiskCount = computed(() =>
    this.filteredUsers().filter(u => u.overallPercent < 25 && u.overallPercent < 100).length,
  );

  // Pagination computeds
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)));
  readonly paginatedUsers = computed(() => {
    const users = this.filteredUsers();
    const start = (this.currentPage() - 1) * this.pageSize;
    return users.slice(start, start + this.pageSize);
  });
  readonly pageStart = computed(() => this.filteredUsers().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1);
  readonly pageEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredUsers().length));

  // Reset page to 1 whenever filters change
  readonly #pageResetEffect = effect(() => {
    this.filteredUsers(); // track dependency
    untracked(() => this.currentPage.set(1));
  });

  readonly allSelected = computed(() => {
    const filtered = this.filteredUsers();
    const selected = this.selectedUserIds();
    return filtered.length > 0 && filtered.every(u => selected.has(u.user_id));
  });

  ngOnInit() {
    this.progressService.loadDashboardData();
  }

  toggleUser(userId: string) {
    const current = new Set(this.selectedUserIds());
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    this.selectedUserIds.set(current);
  }

  toggleSelectAll() {
    const filtered = this.filteredUsers();
    if (this.allSelected()) {
      this.selectedUserIds.set(new Set());
    } else {
      this.selectedUserIds.set(new Set(filtered.map(u => u.user_id)));
    }
  }

  clearFilters() {
    this.searchTerm.set('');
    this.selectedCourseId.set(null);
    this.progressMin.set(0);
    this.progressMax.set(100);
  }

  async onSendReminders() {
    this.reminderSending.set(true);

    try {
      const result = await firstValueFrom(
        this.progressService.sendReminders({
          user_ids: [...this.selectedUserIds()],
          course_id: this.selectedCourseId(),
          message: this.reminderMessage(),
        }),
      );
      this.#toast.success(`Reminders sent: ${result.sent} delivered, ${result.failed} failed`);
      this.selectedUserIds.set(new Set());
    } catch (err) {
      if (!isToastedByInterceptor(err)) {
        this.#toast.error(extractErrorMessage(err, 'Failed to send reminders'));
      }
    } finally {
      this.reminderSending.set(false);
    }
  }

  formatLastActive(date: string | null): string {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }
}
