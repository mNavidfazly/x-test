import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import {
  LucideAngularModule, Users, Search, Loader2,
  Plus, Save, X, ChevronDown, ChevronUp, Shield, ShieldCheck,
  Mail, UserPlus, Edit, ChevronLeft, ChevronRight,
} from 'lucide-angular';
import { UserManagementService } from '../../../core/services/user-management.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserForBoard } from '../../../core/models/user-management.model';
import { formatDate } from '../../../core/utils/date.utils';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { isToastedByInterceptor } from '../../../core/interceptors/http-error.interceptor';
import { debouncedSignal } from '../../../core/utils/debounce.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

type RoleFilter = 'all' | 'tenant_admin' | 'platform_admin' | 'regular';

@Component({
  selector: 'app-user-management-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.Users" [size]="24"></lucide-icon>
          User Management
          <app-status-badge variant="primary">{{ service.users().length }}</app-status-badge>
        </h1>
        <button
          type="button"
          (click)="onToggleInviteForm()"
          class="btn-primary"
        >
          <lucide-icon [img]="icons.UserPlus" [size]="16"></lucide-icon>
          Invite User
        </button>
      </div>

      <!-- Invite form -->
      @if (showInviteForm()) {
        <div class="card px-6 py-5 mb-6">
          <h2 class="text-sm font-semibold text-slate-900 mb-4">Invite New User</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="section-label mb-1">Email</label>
              <input
                type="email"
                [value]="inviteEmail()"
                (input)="inviteEmail.set($any($event.target).value)"
                class="input-field"
                placeholder="user@example.com"
              />
            </div>
            @if (isPlatformAdmin()) {
              <div>
                <label class="section-label mb-1">Tenant</label>
                <select
                  class="select-field w-full"
                  [value]="inviteTenantId()"
                  (change)="inviteTenantId.set($any($event.target).value)"
                >
                  <option value="">Select a tenant...</option>
                  @for (t of availableTenants(); track t.id) {
                    <option [value]="t.id">{{ t.name }}</option>
                  }
                </select>
              </div>
            }
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              (click)="onInviteUser()"
              [disabled]="inviting() || !inviteEmail().trim() || (isPlatformAdmin() && !inviteTenantId())"
              class="btn-primary"
            >
              @if (inviting()) {
                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
              } @else {
                <lucide-icon [img]="icons.Mail" [size]="14"></lucide-icon>
              }
              Send Invitation
            </button>
            <button
              type="button"
              (click)="cancelInvite()"
              class="btn-ghost"
            >Cancel</button>
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
        <select
          class="select-field"
          [value]="roleFilter()"
          (change)="roleFilter.set($any($event.target).value)"
        >
          <option value="all">All Roles</option>
          <option value="tenant_admin">Tenant Admins</option>
          <option value="platform_admin">Platform Admins</option>
          <option value="regular">Regular Users</option>
        </select>
        @if (searchTerm() || roleFilter() !== 'all') {
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
        <app-stat-card label="Tenant Admins" [value]="tenantAdminCount()" color="text-amber-600" />
        @if (isPlatformAdmin()) {
          <app-stat-card label="Platform Admins" [value]="platformAdminCount()" color="text-teal-600" />
        }
        <app-stat-card label="Regular Users" [value]="regularUserCount()" color="text-slate-500" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading users..." />
      } @else if (service.error()) {
        <div class="mb-4"><app-error-alert [message]="service.error()!" /></div>
      } @else if (filteredUsers().length === 0) {
        <app-empty-state [icon]="icons.Users" message="No users found." />
      } @else {
        <!-- Users table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th text-left">Name</th>
                <th class="th text-left">Email</th>
                <th class="th text-left">Roles</th>
                @if (isPlatformAdmin()) {
                  <th class="th text-left">Tenant</th>
                }
                <th class="th text-left">Joined</th>
                <th class="th text-left"></th>
              </tr>
            </thead>
            <tbody>
              @for (user of paginatedUsers(); track user.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandUser(user)"
                >
                  <td class="px-3 py-3 text-slate-700 font-medium">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                        {{ getInitials(user) }}
                      </div>
                      {{ user.full_name ?? '\u2014' }}
                    </div>
                  </td>
                  <td class="px-3 py-3 text-slate-600">{{ user.email }}</td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-1">
                      @if (user.is_platform_admin) {
                        <app-status-badge variant="primary">Platform Admin</app-status-badge>
                      }
                      @if (user.is_tenant_admin) {
                        <app-status-badge variant="warning">Tenant Admin</app-status-badge>
                      }
                      @if (!user.is_platform_admin && !user.is_tenant_admin) {
                        <app-status-badge variant="neutral">User</app-status-badge>
                      }
                    </div>
                  </td>
                  @if (isPlatformAdmin()) {
                    <td class="px-3 py-3 text-slate-600">{{ user.tenant_name }}</td>
                  }
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatDate(user.created_at) }}</td>
                  <td class="px-3 py-3 text-right">
                    @if (expandedUserId() === user.id) {
                      <lucide-icon [img]="icons.ChevronUp" [size]="16" class="text-slate-400"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
                    }
                  </td>
                </tr>

                <!-- Expanded row -->
                @if (expandedUserId() === user.id) {
                  <tr>
                    <td [attr.colspan]="isPlatformAdmin() ? 6 : 5" class="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                      <div class="max-w-xl">
                        <h3 class="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1">
                          <lucide-icon [img]="icons.Edit" [size]="14"></lucide-icon>
                          Edit User
                        </h3>

                        <!-- Name edit -->
                        <div class="mb-4">
                          <label class="section-label mb-1">Full Name</label>
                          <div class="flex items-center gap-2">
                            <input
                              type="text"
                              [value]="editName()"
                              (input)="editName.set($any($event.target).value)"
                              class="input-field flex-1"
                              placeholder="Full name"
                            />
                            <button
                              type="button"
                              (click)="onSaveProfile(user.id)"
                              [disabled]="saving()"
                              class="btn-primary"
                            >
                              @if (saving()) {
                                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                              } @else {
                                <lucide-icon [img]="icons.Save" [size]="14"></lucide-icon>
                              }
                              Save
                            </button>
                          </div>
                        </div>

                        <!-- Role toggles -->
                        <div class="mb-4">
                          <label class="section-label mb-2">Roles</label>
                          <div class="space-y-2">
                            <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                [checked]="user.is_tenant_admin"
                                [disabled]="togglingRole() || isSelf(user.id)"
                                (change)="onToggleTenantAdmin(user)"
                                class="checkbox-field"
                              />
                              <lucide-icon [img]="icons.Shield" [size]="14" class="text-amber-600"></lucide-icon>
                              Tenant Admin
                              @if (isSelf(user.id)) {
                                <span class="text-xs text-slate-400 italic">Cannot modify own role</span>
                              }
                            </label>

                            @if (isPlatformAdmin()) {
                              <div>
                                <label class="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    [checked]="user.is_platform_admin"
                                    [disabled]="togglingRole() || isSelf(user.id)"
                                    (change)="onTogglePlatformAdmin(user)"
                                    class="checkbox-field"
                                  />
                                  <lucide-icon [img]="icons.ShieldCheck" [size]="14" class="text-teal-600"></lucide-icon>
                                  Platform Admin
                                  @if (isSelf(user.id)) {
                                    <span class="text-xs text-slate-400 italic">Cannot modify own role</span>
                                  }
                                </label>
                              </div>
                            }
                          </div>
                        </div>

                        <!-- User info -->
                        <div class="text-xs text-slate-400 space-y-1">
                          <div>ID: {{ user.id }}</div>
                          <div>Tenant: {{ user.tenant_name }} ({{ user.tenant_id }})</div>
                          <div>Created: {{ user.created_at }}</div>
                          <div>Updated: {{ user.updated_at }}</div>
                        </div>

                      </div>
                    </td>
                  </tr>
                }
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
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <lucide-icon [img]="icons.ChevronLeft" [size]="14"></lucide-icon>
                  Previous
                </button>
                <span class="text-sm text-slate-500 tabular-nums">{{ currentPage() }} / {{ totalPages() }}</span>
                <button
                  type="button"
                  (click)="currentPage.set(currentPage() + 1)"
                  [disabled]="currentPage() === totalPages()"
                  class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
export class UserManagementPageComponent implements OnInit {
  readonly service = inject(UserManagementService);
  readonly #auth = inject(AuthService);
  readonly #tenantService = inject(TenantManagementService);
  readonly #toast = inject(ToastService);

  readonly icons = {
    Users, Search, Loader2, Plus, Save, X,
    ChevronDown, ChevronUp, Shield, ShieldCheck,
    Mail, UserPlus, Edit, ChevronLeft, ChevronRight,
  };

  // Filter
  readonly searchTerm = signal('');
  readonly roleFilter = signal<RoleFilter>('all');
  readonly #debouncedSearch = debouncedSignal(this.searchTerm, 300);

  // Invite form
  readonly showInviteForm = signal(false);
  readonly inviteEmail = signal('');
  readonly inviteTenantId = signal('');
  readonly inviting = signal(false);
  readonly availableTenants = signal<{ id: string; name: string }[]>([]);

  // Expanded row
  readonly expandedUserId = signal<string | null>(null);

  // Edit
  readonly editName = signal('');
  readonly saving = signal(false);

  // Role toggle
  readonly togglingRole = signal(false);

  // Computed
  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims.is_platform_admin === true,
  );

  // Pagination
  readonly currentPage = signal(1);
  readonly pageSize = 50;

  readonly filteredUsers = computed(() => {
    let users = this.service.users();
    const search = this.#debouncedSearch().toLowerCase();
    const role = this.roleFilter();

    if (search) {
      users = users.filter(u =>
        (u.full_name ?? '').toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search),
      );
    }

    if (role === 'tenant_admin') {
      users = users.filter(u => u.is_tenant_admin);
    } else if (role === 'platform_admin') {
      users = users.filter(u => u.is_platform_admin);
    } else if (role === 'regular') {
      users = users.filter(u => !u.is_tenant_admin && !u.is_platform_admin);
    }

    return users;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)));
  readonly paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });
  readonly pageStart = computed(() => this.filteredUsers().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1);
  readonly pageEnd = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredUsers().length));

  // Reset to page 1 when filters change
  readonly #pageResetEffect = effect(() => {
    this.filteredUsers();
    untracked(() => this.currentPage.set(1));
  });

  readonly totalUsers = computed(() => this.filteredUsers().length);
  readonly tenantAdminCount = computed(() => this.filteredUsers().filter(u => u.is_tenant_admin).length);
  readonly platformAdminCount = computed(() => this.filteredUsers().filter(u => u.is_platform_admin).length);
  readonly regularUserCount = computed(() => this.filteredUsers().filter(u => !u.is_tenant_admin && !u.is_platform_admin).length);

  ngOnInit() {
    this.service.loadUsers();
  }

  getInitials(user: UserForBoard): string {
    if (user.full_name) {
      return user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email[0].toUpperCase();
  }

  readonly formatDate = formatDate;

  isSelf(userId: string): boolean {
    return this.#auth.currentUser()?.id === userId;
  }

  clearFilters() {
    this.searchTerm.set('');
    this.roleFilter.set('all');
  }

  // --- Invite ---

  async onInviteUser() {
    this.inviting.set(true);

    try {
      const data: { email: string; tenant_id?: string } = {
        email: this.inviteEmail().trim(),
      };
      if (this.isPlatformAdmin() && this.inviteTenantId()) {
        data.tenant_id = this.inviteTenantId();
      }

      await this.service.inviteUser(data);
      this.#toast.success('Invitation sent successfully');
      this.inviteEmail.set('');
      this.inviteTenantId.set('');
      await this.service.loadUsers();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      this.inviting.set(false);
    }
  }

  onToggleInviteForm() {
    const show = !this.showInviteForm();
    this.showInviteForm.set(show);
    if (show && this.isPlatformAdmin() && this.availableTenants().length === 0) {
      this.loadAvailableTenants();
    }
  }

  cancelInvite() {
    this.showInviteForm.set(false);
    this.inviteEmail.set('');
    this.inviteTenantId.set('');
  }

  // --- Expand ---

  onExpandUser(user: UserForBoard) {
    if (this.expandedUserId() === user.id) {
      this.expandedUserId.set(null);
      return;
    }
    this.expandedUserId.set(user.id);
    this.editName.set(user.full_name ?? '');

    // Load tenants for invite form if PA and not loaded yet
    if (this.isPlatformAdmin() && this.availableTenants().length === 0) {
      this.loadAvailableTenants();
    }
  }

  // --- Profile edit ---

  async onSaveProfile(userId: string) {
    this.saving.set(true);

    try {
      await this.service.updateUserProfile(userId, { full_name: this.editName().trim() });
      this.#toast.success('Profile updated');
      this.expandedUserId.set(null);
      await this.service.loadUsers();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      this.saving.set(false);
    }
  }

  // --- Role toggles ---

  async onToggleTenantAdmin(user: UserForBoard) {
    this.togglingRole.set(true);

    try {
      await this.service.updateUserRoles(user.id, {
        is_tenant_admin: !user.is_tenant_admin,
      });
      this.#toast.success('Role updated');
      await this.service.loadUsers();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      this.togglingRole.set(false);
    }
  }

  async onTogglePlatformAdmin(user: UserForBoard) {
    this.togglingRole.set(true);

    try {
      await this.service.updateUserRoles(user.id, {
        is_platform_admin: !user.is_platform_admin,
      });
      this.#toast.success('Role updated');
      await this.service.loadUsers();
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      this.togglingRole.set(false);
    }
  }

  // --- Tenants for invite ---

  private async loadAvailableTenants() {
    try {
      const tenants = await this.#tenantService.loadAvailableTenantsList();
      this.availableTenants.set(tenants);
    } catch {
      // Non-critical — invite can still work without tenant list
    }
  }
}
