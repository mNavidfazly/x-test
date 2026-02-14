import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { extractErrorMessage } from '../utils/error.utils';
import {
  AccessRequestForBoard,
  ReviewAccessRequestData,
} from '../models/access-request.model';

@Injectable({ providedIn: 'root' })
export class AccessRequestService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #api = inject(ApiService);

  #requests = signal<AccessRequestForBoard[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly requests = this.#requests.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadRequests(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('access_requests')
        .select(
          '*, tenant:tenants(name), reviewer:profiles!reviewed_by(full_name)',
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requests: AccessRequestForBoard[] = (data ?? []).map(
        (row: any) => ({
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          domain: row.domain,
          tenant_id: row.tenant_id,
          tenant_name: row.tenant?.name ?? null,
          status: row.status,
          reviewed_by: row.reviewed_by,
          reviewer_name: row.reviewer?.full_name ?? null,
          reviewed_at: row.reviewed_at,
          review_notes: row.review_notes,
          created_at: row.created_at,
        }),
      );

      this.#requests.set(requests);
    } catch (err) {
      this.#error.set(
        extractErrorMessage(err, 'Failed to load access requests'),
      );
    } finally {
      this.#loading.set(false);
    }
  }

  async reviewRequest(
    id: string,
    data: ReviewAccessRequestData,
    userId: string,
  ): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('access_requests')
      .update({
        status: data.status,
        review_notes: data.review_notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to review request'));
  }

  async approveAndInvite(
    id: string,
    email: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    await this.reviewRequest(id, { status: 'approved' }, userId);

    const response = await firstValueFrom(
      this.#api.post<{ message: string }>('/invite', {
        email,
        tenant_id: tenantId,
      }),
    );

    if (!response) throw new Error('Failed to send invitation');
  }
}
