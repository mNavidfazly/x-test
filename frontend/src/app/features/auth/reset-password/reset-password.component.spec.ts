import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, throwError, timer, switchMap } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { createMockApiService } from '../../../__mocks__/api.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ActivatedRoute } from '@angular/router';

describe('ResetPasswordComponent', () => {
  async function renderComponent(options?: {
    api?: ReturnType<typeof createMockApiService>;
    auth?: ReturnType<typeof createMockAuthService>;
    queryEmail?: string;
  }) {
    const api = options?.api ?? createMockApiService();
    const auth = options?.auth ?? createMockAuthService();

    await render(ResetPasswordComponent, {
      componentImports: [MockLucideIconComponent, FormsModule],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => key === 'email' ? (options?.queryEmail ?? null) : null,
              },
            },
          },
        },
      ],
    });

    return { api, auth, user: userEvent.setup() };
  }

  async function goToCodeStep(options?: {
    api?: ReturnType<typeof createMockApiService>;
    auth?: ReturnType<typeof createMockAuthService>;
    email?: string;
  }) {
    const api = options?.api ?? createMockApiService();
    const auth = options?.auth ?? createMockAuthService();
    api.post.mockReturnValue(of({ message: 'ok' }));

    const result = await renderComponent({ api, auth, queryEmail: options?.email ?? 'test@acme.com' });

    await result.user.click(screen.getByRole('button', { name: /send reset code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Reset code')).toBeTruthy();
    });

    return result;
  }

  describe('Step 1: Email', () => {
    it('should render email input and submit button', async () => {
      await renderComponent();
      expect(screen.getByLabelText('Email')).toBeTruthy();
      expect(screen.getByRole('button', { name: /send reset code/i })).toBeTruthy();
    });

    it('should pre-populate email from query param', async () => {
      await renderComponent({ queryEmail: 'pre@test.com' });
      const input = screen.getByLabelText('Email') as HTMLInputElement;
      expect(input.value).toBe('pre@test.com');
    });

    it('should show error when email is empty', async () => {
      const { user } = await renderComponent();
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter your email/i)).toBeTruthy();
      });
    });

    it('should call API and advance to code step on success', async () => {
      const api = createMockApiService();
      api.post.mockReturnValue(of({ message: 'ok' }));

      const { user } = await renderComponent({ api, queryEmail: 'test@acme.com' });
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Reset code')).toBeTruthy();
      });

      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', { email: 'test@acme.com' });
    });

    it('should show error on API failure', async () => {
      const api = createMockApiService();
      api.post.mockReturnValue(timer(0).pipe(switchMap(() => throwError(() => new Error('fail')))));

      const { user } = await renderComponent({ api, queryEmail: 'test@acme.com' });
      await user.click(screen.getByRole('button', { name: /send reset code/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeTruthy();
      });
    });
  });

  describe('Step 2: Code + New Password', () => {
    it('should show code, password, and confirm fields', async () => {
      await goToCodeStep();

      expect(screen.getByLabelText('Reset code')).toBeTruthy();
      expect(screen.getByLabelText('New password')).toBeTruthy();
      expect(screen.getByLabelText('Confirm password')).toBeTruthy();
      expect(screen.getByRole('button', { name: /set new password/i })).toBeTruthy();
    });

    it('should show email in description', async () => {
      await goToCodeStep({ email: 'user@corp.com' });
      expect(screen.getByText(/user@corp.com/)).toBeTruthy();
    });

    it('should validate code length', async () => {
      const { user } = await goToCodeStep();

      await user.type(screen.getByLabelText('Reset code'), '123');
      await user.type(screen.getByLabelText('New password'), 'newpass123');
      await user.type(screen.getByLabelText('Confirm password'), 'newpass123');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(screen.getByText(/6-digit code/i)).toBeTruthy();
      });
    });

    it('should validate password length', async () => {
      const { user } = await goToCodeStep();

      await user.type(screen.getByLabelText('Reset code'), '123456');
      await user.type(screen.getByLabelText('New password'), '12345');
      await user.type(screen.getByLabelText('Confirm password'), '12345');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/i)).toBeTruthy();
      });
    });

    it('should validate passwords match', async () => {
      const { user } = await goToCodeStep();

      await user.type(screen.getByLabelText('Reset code'), '123456');
      await user.type(screen.getByLabelText('New password'), 'password1');
      await user.type(screen.getByLabelText('Confirm password'), 'password2');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
      });
    });

    it('should call verifyRecoveryOtp and updatePassword on valid submit', async () => {
      const auth = createMockAuthService();
      const { user } = await goToCodeStep({ auth, email: 'test@acme.com' });

      await user.type(screen.getByLabelText('Reset code'), '654321');
      await user.type(screen.getByLabelText('New password'), 'newpass123');
      await user.type(screen.getByLabelText('Confirm password'), 'newpass123');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(auth.verifyRecoveryOtp).toHaveBeenCalledWith('test@acme.com', '654321');
      });

      expect(auth.updatePassword).toHaveBeenCalledWith('newpass123');
    });

    it('should show success step after password reset', async () => {
      const auth = createMockAuthService();
      const { user } = await goToCodeStep({ auth });

      await user.type(screen.getByLabelText('Reset code'), '654321');
      await user.type(screen.getByLabelText('New password'), 'newpass123');
      await user.type(screen.getByLabelText('Confirm password'), 'newpass123');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password has been reset successfully/i)).toBeTruthy();
      });
    });

    it('should show verify error from Supabase', async () => {
      const auth = createMockAuthService();
      auth.verifyRecoveryOtp.mockResolvedValue({ data: {}, error: { message: 'Token has expired or is invalid' } });

      const { user } = await goToCodeStep({ auth });

      await user.type(screen.getByLabelText('Reset code'), '000000');
      await user.type(screen.getByLabelText('New password'), 'newpass123');
      await user.type(screen.getByLabelText('Confirm password'), 'newpass123');
      await user.click(screen.getByRole('button', { name: /set new password/i }));

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeTruthy();
      });
    });

    it('should go back to email step on back button', async () => {
      const { user } = await goToCodeStep();

      // The back button has only an icon, find it by its position
      const backButton = screen.getByText(/enter the code sent to/i).parentElement!.querySelector('button')!;
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send reset code/i })).toBeTruthy();
      });
    });
  });

  it('should show back to sign in link', async () => {
    await renderComponent();
    expect(screen.getByText(/back to sign in/i)).toBeTruthy();
  });
});
