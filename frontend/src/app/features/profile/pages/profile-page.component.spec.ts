import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { FormsModule } from '@angular/forms';
import { ProfilePageComponent } from './profile-page.component';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockProfileService } from '../../../__mocks__/profile.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FullProfileData } from '../../../core/models/profile.model';

const FULL_PROFILE: FullProfileData = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  tenant_id: 't-1',
  tenant_name: 'Calypso',
  is_tenant_admin: false,
  is_platform_admin: false,
  created_at: '2025-01-15T00:00:00Z',
};

async function setup(options?: {
  fullProfile?: Partial<FullProfileData>;
  loadError?: string;
  claims?: Record<string, unknown>;
}) {
  const profileService = createMockProfileService({
    fullProfile: options?.fullProfile,
  });
  if (options?.loadError) {
    profileService.loadFullProfile.mockRejectedValue(new Error(options.loadError));
  } else {
    profileService.loadFullProfile.mockResolvedValue({ ...FULL_PROFILE, ...options?.fullProfile });
  }

  const authService = createMockAuthService({
    isAuthenticated: true,
    claims: options?.claims as any,
  });
  const toast = createMockToastService();

  const { fixture } = await render(ProfilePageComponent, {
    componentImports: [MockLucideIconComponent, FormsModule],
    providers: [
      { provide: ProfileService, useValue: profileService },
      { provide: AuthService, useValue: authService },
      { provide: ToastService, useValue: toast },
    ],
  });

  await new Promise(r => setTimeout(r));
  fixture.detectChanges();

  return { fixture, profileService, authService, toast };
}

describe('ProfilePageComponent', () => {
  it('should show loading state initially', async () => {
    const profileService = createMockProfileService();
    // Never resolving promise to keep loading state
    profileService.loadFullProfile.mockReturnValue(new Promise(() => {}));

    await render(ProfilePageComponent, {
      componentImports: [MockLucideIconComponent, FormsModule],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ToastService, useValue: createMockToastService() },
      ],
    });

    expect(screen.getByText('Loading profile...')).toBeTruthy();
  });

  it('should show error message on load failure', async () => {
    await setup({ loadError: 'Network error' });
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('should display profile data after loading', async () => {
    await setup();

    expect(screen.getByText('Test User')).toBeTruthy();
    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByText('Calypso')).toBeTruthy();
    expect(screen.getByText('Learner')).toBeTruthy();
  });

  it('should display avatar image when avatar_url exists', async () => {
    await setup();

    const img = screen.getByAltText('Profile photo') as HTMLImageElement;
    expect(img.src).toBe('https://example.com/avatar.jpg');
  });

  it('should show initials when no avatar', async () => {
    await setup({ fullProfile: { avatar_url: null, full_name: 'John Doe' } });

    expect(screen.getByText('JD')).toBeTruthy();
    expect(screen.queryByAltText('Profile photo')).toBeNull();
  });

  it('should show email initial when no name and no avatar', async () => {
    await setup({ fullProfile: { avatar_url: null, full_name: null, email: 'mary@test.com' } });

    expect(screen.getByText('M')).toBeTruthy();
  });

  it('should show "Not set" when full_name is null', async () => {
    await setup({ fullProfile: { full_name: null } });

    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('should show "Remove photo" button when avatar exists', async () => {
    await setup();

    expect(screen.getByText('Remove photo')).toBeTruthy();
  });

  it('should not show "Remove photo" when no avatar', async () => {
    await setup({ fullProfile: { avatar_url: null } });

    expect(screen.queryByText('Remove photo')).toBeNull();
  });

  describe('name editing', () => {
    it('should enter edit mode on pencil click', async () => {
      const { fixture } = await setup();

      fireEvent.click(screen.getByLabelText('Edit name'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('Test User');
    });

    it('should save name on confirm click', async () => {
      const { fixture, profileService, toast } = await setup();

      fireEvent.click(screen.getByLabelText('Edit name'));
      fixture.detectChanges();

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'New Name' } });
      fixture.detectChanges();

      fireEvent.click(screen.getByLabelText('Save name'));

      await new Promise(r => setTimeout(r));

      expect(profileService.updateName).toHaveBeenCalledWith('New Name');
      expect(toast.success).toHaveBeenCalledWith('Name updated');
    });

    it('should cancel editing on cancel click', async () => {
      await setup();

      fireEvent.click(screen.getByLabelText('Edit name'));
      expect(screen.getByRole('textbox')).toBeTruthy();

      fireEvent.click(screen.getByLabelText('Cancel editing'));
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('should show error toast on name update failure', async () => {
      const { fixture, profileService, toast } = await setup();
      profileService.updateName.mockRejectedValue(new Error('Update failed'));

      fireEvent.click(screen.getByLabelText('Edit name'));
      fixture.detectChanges();

      const input = screen.getByRole('textbox') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Fail Name' } });
      fixture.detectChanges();

      fireEvent.click(screen.getByLabelText('Save name'));

      await new Promise(r => setTimeout(r));

      expect(toast.error).toHaveBeenCalledWith('Update failed');
    });
  });

  describe('avatar upload', () => {
    it('should call uploadAvatar with selected file', async () => {
      const { profileService, toast } = await setup();

      const file = new File(['pixels'], 'avatar.png', { type: 'image/png' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(input, 'files', { value: [file] });
      fireEvent.change(input);

      await new Promise(r => setTimeout(r));

      expect(profileService.uploadAvatar).toHaveBeenCalledWith(file);
      expect(toast.success).toHaveBeenCalledWith('Avatar uploaded');
    });

    it('should show error toast on upload failure', async () => {
      const { profileService, toast } = await setup();
      profileService.uploadAvatar.mockRejectedValue(new Error('Only image files are allowed'));

      const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(input, 'files', { value: [file] });
      fireEvent.change(input);

      await new Promise(r => setTimeout(r));

      expect(toast.error).toHaveBeenCalledWith('Only image files are allowed');
    });
  });

  describe('avatar removal', () => {
    it('should call removeAvatar and show toast', async () => {
      const { profileService, toast } = await setup();

      fireEvent.click(screen.getByText('Remove photo'));

      await new Promise(r => setTimeout(r));

      expect(profileService.removeAvatar).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Avatar removed');
    });

    it('should show error toast on removal failure', async () => {
      const { profileService, toast } = await setup();
      profileService.removeAvatar.mockRejectedValue(new Error('Remove failed'));

      fireEvent.click(screen.getByText('Remove photo'));

      await new Promise(r => setTimeout(r));

      expect(toast.error).toHaveBeenCalledWith('Remove failed');
    });
  });

  describe('role badges', () => {
    it('should show Platform Admin and Tenant Admin badges', async () => {
      await setup({
        fullProfile: { is_platform_admin: true, is_tenant_admin: true },
      });

      expect(screen.getByText('Platform Admin')).toBeTruthy();
      expect(screen.getByText('Tenant Admin')).toBeTruthy();
      expect(screen.getByText('Learner')).toBeTruthy();
    });

    it('should show CSM badge when user has csm_tenant_ids', async () => {
      await setup({
        claims: { csm_tenant_ids: ['t-2'] },
      });

      expect(screen.getByText('CSM')).toBeTruthy();
    });

    it('should show Lecturer badge when user has lecturer_course_ids', async () => {
      await setup({
        claims: { lecturer_course_ids: ['c-1'] },
      });

      expect(screen.getByText('Lecturer')).toBeTruthy();
    });
  });
});
