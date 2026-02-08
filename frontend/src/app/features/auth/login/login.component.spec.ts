import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { FormsModule } from '@angular/forms';
import { RouterLink, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockTenantService } from '../../../__mocks__/tenant.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { TenantResolution } from '../../../core/models/tenant.model';

describe('LoginComponent', () => {
  async function renderLogin(options?: {
    auth?: ReturnType<typeof createMockAuthService>;
    tenant?: ReturnType<typeof createMockTenantService>;
  }) {
    const auth = options?.auth ?? createMockAuthService();
    const tenant = options?.tenant ?? createMockTenantService();

    await render(LoginComponent, {
      componentImports: [MockLucideIconComponent, FormsModule, RouterLink],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: TenantService, useValue: tenant },
      ],
    });

    return { auth, tenant };
  }

  describe('Step 1 — Email entry', () => {
    it('should render email input and continue button', async () => {
      await renderLogin();
      expect(screen.getByLabelText('Email')).toBeTruthy();
      expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
    });

    it('should show request access link', async () => {
      await renderLogin();
      expect(screen.getByText(/request access/i)).toBeTruthy();
    });

    it('should advance to methods step after continue', async () => {
      const tenant = createMockTenantService({ authMethods: ['email_password'] });
      await renderLogin({ tenant });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Email'), 'test@acme.com');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByLabelText('Password')).toBeTruthy();
      });
    });
  });

  describe('Step 2 — Auth methods', () => {
    async function setupStep2(resolution: TenantResolution) {
      const tenant = createMockTenantService();
      tenant.resolveTenant.mockReturnValue(of(resolution));
      const auth = createMockAuthService();
      const { auth: a, tenant: t } = await renderLogin({ auth, tenant });
      const user = userEvent.setup();

      await user.type(screen.getByLabelText('Email'), 'test@acme.com');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Wait for step 2
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /continue/i })).toBeFalsy();
      });

      return { auth: a, tenant: t, user };
    }

    it('should show Azure SSO when allowed', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['azure_sso', 'email_password'],
      });

      expect(screen.getByRole('button', { name: /sign in with microsoft/i })).toBeTruthy();
    });

    it('should show password input when email_password allowed', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
      });

      expect(screen.getByLabelText('Password')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    });

    it('should show magic link button when allowed', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['magic_link'],
      });

      expect(screen.getByRole('button', { name: /send magic link/i })).toBeTruthy();
    });

    it('should show no account message when no tenant', async () => {
      await setupStep2({
        tenant_name: null,
        auth_methods: [],
      });

      expect(screen.getByText(/no account found/i)).toBeTruthy();
    });

    it('should show tenant name', async () => {
      await setupStep2({
        tenant_name: 'Acme Corp',
        auth_methods: ['email_password'],
      });

      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    it('should call signInWithPassword on sign in', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
      });

      await user.type(screen.getByLabelText('Password'), 'secret123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      expect(auth.signInWithPassword).toHaveBeenCalledWith('test@acme.com', 'secret123');
    });

    it('should call signInWithOtp for magic link', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['magic_link'],
      });

      await user.click(screen.getByRole('button', { name: /send magic link/i }));

      expect(auth.signInWithOtp).toHaveBeenCalledWith('test@acme.com');
    });

    it('should call signInWithOAuth for Azure', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['azure_sso'],
      });

      await user.click(screen.getByRole('button', { name: /sign in with microsoft/i }));

      expect(auth.signInWithOAuth).toHaveBeenCalledWith('azure');
    });

    it('should go back to email step on back button', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      const user = userEvent.setup();
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
      });
    });
  });
});
