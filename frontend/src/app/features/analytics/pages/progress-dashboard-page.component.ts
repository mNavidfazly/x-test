import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  LucideAngularModule, BarChart3, Search, Mail, Loader2,
  Users, Check, X, AlertTriangle, Filter,
} from 'lucide-angular';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardUserProgress } from '../../../core/models/course.model';

@Component({
  selector: 'app-progress-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.BarChart3" [size]="24"></lucide-icon>
          Progress Dashboard
        </h1>
        @if (selectedUserIds().size > 0) {
          <button
            type="button"
            (click)="reminderMode.set(!reminderMode())"
            class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 inline-flex items-center gap-2 text-sm"
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
              class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 text-sm inline-flex items-center gap-2"
            >
              @if (reminderSending()) {
                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
              }
              Send
            </button>
            <button type="button" (click)="reminderMode.set(false)" class="text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            @if (reminderResult()) {
              <span class="text-sm text-teal-700">
                Sent {{ reminderResult()!.sent }}, failed {{ reminderResult()!.failed }}
              </span>
            }
            @if (reminderError()) {
              <span class="text-sm text-rose-600">{{ reminderError() }}</span>
            }
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
            class="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          [value]="selectedCourseId() ?? ''"
          (change)="selectedCourseId.set($any($event.target).value || null)"
        >
          <option value="">All Courses</option>
          @for (course of progressService.courses(); track course.id) {
            <option [value]="course.id">{{ course.title }}</option>
          }
        </select>
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
            class="text-xs text-slate-500 hover:text-slate-700 underline"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total Users</div>
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalUsers() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Avg Progress</div>
          <div class="text-2xl font-bold text-teal-600 tabular-nums">{{ avgProgress() }}%</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Completed</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ completedCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">At Risk</div>
          <div class="text-2xl font-bold text-rose-600 tabular-nums">{{ atRiskCount() }}</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (progressService.loading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading progress data...</span>
        </div>
      } @else if (progressService.error()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ progressService.error() }}
        </div>
      } @else if (filteredUsers().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.Users" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No users match the current filters.</p>
        </div>
      } @else {
        <!-- User table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    [checked]="allSelected()"
                    (change)="toggleSelectAll()"
                    class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                </th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                @if (showTenantColumn()) {
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</th>
                }
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Courses</th>
                <th class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-24">Overall</th>
                <th class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 w-32">Last Active</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filteredUsers(); track user.user_id) {
                <tr class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-3">
                    <input
                      type="checkbox"
                      [checked]="selectedUserIds().has(user.user_id)"
                      (change)="toggleUser(user.user_id)"
                      class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                  <td class="px-3 py-3 text-slate-700 truncate max-w-[200px]">{{ user.email }}</td>
                  <td class="px-3 py-3 text-slate-600 truncate max-w-[150px]">{{ user.full_name ?? '—' }}</td>
                  @if (showTenantColumn()) {
                    <td class="px-3 py-3 text-slate-500 truncate max-w-[120px]">{{ user.tenant_name ?? '—' }}</td>
                  }
                  <td class="px-3 py-3">
                    <div class="flex flex-col gap-1">
                      @for (course of user.courses; track course.course_id) {
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-slate-500 truncate max-w-[120px]" [title]="course.course_title">{{ course.course_title }}</span>
                          <div class="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                            <div
                              class="h-full bg-teal-500 rounded-full"
                              [style.width.%]="course.percent"
                            ></div>
                          </div>
                          <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{{ course.completed }}/{{ course.total }}</span>
                        </div>
                      }
                    </div>
                  </td>
                  <td class="px-3 py-3 text-right">
                    <span
                      class="text-sm font-semibold tabular-nums"
                      [class]="user.overallPercent === 100 ? 'text-emerald-600' : user.overallPercent < 25 ? 'text-rose-600' : 'text-teal-600'"
                    >
                      {{ user.overallPercent }}%
                    </span>
                  </td>
                  <td class="px-3 py-3 text-right text-xs text-slate-500">
                    {{ formatLastActive(user.lastActive) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class ProgressDashboardPageComponent implements OnInit {
  readonly progressService = inject(ProgressService);
  #auth = inject(AuthService);

  readonly icons = { BarChart3, Search, Mail, Loader2, Users, Check, X, AlertTriangle, Filter };

  // Filters
  readonly searchTerm = signal('');
  readonly selectedCourseId = signal<string | null>(null);
  readonly progressMin = signal(0);
  readonly progressMax = signal(100);

  // Bulk reminder
  readonly selectedUserIds = signal<Set<string>>(new Set());
  readonly reminderMode = signal(false);
  readonly reminderMessage = signal('You have incomplete courses. Continue learning to stay on track!');
  readonly reminderSending = signal(false);
  readonly reminderResult = signal<{ sent: number; failed: number } | null>(null);
  readonly reminderError = signal('');

  // Role checks
  readonly showTenantColumn = computed(() => {
    const claims = this.#auth.currentUser()?.claims;
    return !!(claims?.is_platform_admin || (claims?.csm_tenant_ids && claims.csm_tenant_ids.length > 0));
  });

  // Filtered users
  readonly filteredUsers = computed(() => {
    let users = this.progressService.users();
    const search = this.searchTerm().toLowerCase();
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
    this.reminderError.set('');
    this.reminderResult.set(null);

    try {
      const result = await firstValueFrom(
        this.progressService.sendReminders({
          user_ids: [...this.selectedUserIds()],
          course_id: this.selectedCourseId(),
          message: this.reminderMessage(),
        }),
      );
      this.reminderResult.set(result);
      this.selectedUserIds.set(new Set());
    } catch (err) {
      this.reminderError.set(err instanceof Error ? err.message : 'Failed to send reminders');
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
