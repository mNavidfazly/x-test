import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { extractErrorMessage } from '../utils/error.utils';
import {
  UserForBoard,
  InviteUserData,
  UpdateUserRolesData,
  UpdateUserProfileData,
} from '../models/user-management.model';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #api = inject(ApiService);

  #users = signal<UserForBoard[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly users = this.#users.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadUsers(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('profiles')
        .select('*, tenant:tenants(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const users: UserForBoard[] = (data ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_tenant_admin: row.is_tenant_admin,
        is_platform_admin: row.is_platform_admin,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant?.name ?? 'Unknown',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      this.#users.set(users);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load users'));
    } finally {
      this.#loading.set(false);
    }
  }

  async inviteUser(data: InviteUserData): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const response = await firstValueFrom(
      this.#api.post<{ message: string }>('/invite', data),
    );

    if (!response) throw new Error('Failed to send invitation');
  }

  async updateUserRoles(userId: string, data: UpdateUserRolesData): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const payload: Record<string, unknown> = {};
    if (data.is_tenant_admin !== undefined) payload['is_tenant_admin'] = data.is_tenant_admin;
    if (data.is_platform_admin !== undefined) payload['is_platform_admin'] = data.is_platform_admin;

    const { error } = await this.#supabase.client
      .from('profiles')
      .update(payload)
      .eq('id', userId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update user roles'));
  }

  async updateUserProfile(userId: string, data: UpdateUserProfileData): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('profiles')
      .update({ full_name: data.full_name })
      .eq('id', userId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update profile'));
  }
}
