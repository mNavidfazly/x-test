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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-access-request-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
          <lucide-icon [img]="icons.UserPlus" [size]="24"></lucide-icon>
          Access Requests
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700">
            {{ service.requests().length }}
          </span>
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
            class="w-72 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
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
            class="text-xs text-slate-500 hover:text-slate-700 underline"
          >Clear filters</button>
        }
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Total Requests</div>
          <div class="text-2xl font-bold text-slate-900 tabular-nums">{{ totalCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Pending</div>
          <div class="text-2xl font-bold text-amber-600 tabular-nums">{{ pendingCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Approved</div>
          <div class="text-2xl font-bold text-emerald-600 tabular-nums">{{ approvedCount() }}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Rejected</div>
          <div class="text-2xl font-bold text-rose-600 tabular-nums">{{ rejectedCount() }}</div>
        </div>
      </div>

      <!-- Loading / Error / Empty -->
      @if (service.loading()) {
        <div class="flex items-center justify-center py-12">
          <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
          <span class="text-sm text-slate-500">Loading access requests...</span>
        </div>
      } @else if (service.error()) {
        <div class="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">
          {{ service.error() }}
        </div>
      } @else if (filteredRequests().length === 0) {
        <div class="text-center py-12">
          <lucide-icon [img]="icons.UserPlus" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
          <p class="text-sm text-slate-500">No access requests found.</p>
        </div>
      } @else {
        <!-- Requests table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name / Email</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Domain</th>
                @if (isPlatformAdmin()) {
                  <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant</th>
                }
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Requested</th>
                <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              @for (req of filteredRequests(); track req.id) {
                <tr
                  class="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  (click)="onExpandRequest(req)"
                >
                  <td class="px-3 py-3">
                    <div class="text-slate-700 font-medium">{{ req.full_name ?? '\u2014' }}</div>
                    <div class="text-xs text-slate-500">{{ req.email }}</div>
                  </td>
                  <td class="px-3 py-3 text-slate-600">{{ req.domain ?? '\u2014' }}</td>
                  @if (isPlatformAdmin()) {
                    <td class="px-3 py-3 text-slate-600">
                      @if (req.tenant_name) {
                        {{ req.tenant_name }}
                      } @else {
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                          Unknown domain
                        </span>
                      }
                    </td>
                  }
                  <td class="px-3 py-3">
                    @switch (req.status) {
                      @case ('pending') {
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700">
                          Pending
                        </span>
                      }
                      @case ('approved') {
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700">
                          Approved
                        </span>
                      }
                      @case ('rejected') {
                        <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700">
                          Rejected
                        </span>
                      }
                    }
                  </td>
                  <td class="px-3 py-3 text-slate-500 text-xs">{{ formatDate(req.created_at) }}</td>
                  <td class="px-3 py-3 text-right">
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
                            <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Review Notes</label>
                            <textarea
                              [value]="reviewNotes()"
                              (input)="reviewNotes.set($any($event.target).value)"
                              rows="2"
                              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
                              placeholder="Optional notes about this decision..."
                            ></textarea>
                          </div>

                          <!-- Tenant picker for PA + unknown domain -->
                          @if (isPlatformAdmin() && !req.tenant_id) {
                            <div class="mb-4">
                              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                                <lucide-icon [img]="icons.AlertTriangle" [size]="12" class="inline text-amber-500"></lucide-icon>
                                Assign Tenant (required for approval)
                              </label>
                              <select
                                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
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
                              class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
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
                              class="bg-rose-50 text-rose-600 border border-rose-200 rounded-lg px-4 py-2 font-semibold hover:bg-rose-100 disabled:opacity-50 active:scale-95 transition-all duration-200 text-sm inline-flex items-center gap-2"
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
