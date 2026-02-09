import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockProfileService } from '../../__mocks__/profile.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

async function renderHeader(options?: {
  email?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}) {
  const auth = createMockAuthService({
    isAuthenticated: true,
    email: options?.email ?? 'test@example.com',
  });
  const profile = createMockProfileService({
    profile: options?.fullName !== undefined || options?.avatarUrl !== undefined
      ? { full_name: options?.fullName ?? null, avatar_url: options?.avatarUrl ?? null }
      : null,
  });

  const menuToggleSpy = vi.fn();

  await render(HeaderComponent, {
    componentImports: [MockLucideIconComponent],
    componentOutputs: { menuToggle: { emit: menuToggleSpy } as any },
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ProfileService, useValue: profile },
    ],
  });

  return { auth, profile, menuToggleSpy };
}

describe('HeaderComponent', () => {
  it('should render hamburger button', async () => {
    await renderHeader();
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('should emit menuToggle when hamburger clicked', async () => {
    const { menuToggleSpy } = await renderHeader();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Toggle menu'));
    expect(menuToggleSpy).toHaveBeenCalled();
  });

  it('should show notification bell', async () => {
    await renderHeader();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('should show profile display name', async () => {
    await renderHeader({ fullName: 'John Doe' });
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('should fall back to email when no profile name', async () => {
    await renderHeader({ email: 'user@test.com' });
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });

  it('should show initials when no avatar', async () => {
    await renderHeader({ fullName: 'John Doe' });
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('should call auth.signOut on sign out', async () => {
    const { auth } = await renderHeader({ fullName: 'Test' });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    await user.click(screen.getByText('Sign out'));

    expect(auth.signOut).toHaveBeenCalled();
  });
});
