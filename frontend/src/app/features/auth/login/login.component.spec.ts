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
import { AuthMethod } from '../../../core/models/tenant.model';

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

    it('should show password input when email_password allowed', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
        idp_hint: null,
      });

      expect(screen.getByLabelText('Password')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
    });

    it('should show send sign-in code button when magic_link allowed', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['magic_link'],
        idp_hint: null,
      });

      expect(screen.getByRole('button', { name: /send sign-in code/i })).toBeTruthy();
    });

    it('should show no account message when no tenant', async () => {
      await setupStep2({
        tenant_name: null,
        auth_methods: [],
        idp_hint: null,
      });

      expect(screen.getByText(/no account found/i)).toBeTruthy();
    });

    it('should show tenant name', async () => {
      await setupStep2({
        tenant_name: 'Acme Corp',
        auth_methods: ['email_password'],
        idp_hint: null,
      });

      expect(screen.getByText('Acme Corp')).toBeTruthy();
    });

    it('should call signInWithPassword on sign in', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
        idp_hint: null,
      });

      await user.type(screen.getByLabelText('Password'), 'secret123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      expect(auth.signInWithPassword).toHaveBeenCalledWith('test@acme.com', 'secret123');
    });

    it('should call signInWithOtp when sending code', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['magic_link'],
        idp_hint: null,
      });

      await user.click(screen.getByRole('button', { name: /send sign-in code/i }));

      expect(auth.signInWithOtp).toHaveBeenCalledWith('test@acme.com');
    });

    it('should show Keycloak SSO button when allowed', async () => {
      await setupStep2({
        tenant_name: 'Equinor',
        auth_methods: ['keycloak_sso'],
        idp_hint: null,
      });

      expect(screen.getByRole('button', { name: /sign in with sso/i })).toBeTruthy();
    });

    it('should call signInWithOAuth for Keycloak with idp_hint', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Equinor',
        auth_methods: ['keycloak_sso'],
        idp_hint: 'equinor-entraid',
      });

      await user.click(screen.getByRole('button', { name: /sign in with sso/i }));

      expect(auth.signInWithOAuth).toHaveBeenCalledWith('equinor-entraid');
    });

    it('should call signInWithOAuth for Keycloak without hint when none available', async () => {
      const { auth, user } = await setupStep2({
        tenant_name: 'Equinor',
        auth_methods: ['keycloak_sso'],
        idp_hint: null,
      });

      await user.click(screen.getByRole('button', { name: /sign in with sso/i }));

      expect(auth.signInWithOAuth).toHaveBeenCalledWith(undefined);
    });

    it('should show or divider between SSO and password', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['keycloak_sso', 'email_password'],
        idp_hint: null,
      });

      expect(screen.getByText('or')).toBeTruthy();
    });

    it('should go back to email step on back button', async () => {
      await setupStep2({
        tenant_name: 'Acme',
        auth_methods: ['email_password'],
        idp_hint: null,
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      const user = userEvent.setup();
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
      });
    });
  });

  describe('Step 3 — OTP verification', () => {
    async function setupOtpStep() {
      const tenant = createMockTenantService();
      tenant.resolveTenant.mockReturnValue(
        of({ tenant_name: 'Acme', auth_methods: ['magic_link'] as AuthMethod[], idp_hint: null }),
      );
      const auth = createMockAuthService();
      await renderLogin({ auth, tenant });
      const user = userEvent.setup();

      // Step 1: enter email
      await user.type(screen.getByLabelText('Email'), 'test@acme.com');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 2: click "Send sign-in code"
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send sign-in code/i })).toBeTruthy();
      });
      await user.click(screen.getByRole('button', { name: /send sign-in code/i }));

      // Step 3: OTP input should appear
      await waitFor(() => {
        expect(screen.getByLabelText('Verification code')).toBeTruthy();
      });

      return { auth, user };
    }

    it('should show OTP input after sending code', async () => {
      await setupOtpStep();
      expect(screen.getByLabelText('Verification code')).toBeTruthy();
      expect(screen.getByRole('button', { name: /verify/i })).toBeTruthy();
      expect(screen.getByText(/we sent a 6-digit code/i)).toBeTruthy();
    });

    it('should show the email address in the OTP message', async () => {
      await setupOtpStep();
      expect(screen.getByText('test@acme.com')).toBeTruthy();
    });

    it('should disable verify button when code is incomplete', async () => {
      const { user } = await setupOtpStep();
      const verifyBtn = screen.getByRole('button', { name: /verify/i }) as HTMLButtonElement;
      expect(verifyBtn.disabled).toBe(true);

      await user.type(screen.getByLabelText('Verification code'), '123');
      expect(verifyBtn.disabled).toBe(true);
    });

    it('should enable verify button when 6 digits entered', async () => {
      const { user } = await setupOtpStep();
      await user.type(screen.getByLabelText('Verification code'), '123456');

      await waitFor(() => {
        const verifyBtn = screen.getByRole('button', { name: /verify/i }) as HTMLButtonElement;
        expect(verifyBtn.disabled).toBe(false);
      });
    });

    it('should call verifyOtp with email and code', async () => {
      const { auth, user } = await setupOtpStep();
      await user.type(screen.getByLabelText('Verification code'), '654321');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(auth.verifyOtp).toHaveBeenCalledWith('test@acme.com', '654321');
      });
    });

    it('should show error on invalid code', async () => {
      const { auth, user } = await setupOtpStep();
      auth.verifyOtp.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid' },
      });

      await user.type(screen.getByLabelText('Verification code'), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/token has expired/i)).toBeTruthy();
      });
    });

    it('should show resend cooldown after sending', async () => {
      await setupOtpStep();
      expect(screen.getByText(/resend code in/i)).toBeTruthy();
    });

    it('should navigate back to methods step on back button', async () => {
      const { user } = await setupOtpStep();
      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /send sign-in code/i })).toBeTruthy();
      });
    });
  });
});
