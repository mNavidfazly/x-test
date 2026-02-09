import { signal } from '@angular/core';
import { vi } from 'vitest';
import { UserProfile } from '../core/models/profile.model';

export function createMockProfileService(options?: {
  profile?: UserProfile | null;
}) {
  const profile = signal<UserProfile | null>(options?.profile ?? null);

  return {
    profile: profile.asReadonly(),
    refreshProfile: vi.fn().mockResolvedValue(undefined),
    // Test helper
    _setProfile: profile.set.bind(profile),
  };
}

export type MockProfileService = ReturnType<typeof createMockProfileService>;
