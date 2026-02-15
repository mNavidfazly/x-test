import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  LucideAngularModule, UserPlus, Search, Loader2,
  Check, X, ChevronDown, ChevronUp, Mail, AlertTriangle,
  Clock, Building2,
} from 'lucide-angular';
import { AccessRequestService } from '../../../core/services/access-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccessRequestForBoard } from '../../../core/models/access-request.model';
import { formatDate } from '../../../core/utils/date.utils';
import { extractErrorMessage } from '../../../core/utils/error.utils';
import { isToastedByInterceptor } from '../../../core/interceptors/http-error.interceptor';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-access-request-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
  host: { class: 'block page-enter' },
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="page-title flex items-center gap-2">
          <lucide-icon [img]="icons.UserPlus" [size]="24"></lucide-icon>
          Access Requests
          <app-status-badge variant="primary">{{ service.requests().length }}</app-status-badge>
        </h1>
      </div>

      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3 mb-6">
        <div class="relative">
          <lucide-icon [img]="icons.Search" [size]="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
          <input
            type="text"
            placeholder="Search by name, email, or domain..."
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
            class="search-input w-72"
          />
        </div>
        <select
          class="select-field"
          [value]="statusFilter()"
          (change)="statusFilter.set($any($event.target).value)"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        @if (searchTerm() || statusFilter() !== 'all') {
          <button
            type="button"
            (click)="clearFilters()"
            class="btn-link"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <app-stat-card label="Total Requests" [value]="totalCount()" />
        <app-stat-card label="Pending" [value]="pendingCount()" color="text-amber-600" />
        <app-stat-card label="Approved" [value]="approvedCount()" color="text-emerald-600" />
        <app-stat-card label="Rejected" [value]="rejectedCount()" color="text-rose-600" />
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <app-loading-spinner message="Loading access requests..." />
      } @else if (service.error()) {
        <div class="mb-4"><app-error-alert [message]="service.error()!" /></div>
      } @else if (filteredRequests().length === 0) {
        <app-empty-state [icon]="icons.UserPlus" message="No access requests found." />
      } @else {
        <!-- Requests table -->
        <div class="table-container">
          <table class="w-full text-sm">
            <thead>
              <tr class="table-header">
                <th class="th">Name / Email</th>
                <th class="th">Domain</th>
                @if (isPlatformAdmin()) {
                  <th class="th">Tenant</th>
                }
                <th class="th">Status</th>
                <th class="th">Requested</th>
                <th class="th"></th>
              </tr>
            </thead>
            <tbody>
              @for (req of filteredRequests(); track req.id) {
                <tr
                  class="table-row cursor-pointer"
                  (click)="onExpandRequest(req)"
                >
                  <td class="table-cell">
                    <div class="text-slate-700 font-medium">{{ req.full_name ?? '\u2014' }}</div>
                    <div class="text-xs text-slate-500">{{ req.email }}</div>
                  </td>
                  <td class="table-cell">{{ req.domain ?? '\u2014' }}</td>
                  @if (isPlatformAdmin()) {
                    <td class="table-cell">
                      @if (req.tenant_name) {
                        {{ req.tenant_name }}
                      } @else {
                        <app-status-badge variant="warning">Unknown domain</app-status-badge>
                      }
                    </td>
                  }
                  <td class="table-cell">
                    @switch (req.status) {
                      @case ('pending') {
                        <app-status-badge variant="warning">Pending</app-status-badge>
                      }
                      @case ('approved') {
                        <app-status-badge variant="success">Approved</app-status-badge>
                      }
                      @case ('rejected') {
                        <app-status-badge variant="error">Rejected</app-status-badge>
                      }
                    }
                  </td>
                  <td class="table-cell text-slate-500 text-xs">{{ formatDate(req.created_at) }}</td>
                  <td class="table-cell text-right">
                    @if (expandedRequestId() === req.id) {
                      <lucide-icon [img]="icons.ChevronUp" [size]="16" class="text-slate-400"></lucide-icon>
                    } @else {
                      <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
                    }
                  </td>
                </tr>

                <!-- Expanded row -->
                @if (expandedRequestId() === req.id) {
                  <tr>
                    <td [attr.colspan]="isPlatformAdmin() ? 6 : 5" class="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
                      <div class="max-w-xl">
                        <!-- Request details -->
                        <div class="mb-4 text-sm space-y-1">
                          <div class="text-slate-700"><span class="font-semibold text-slate-500">Name:</span> {{ req.full_name ?? '\u2014' }}</div>
                          <div class="text-slate-700"><span class="font-semibold text-slate-500">Email:</span> {{ req.email }}</div>
                          <div class="text-slate-700"><span class="font-semibold text-slate-500">Domain:</span> {{ req.domain ?? '\u2014' }}</div>
                          @if (isPlatformAdmin()) {
                            <div class="text-slate-700">
                              <span class="font-semibold text-slate-500">Tenant:</span>
                              @if (req.tenant_name) {
                                {{ req.tenant_name }}
                              } @else {
                                <span class="text-amber-600">Unknown domain — must assign tenant before approving</span>
                              }
                            </div>
                          }
                          <div class="text-slate-700"><span class="font-semibold text-slate-500">Requested:</span> {{ req.created_at }}</div>
                        </div>

                        @if (req.status === 'pending') {
                          <!-- Review notes (editable) -->
                          <div class="mb-4">
                            <label class="section-label block mb-1">Review Notes</label>
                            <textarea
                              [value]="reviewNotes()"
                              (input)="reviewNotes.set($any($event.target).value)"
                              rows="2"
                              class="input-field"
                              placeholder="Optional notes about this decision..."
                            ></textarea>
                          </div>

                          <!-- Tenant picker for PA + unknown domain -->
                          @if (isPlatformAdmin() && !req.tenant_id) {
                            <div class="mb-4">
                              <label class="section-label block mb-1">
                                <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="inline text-amber-500"></lucide-icon>
                                Assign Tenant (required for approval)
                              </label>
                              <select
                                class="select-field w-full"
                                [value]="selectedTenantId()"
                                (change)="selectedTenantId.set($any($event.target).value)"
                              >
                                <option value="">Select a tenant...</option>
                                @for (t of availableTenants(); track t.id) {
                                  <option [value]="t.id">{{ t.name }}</option>
                                }
                              </select>
                            </div>
                          }

                          <!-- Action buttons -->
                          <div class="flex items-center gap-3">
                            <button
                              type="button"
                              (click)="onApprove(req)"
                              [disabled]="reviewing() || (isPlatformAdmin() && !req.tenant_id && !selectedTenantId())"
                              class="btn-primary"
                            >
                              @if (reviewing()) {
                                <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
                              } @else {
                                <lucide-icon [img]="icons.Check" [size]="14"></lucide-icon>
                              }
                              Approve & Invite
                            </button>
                            <button
                              type="button"
                              (click)="onReject(req)"
                              [disabled]="reviewing()"
                              class="btn-danger"
                            >
                              <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
                              Reject
                            </button>
                          </div>
                        } @else {
                          <!-- Already reviewed — read-only info -->
                          <div class="mb-2 text-sm space-y-1">
                            <div class="text-slate-700">
                              <span class="font-semibold text-slate-500">Reviewed by:</span>
                              {{ req.reviewer_name ?? 'Unknown' }}
                            </div>
                            <div class="text-slate-700">
                              <span class="font-semibold text-slate-500">Reviewed at:</span>
                              {{ req.reviewed_at ? formatDate(req.reviewed_at) : '\u2014' }}
                            </div>
                            @if (req.review_notes) {
                              <div class="text-slate-700">
                                <span class="font-semibold text-slate-500">Notes:</span>
                                {{ req.review_notes }}
                              </div>
                            }
                          </div>
                        }

                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AccessRequestPageComponent implements OnInit {
  readonly service = inject(AccessRequestService);
  readonly #auth = inject(AuthService);
  readonly #tenantService = inject(TenantManagementService);
  readonly #toast = inject(ToastService);

  readonly icons = {
    UserPlus, Search, Loader2, Check, X,
    ChevronDown, ChevronUp, Mail, AlertTriangle,
    Clock, Building2,
  };

  // Filter
  readonly searchTerm = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  // Expanded row
  readonly expandedRequestId = signal<string | null>(null);

  // Review
  readonly reviewNotes = signal('');
  readonly reviewing = signal(false);

  // Tenant picker (PA only, for unknown-domain requests)
  readonly selectedTenantId = signal('');
  readonly availableTenants = signal<{ id: string; name: string }[]>([]);

  // Computed
  readonly isPlatformAdmin = computed(() =>
    this.#auth.currentUser()?.claims.is_platform_admin === true,
  );

  readonly filteredRequests = computed(() => {
    let requests = this.service.requests();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();

    if (search) {
      requests = requests.filter(r =>
        (r.full_name ?? '').toLowerCase().includes(search) ||
        r.email.toLowerCase().includes(search) ||
        (r.domain ?? '').toLowerCase().includes(search),
      );
    }

    if (status !== 'all') {
      requests = requests.filter(r => r.status === status);
    }

    return requests;
  });

  readonly totalCount = computed(() => this.filteredRequests().length);
  readonly pendingCount = computed(() => this.filteredRequests().filter(r => r.status === 'pending').length);
  readonly approvedCount = computed(() => this.filteredRequests().filter(r => r.status === 'approved').length);
  readonly rejectedCount = computed(() => this.filteredRequests().filter(r => r.status === 'rejected').length);

  ngOnInit() {
    this.service.loadRequests();
    if (this.isPlatformAdmin()) {
      this.loadAvailableTenants();
    }
  }

  readonly formatDate = formatDate;

  clearFilters() {
    this.searchTerm.set('');
    this.statusFilter.set('all');
  }

  onExpandRequest(req: AccessRequestForBoard) {
    if (this.expandedRequestId() === req.id) {
      this.expandedRequestId.set(null);
      return;
    }
    this.expandedRequestId.set(req.id);
    this.reviewNotes.set(req.review_notes ?? '');
    this.selectedTenantId.set('');
  }

  async onApprove(req: AccessRequestForBoard) {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return;

    const tenantId = req.tenant_id ?? this.selectedTenantId();
    if (!tenantId) {
      this.#toast.error('Please select a tenant before approving');
      return;
    }

    this.reviewing.set(true);

    try {
      await this.service.approveAndInvite(req.id, req.email, tenantId, userId);
      this.#toast.success('Request approved and invitation sent');
      this.expandedRequestId.set(null);
      await this.service.loadRequests();
    } catch (err) {
      if (!isToastedByInterceptor(err)) {
        this.#toast.error(extractErrorMessage(err, 'Failed to approve request'));
      }
    } finally {
      this.reviewing.set(false);
    }
  }

  async onReject(req: AccessRequestForBoard) {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return;

    this.reviewing.set(true);

    try {
      await this.service.reviewRequest(
        req.id,
        { status: 'rejected', review_notes: this.reviewNotes().trim() || undefined },
        userId,
      );
      this.#toast.success('Request rejected');
      this.expandedRequestId.set(null);
      await this.service.loadRequests();
    } catch (err) {
      this.#toast.error(extractErrorMessage(err, 'Failed to reject request'));
    } finally {
      this.reviewing.set(false);
    }
  }

  private async loadAvailableTenants() {
    try {
      const tenants = await this.#tenantService.loadAvailableTenantsList();
      this.availableTenants.set(tenants);
    } catch {
      // Non-critical
    }
  }
}
