import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

async function flushAsync() {
  TestBed.flushEffects();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ProfileService', () => {
  it('should fetch profile when user authenticates', async () => {
    const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
    const supabase = createMockSupabaseService();
    supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
      data: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.jpg' },
      error: null,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: AuthService, useValue: auth },
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    const service = TestBed.inject(ProfileService);
    await flushAsync();

    expect(service.profile()).toEqual({
      full_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
    });
    expect(supabase.client.from).toHaveBeenCalledWith('profiles');
    expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('should have null profile when no user', async () => {
    const auth = createMockAuthService({ isAuthenticated: false });
    const supabase = createMockSupabaseService();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: AuthService, useValue: auth },
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    const service = TestBed.inject(ProfileService);
    await flushAsync();

    expect(service.profile()).toBeNull();
    expect(supabase.client.from).not.toHaveBeenCalled();
  });

  it('should clear profile on sign out', async () => {
    const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
    const supabase = createMockSupabaseService();
    supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
      data: { full_name: 'Test User', avatar_url: null },
      error: null,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: AuthService, useValue: auth },
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    const service = TestBed.inject(ProfileService);
    await flushAsync();
    expect(service.profile()).not.toBeNull();

    auth._setUser(null);
    await flushAsync();
    expect(service.profile()).toBeNull();
  });

  it('should handle profileless user (null response)', async () => {
    const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
    const supabase = createMockSupabaseService();
    supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: AuthService, useValue: auth },
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    const service = TestBed.inject(ProfileService);
    await flushAsync();

    expect(service.profile()).toBeNull();
    expect(supabase.client.from).toHaveBeenCalledWith('profiles');
  });
});
