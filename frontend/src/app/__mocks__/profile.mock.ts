import { signal } from '@angular/core';
import { vi } from 'vitest';
import { UserProfile, FullProfileData } from '../core/models/profile.model';

export function createMockProfileService(options?: {
  profile?: UserProfile | null;
  fullProfile?: Partial<FullProfileData>;
}) {
  const profile = signal<UserProfile | null>(options?.profile ?? null);

  const defaultFullProfile: FullProfileData = {
    id: 'test-user-id',
    email: 'test@example.com',
    full_name: options?.profile?.full_name ?? null,
    avatar_url: options?.profile?.avatar_url ?? null,
    tenant_id: 'test-tenant-id',
    tenant_name: 'Test Org',
    is_tenant_admin: false,
    is_platform_admin: false,
    created_at: '2025-01-01T00:00:00Z',
    ...options?.fullProfile,
  };

  return {
    profile: profile.asReadonly(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    loadFullProfile: vi.fn().mockResolvedValue(defaultFullProfile),
    updateName: vi.fn().mockResolvedValue(undefined),
    uploadAvatar: vi.fn().mockResolvedValue('https://test.supabase.co/storage/v1/object/sign/avatars/test-user-id/avatar?token=abc'),
    removeAvatar: vi.fn().mockResolvedValue(undefined),
    // Test helper
    _setProfile: profile.set.bind(profile),
  };
}

export type MockProfileService = ReturnType<typeof createMockProfileService>;
