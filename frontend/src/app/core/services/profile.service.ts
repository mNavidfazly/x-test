import { Injectable, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { UserProfile, FullProfileData } from '../models/profile.model';
import { extractErrorMessage } from '../utils/error.utils';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #profile = signal<UserProfile | null>(null);

  readonly profile = this.#profile.asReadonly();

  constructor() {
    effect(() => {
      const user = this.#auth.currentUser();
      if (user) {
        this.#fetchProfile(user.id);
      } else {
        this.#profile.set(null);
      }
    });
  }

  async refreshProfile() {
    const user = this.#auth.currentUser();
    if (user) {
      await this.#fetchProfile(user.id);
    }
  }

  async loadFullProfile(): Promise<FullProfileData> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('id, email, full_name, avatar_url, tenant_id, is_tenant_admin, is_platform_admin, created_at, tenants!inner(name)')
      .eq('id', user.id)
      .single();

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load profile'));

    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url ? await this.#resolveAvatarUrl(data.avatar_url) : null,
      tenant_id: data.tenant_id,
      tenant_name: (data.tenants as any)?.name ?? '',
      is_tenant_admin: data.is_tenant_admin,
      is_platform_admin: data.is_platform_admin,
      created_at: data.created_at,
    };
  }

  async updateName(fullName: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('profiles')
      .update({ full_name: fullName.trim() || null })
      .eq('id', user.id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update name'));
    await this.refreshProfile();
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5 MB');

    const path = `${user.id}/avatar`;
    const { error: uploadErr } = await this.#supabase.client.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) throw new Error(`Failed to upload avatar: ${uploadErr.message}`);

    const { error: updateErr } = await this.#supabase.client
      .from('profiles')
      .update({ avatar_url: path })
      .eq('id', user.id);

    if (updateErr) throw new Error(extractErrorMessage(updateErr, 'Failed to save avatar'));

    await this.refreshProfile();
    return (await this.#resolveAvatarUrl(path)) ?? path;
  }

  async removeAvatar(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    // Remove file from storage (ignore error — file may already be gone)
    await this.#supabase.client.storage
      .from('avatars')
      .remove([`${user.id}/avatar`]);

    const { error } = await this.#supabase.client
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to remove avatar'));
    await this.refreshProfile();
  }

  async #resolveAvatarUrl(storagePath: string): Promise<string | null> {
    // Backward compat: if already a full URL, return as-is
    if (storagePath.startsWith('http')) return storagePath;

    const { data, error } = await this.#supabase.client.storage
      .from('avatars')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) return null;
    // Cache-buster to prevent stale images after re-upload
    return `${data.signedUrl}&v=${Date.now()}`;
  }

  async #fetchProfile(userId: string) {
    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile:', error.message);
    }

    if (data) {
      this.#profile.set({
        full_name: data.full_name,
        avatar_url: data.avatar_url ? await this.#resolveAvatarUrl(data.avatar_url) : null,
      });
    } else {
      this.#profile.set(data ?? null);
    }
  }
}
