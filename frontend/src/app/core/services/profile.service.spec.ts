import { describe, it, expect } from 'vitest';
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

  it('should resolve storage path to signed URL in fetchProfile', async () => {
    const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
    const supabase = createMockSupabaseService();
    supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
      data: { full_name: 'Test User', avatar_url: 'user-1/avatar' },
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

    expect(service.profile()?.avatar_url).toContain('token=abc');
    expect(supabase.client.storage.from).toHaveBeenCalledWith('avatars');
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

  describe('loadFullProfile', () => {
    it('should fetch full profile with tenant join', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      supabase._mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'user-1', email: 'test@test.com', full_name: 'Test User',
          avatar_url: null, tenant_id: 't-1', is_tenant_admin: false,
          is_platform_admin: true, created_at: '2025-01-01T00:00:00Z',
          tenants: { name: 'Test Org' },
        },
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

      const result = await service.loadFullProfile();
      expect(result.email).toBe('test@test.com');
      expect(result.tenant_name).toBe('Test Org');
      expect(result.is_platform_admin).toBe(true);
      expect(result.avatar_url).toBeNull();
    });

    it('should throw when not authenticated', async () => {
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

      await expect(service.loadFullProfile()).rejects.toThrow('Not authenticated');
    });

    it('should resolve avatar storage path to signed URL', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      supabase._mockQueryBuilder.single.mockResolvedValue({
        data: {
          id: 'user-1', email: 'test@test.com', full_name: 'Test',
          avatar_url: 'user-1/avatar', tenant_id: 't-1', is_tenant_admin: false,
          is_platform_admin: false, created_at: '2025-01-01T00:00:00Z',
          tenants: { name: 'Test' },
        },
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

      const result = await service.loadFullProfile();
      expect(result.avatar_url).toContain('token=abc');
    });
  });

  describe('updateName', () => {
    it('should update profile name and refresh', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { full_name: 'Updated', avatar_url: null },
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

      await service.updateName('New Name');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ full_name: 'New Name' });
    });

    it('should throw when not authenticated', async () => {
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

      await expect(service.updateName('Test')).rejects.toThrow('Not authenticated');
    });
  });

  describe('uploadAvatar', () => {
    it('should upload file and update profile', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { full_name: 'Test', avatar_url: 'user-1/avatar' },
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

      const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });
      const result = await service.uploadAvatar(file);

      const storageMock = supabase.client.storage.from('avatars');
      expect(supabase.client.storage.from).toHaveBeenCalledWith('avatars');
      expect(storageMock.upload).toHaveBeenCalledWith(
        'user-1/avatar', file, { upsert: true, contentType: 'image/png' },
      );
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ avatar_url: 'user-1/avatar' });
      expect(result).toContain('token=abc');
    });

    it('should reject non-image files', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

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

      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      await expect(service.uploadAvatar(file)).rejects.toThrow('Only image files are allowed');
    });

    it('should reject files over 5 MB', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

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

      const bigContent = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' });
      await expect(service.uploadAvatar(file)).rejects.toThrow('Image must be under 5 MB');
    });
  });

  describe('removeAvatar', () => {
    it('should remove from storage and clear avatar_url', async () => {
      const auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1' });
      const supabase = createMockSupabaseService();
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValue({
        data: { full_name: 'Test', avatar_url: null },
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

      await service.removeAvatar();

      const storageMock = supabase.client.storage.from('avatars');
      expect(storageMock.remove).toHaveBeenCalledWith(['user-1/avatar']);
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ avatar_url: null });
    });
  });
});
