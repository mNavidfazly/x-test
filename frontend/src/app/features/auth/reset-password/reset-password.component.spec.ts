import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FormsModule } from '@angular/forms';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';
import { ApiService } from '../../../core/services/api.service';
import { createMockApiService } from '../../../__mocks__/api.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ActivatedRoute } from '@angular/router';

describe('ResetPasswordComponent', () => {
  async function renderComponent(options?: {
    api?: ReturnType<typeof createMockApiService>;
    queryEmail?: string;
  }) {
    const api = options?.api ?? createMockApiService();

    await render(ResetPasswordComponent, {
      componentImports: [MockLucideIconComponent, FormsModule],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
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

    return { api };
  }

  it('should render email input and submit button', async () => {
    await renderComponent();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy();
  });

  it('should pre-populate email from query param', async () => {
    await renderComponent({ queryEmail: 'pre@test.com' });
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.value).toBe('pre@test.com');
  });

  it('should call API on submit and show success', async () => {
    const api = createMockApiService();
    api.post.mockReturnValue(of({ message: 'ok' }));

    await renderComponent({ api });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'test@acme.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeTruthy();
    });

    expect(api.post).toHaveBeenCalledWith('/auth/reset-password', { email: 'test@acme.com' });
  });

  it('should show back to sign in link', async () => {
    await renderComponent();
    expect(screen.getByText(/back to sign in/i)).toBeTruthy();
  });
});
