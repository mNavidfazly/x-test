import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { extractErrorMessage } from '../utils/error.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';
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
      // Single RPC replaces star-select with embed. Permission gating
      // (PA all, TA own tenant) enforced server-side. See migration 00064.
      const { data, error } = await this.#supabase.client.rpc('get_user_management_data');
      if (error) throw error;

      type RpcRow = {
        user_id: string; email: string; full_name: string | null;
        avatar_url: string | null;
        is_tenant_admin: boolean; is_platform_admin: boolean;
        tenant_id: string; tenant_name: string | null;
        created_at: string; updated_at: string;
      };
      const rows = (data ?? []) as RpcRow[];

      const users: UserForBoard[] = rows.map(r => ({
        id: r.user_id,
        email: r.email,
        full_name: r.full_name,
        avatar_url: r.avatar_url,
        is_tenant_admin: r.is_tenant_admin,
        is_platform_admin: r.is_platform_admin,
        tenant_id: r.tenant_id,
        tenant_name: r.tenant_name ?? 'Unknown',
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

      await resolveAvatarUrls(this.#supabase.client, users);

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
