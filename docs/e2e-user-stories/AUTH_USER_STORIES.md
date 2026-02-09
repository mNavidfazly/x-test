# X-Course v2 — Auth Flow Playwright User Stories

## Overview

Manual E2E testing scenarios for the tenant-aware authentication flow. These stories cover the complete auth journey: tenant resolution, email/password login, magic link, Azure SSO, password reset, and access requests.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-course-v2.vercel.app |
| **Backend URL** | https://x-course-v2-production.up.railway.app |
| **Test Email** | et@calypso-commodities.com |
| **Tenant** | Calypso |
| **Auth Methods** | azure_sso, email_password, magic_link |
| **Password** | Set via Supabase Auth Admin API (see below) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-course-v2.vercel.app | https://x-course-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test User Setup

Before running stories, ensure a test user exists with a known password:

```bash
# Set password for existing user via Supabase Management API
curl -X PUT "https://ruhdnvtvoxxiodnyyqqf.supabase.co/auth/v1/admin/users/{USER_ID}" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password": "TestPassword123!"}'
```

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed - All steps completed successfully |
| ❌ | Failed - One or more steps failed |
| ⏳ | Not Tested - Story has not been executed yet |
| ⚠️ | Partial - Some steps passed, issues found |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | AUTH-01 | Tenant-Aware Email/Password Login | Test user with password |
| 2 | AUTH-02 | Magic Link Login | Test user exists |
| 3 | AUTH-03 | Password Reset Flow | Test user exists |
| 4 | AUTH-04 | Access Request Submission | None (anonymous) |
| 5 | AUTH-05 | Azure SSO Login | Azure AD configured in Supabase |

---

## Summary Table

| ID | Story | Status | Last Checked |
|----|-------|--------|--------------|
| AUTH-01 | Tenant-Aware Email/Password Login | ⏳ Not Tested | - |
| AUTH-02 | Magic Link Login | ⏳ Not Tested | - |
| AUTH-03 | Password Reset Flow | ⏳ Not Tested | - |
| AUTH-04 | Access Request Submission | ⏳ Not Tested | - |
| AUTH-05 | Azure SSO Login | ⏳ Not Tested | - |

---

## AUTH-01: Tenant-Aware Email/Password Login

| Field | Value |
|-------|-------|
| **Last Checked** | - |
| **Status** | ⏳ Not Tested |
| **Tester** | - |

**Purpose**: Verify the complete two-step login flow: email entry, tenant resolution, auth method display, and successful password authentication with redirect to dashboard.

**Covers**: LoginComponent (step 1 + step 2), TenantService, AuthService.signInWithPassword, authGuard, AuthCallbackComponent, DashboardComponent

**Preconditions**:
- Test user `et@calypso-commodities.com` exists in Supabase with a known password
- User has a profile in `profiles` table (linked to Calypso tenant)
- Backend is deployed and `POST /api/auth/resolve-tenant` is reachable

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to https://x-course-v2.vercel.app | Redirected to `/login` by authGuard (no active session) | ☐ |
| 2 | Verify Step 1 UI | "X-Course v2" heading, "Enter your email to sign in" text, Email input with placeholder `you@company.com`, "Continue" button, "Request access" link | ☐ |
| 3 | Enter email: `et@calypso-commodities.com` | Email field accepts input | ☐ |
| 4 | Click "Continue" | Loading spinner appears briefly while tenant resolves | ☐ |
| 5 | Verify Step 2 header | "Sign in to **Calypso**" with back arrow button, email shown as `et@calypso-commodities.com` below header | ☐ |
| 6 | Verify all 3 auth methods visible | "Sign in with Microsoft" button, Password field + "Sign in" button + "Forgot password?" link, "Send magic link" button — separated by "OR" dividers | ☐ |
| 7 | Verify "Forgot password?" link URL | Link href is `/reset-password?email=et@calypso-commodities.com` (email pre-populated) | ☐ |
| 8 | Enter password in Password field | Field masks input (shows dots) | ☐ |
| 9 | Click "Sign in" | Loading state on button, AuthService.signInWithPassword called | ☐ |
| 10 | Wait for redirect | Redirected to `/dashboard` | ☐ |
| 11 | Verify dashboard loads | Dashboard component rendered, user is authenticated | ☐ |
| 12 | Reload page (F5) | Session persists — still on `/dashboard`, not redirected to `/login` | ☐ |

**Negative Cases (same session)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| N1 | Navigate to `/login`, enter `nobody@unknowndomain.xyz`, click Continue | Step 2 shows: "No account found for this domain." with yellow warning box, "Request access" link below | ☐ |
| N2 | Click "Back" arrow in Step 2 | Returns to Step 1 with email field (may retain previous email) | ☐ |
| N3 | Enter valid email, wrong password, click "Sign in" | Error message shown (e.g. "Invalid login credentials"), stays on login page | ☐ |
| N4 | Enter empty email, click Continue | Validation prevents submission (HTML `required` or custom check) | ☐ |

**Notes/Learnings**:
- The two-step flow calls `POST /api/auth/resolve-tenant` on Continue — check Network tab for the request
- JWT custom claims are baked at login: `tenant_id`, `is_tenant_admin`, `is_platform_admin`, etc.
- Session uses PKCE flow with `persistSession: true` and `autoRefreshToken: true`

---

## AUTH-02: Magic Link Login

| Field | Value |
|-------|-------|
| **Last Checked** | - |
| **Status** | ⏳ Not Tested |
| **Tester** | - |

**Purpose**: Verify magic link (OTP) authentication flow — from requesting the link to the email being sent. Full end-to-end requires checking the user's inbox for the OTP email.

**Covers**: LoginComponent (magic link button), AuthService.signInWithOtp, Supabase email delivery, AuthCallbackComponent (if link clicked)

**Preconditions**:
- Test user `et@calypso-commodities.com` exists in Supabase
- Supabase SMTP is configured and can send emails
- Access to the user's email inbox to receive the magic link

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/login` | Step 1 displayed | ☐ |
| 2 | Enter email: `et@calypso-commodities.com` | Email accepted | ☐ |
| 3 | Click "Continue" | Resolves to Calypso tenant, Step 2 shown with all 3 methods | ☐ |
| 4 | Click "Send magic link" button | Loading state on button, AuthService.signInWithOtp called | ☐ |
| 5 | Verify success feedback | UI shows confirmation that magic link was sent (e.g. "Check your email" or similar feedback) | ☐ |
| 6 | Check email inbox | Email received with magic link / OTP code from Supabase | ☐ |
| 7 | Click magic link in email | Browser opens `/auth/callback` with token parameters | ☐ |
| 8 | Verify AuthCallbackComponent handles exchange | "Completing sign in..." spinner shown briefly, Supabase exchanges code for session | ☐ |
| 9 | Wait for redirect | Redirected to `/dashboard` | ☐ |
| 10 | Verify authenticated session | Dashboard loads, session active, page reload stays on dashboard | ☐ |

**Partial Test (no inbox access)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| P1 | Complete steps 1-4 above | Magic link request sent | ☐ |
| P2 | Open browser Network tab | `POST` to Supabase `/auth/v1/otp` visible with `email` parameter | ☐ |
| P3 | Verify no console errors | No JS errors related to the OTP request | ☐ |

**Notes/Learnings**:
- Magic link uses OTP codes (`{{ .Token }}`) — corporate email scanners (Defender, Mimecast) can consume link tokens
- Supabase cannot distinguish email+password from magic link at the DB level — both show `provider: 'email'`
- The magic link redirects to `/auth/callback` where `detectSessionInUrl: true` handles the token exchange
- If the link has expired, `AuthCallbackComponent` should handle the error gracefully

---

## AUTH-03: Password Reset Flow

| Field | Value |
|-------|-------|
| **Last Checked** | - |
| **Status** | ⏳ Not Tested |
| **Tester** | - |

**Purpose**: Verify the complete password reset journey — requesting a reset via FastAPI proxy, receiving the email, and setting a new password. The reset is proxied through FastAPI (never calls `resetPasswordForEmail()` directly) to enforce tenant auth method validation.

**Covers**: ResetPasswordComponent, FastAPI `POST /api/auth/reset-password`, Supabase `admin.generate_link(recovery)`, email delivery

**Preconditions**:
- Test user `et@calypso-commodities.com` exists in Supabase
- Calypso tenant has `email_password` in `auth_methods` (required for reset to be sent)
- Supabase SMTP is configured
- Access to the user's email inbox

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/login` | Login page displayed | ☐ |
| 2 | Enter email: `et@calypso-commodities.com`, click Continue | Step 2 with Calypso auth methods | ☐ |
| 3 | Click "Forgot password?" link | Navigated to `/reset-password?email=et@calypso-commodities.com` | ☐ |
| 4 | Verify email pre-populated | Email input contains `et@calypso-commodities.com` (from query param) | ☐ |
| 5 | Verify Reset Password UI | "Reset Password" heading, email input, "Send reset link" button, "Back to sign in" link | ☐ |
| 6 | Click "Send reset link" | Loading state on button, `POST /api/auth/reset-password` called via ApiService | ☐ |
| 7 | Verify success message | "Check your email for a password reset link." displayed | ☐ |
| 8 | Check browser Network tab | Request to backend `/api/auth/reset-password` with `{"email": "et@calypso-commodities.com"}` | ☐ |
| 9 | Check email inbox | Recovery email received from Supabase | ☐ |
| 10 | Click recovery link | Opens Supabase password reset page (or redirect configured in email template) | ☐ |
| 11 | Set new password | Password updated successfully | ☐ |
| 12 | Navigate to `/login`, sign in with new password | Login succeeds, redirected to dashboard | ☐ |

**Anti-Enumeration Tests**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| A1 | Navigate to `/reset-password` directly (no query param) | Email field is empty, form still works | ☐ |
| A2 | Enter `nonexistent@unknowndomain.xyz`, click "Send reset link" | **Same** success message shown ("Check your email...") — never reveals whether email exists | ☐ |
| A3 | Enter `sso-only@example.com` (tenant without `email_password`) | Same success message — backend silently skips sending (tenant doesn't allow password auth) | ☐ |
| A4 | Click "Back to sign in" | Navigated to `/login` | ☐ |

**Backend Verification (curl)**:

```bash
# Should always return 200 with same message
curl -s -X POST https://x-course-v2-production.up.railway.app/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"et@calypso-commodities.com"}'
# Expected: {"message":"If an account exists for this email, you will receive a password reset link."}

# Unknown email — same response (anti-enumeration)
curl -s -X POST https://x-course-v2-production.up.railway.app/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@nowhere.com"}'
# Expected: {"message":"If an account exists for this email, you will receive a password reset link."}
```

**Notes/Learnings**:
- Password reset is proxied through FastAPI — NEVER calls `resetPasswordForEmail()` directly from frontend
- Backend validates tenant allows `email_password` before sending — SSO-only tenants get no email but same response
- Anti-enumeration: always returns HTTP 200 with identical message regardless of email existence
- Rate limited: 5 requests/minute/IP on the backend endpoint

---

## AUTH-04: Access Request Submission

| Field | Value |
|-------|-------|
| **Last Checked** | - |
| **Status** | ⏳ Not Tested |
| **Tester** | - |

**Purpose**: Verify that unauthenticated users can submit access requests. The form inserts directly into Supabase `access_requests` table via anon client (RLS policy `access_requests_insert_anon` allows anonymous INSERT). This also verifies the navigation flow from login "no account found" to access request.

**Covers**: AccessRequestComponent, SupabaseService (anon client), `access_requests` table RLS, login → access request navigation

**Preconditions**:
- None (this is an anonymous flow — no authentication required)
- Supabase anon key is configured in frontend environment
- RLS policy `access_requests_insert_anon` exists on `access_requests` table

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/login` | Login page Step 1 displayed | ☐ |
| 2 | Enter email: `newuser@unknowndomain.xyz`, click Continue | Step 2 shows "No account found for this domain." warning | ☐ |
| 3 | Click "Request access" link on Step 2 | Navigated to `/request-access` | ☐ |
| 4 | Verify Request Access UI | "Request Access" heading, "Enter your details and we'll notify your organization's admin." subtitle, Full Name input, Email input, "Submit Request" button, "Back to sign in" link | ☐ |
| 5 | Leave fields empty, click "Submit Request" | Validation prevents submission (required fields) | ☐ |
| 6 | Enter Full Name: "Test User Playwright" | Name field accepts input | ☐ |
| 7 | Enter Email: `testuser@calypso-commodities.com` | Email field accepts input | ☐ |
| 8 | Click "Submit Request" | Loading state on button, Supabase INSERT to `access_requests` executed | ☐ |
| 9 | Verify success message | "Your request has been submitted." (or similar success feedback) | ☐ |
| 10 | Click "Back to sign in" | Navigated to `/login` | ☐ |

**Direct Navigation Tests**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| D1 | Navigate directly to `/request-access` (no prior login attempt) | Form loads correctly without errors | ☐ |
| D2 | From login Step 1, click "Request access" link | Navigated to `/request-access` (link exists on Step 1 too) | ☐ |

**Database Verification**:

After submitting, verify the row was inserted (requires Supabase Dashboard or service-role query):

```sql
SELECT id, email, full_name, domain, status, created_at
FROM access_requests
WHERE email = 'testuser@calypso-commodities.com'
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `status = 'pending'`, `domain = 'calypso-commodities.com'` (extracted by frontend), `full_name = 'Test User Playwright'`

**Notes/Learnings**:
- Access request is fully anonymous — no JWT required
- Frontend extracts `domain` from email before inserting
- RLS policy allows anonymous INSERT but not SELECT/UPDATE/DELETE — submitters cannot see their own requests
- A `notify_new_access_request()` database trigger fires on INSERT to create a notification for tenant admins
- After the request is reviewed (approved/rejected), the `notify_access_request_reviewed()` trigger notifies the requester (if they have a profile by then)

---

## AUTH-05: Azure SSO Login (Microsoft Entra ID)

| Field | Value |
|-------|-------|
| **Last Checked** | - |
| **Status** | ⏳ Not Tested |
| **Tester** | - |

**Purpose**: Verify the full Azure SSO (Microsoft Entra ID / formerly Azure AD) login flow. Clicking "Sign in with Microsoft" triggers Supabase's OAuth flow, redirects to Microsoft login, and returns to `/auth/callback` where the session is exchanged and the user lands on the dashboard.

**Covers**: LoginComponent (Azure SSO button), AuthService.signInWithOAuth('azure'), Supabase OAuth provider, Microsoft login page, AuthCallbackComponent, Automatic Identity Linking (if user already has email/password account)

### Azure AD Setup Checklist

Before this story can run, the following infrastructure must be configured:

| # | Task | Where | Status |
|---|------|-------|--------|
| 1 | Create Azure AD App Registration | Azure Portal → App registrations → New registration | ☐ |
| 2 | Set redirect URI | `https://ruhdnvtvoxxiodnyyqqf.supabase.co/auth/v1/callback` | ☐ |
| 3 | Create client secret | Azure Portal → App Registration → Certificates & secrets | ☐ |
| 4 | Enable ID tokens | Azure Portal → App Registration → Authentication → ID tokens checkbox | ☐ |
| 5 | Add `email` + `profile` + `openid` API permissions | Azure Portal → App Registration → API permissions | ☐ |
| 6 | Enable `xms_edov` optional claim | Azure Portal → Token configuration → Add optional claim → ID → `xms_edov` | ☐ |
| 7 | Configure Supabase Azure provider | Supabase Dashboard → Authentication → Providers → Azure → Enable, paste Client ID + Secret + Azure Tenant URL | ☐ |
| 8 | Verify PKCE flow | Frontend Supabase client has `flowType: 'pkce'` in config | ☐ |

### Preconditions
- All 8 setup tasks above completed
- Test user `et@calypso-commodities.com` has a Microsoft account (same email)
- Calypso tenant has `azure_sso` in `settings.auth_methods` (already true)
- Frontend and backend deployed

### Steps

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/login` | Step 1 displayed | ☐ |
| 2 | Enter email: `et@calypso-commodities.com`, click Continue | Step 2 shows "Sign in to **Calypso**" with all 3 methods | ☐ |
| 3 | Click "Sign in with Microsoft" | Browser redirects to `login.microsoftonline.com` (Microsoft login page) | ☐ |
| 4 | Verify Microsoft login page loads | Microsoft "Sign in" form with email field, organization branding if configured | ☐ |
| 5 | Enter Microsoft credentials (email + password or MFA) | Microsoft authenticates the user | ☐ |
| 6 | Microsoft redirects back | Browser goes to `https://ruhdnvtvoxxiodnyyqqf.supabase.co/auth/v1/callback` then to `https://x-course-v2.vercel.app/auth/callback` | ☐ |
| 7 | Verify AuthCallbackComponent | "Completing sign in..." spinner shown, Supabase exchanges PKCE code for session | ☐ |
| 8 | Wait for redirect | Redirected to `/dashboard` | ☐ |
| 9 | Verify authenticated session | Dashboard loads, user is logged in | ☐ |
| 10 | Check JWT claims (browser DevTools) | `localStorage` → Supabase session → decode JWT → verify `tenant_id`, `is_tenant_admin`, etc. are present | ☐ |
| 11 | Reload page (F5) | Session persists — still on `/dashboard` | ☐ |

### Identity Linking Test

If the user already signed in with email/password before, test that Supabase links identities:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| L1 | First: Sign in with email/password (AUTH-01) | Session created, one identity in `auth.users` | ☐ |
| L2 | Sign out | Session cleared | ☐ |
| L3 | Sign in with Azure SSO (steps 1-9 above) | Same `auth.users` row, but now TWO identities (email + azure) | ☐ |
| L4 | Verify same profile | `profiles.id` unchanged — same user, same tenant, same roles | ☐ |
| L5 | Query `auth.identities` (via Supabase Dashboard) | Two rows: `provider=email` and `provider=azure`, same `user_id` | ☐ |

### SSO-Only Tenant Test

Test that a tenant configured with ONLY `azure_sso` shows only the Microsoft button:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| S1 | Configure a test tenant with `settings.auth_methods = ['azure_sso']` | Tenant only allows SSO | ☐ |
| S2 | Enter an email from that tenant, click Continue | Step 2 shows ONLY "Sign in with Microsoft" — no password field, no magic link | ☐ |
| S3 | Verify `password_verification_hook` blocks password login | If someone tries `signInWithPassword` directly (e.g. via API), the hook returns error | ☐ |

### Error Handling

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| E1 | Click "Sign in with Microsoft", cancel on Microsoft login page | Redirected back to `/auth/callback` with error params, AuthCallbackComponent shows error or redirects to `/login` | ☐ |
| E2 | Azure AD admin revokes app consent | User sees Microsoft error page "Need admin approval" — does not crash frontend | ☐ |
| E3 | Supabase Azure provider disabled | `signInWithOAuth` returns error, frontend should show error message on login page | ☐ |

### Security Verification

| # | Check | How to Verify | ✓ |
|---|-------|---------------|---|
| SEC1 | PKCE flow used (not implicit) | Network tab: initial request to Supabase includes `code_challenge` parameter | ☐ |
| SEC2 | `xms_edov` claim present | Decode Azure ID token (Network tab) — `xms_edov: true` means email is verified by Azure AD | ☐ |
| SEC3 | No access token in URL fragment | After callback, URL should use `?code=` (PKCE), NOT `#access_token=` (implicit) | ☐ |
| SEC4 | Redirect URI matches exactly | Supabase callback URL matches Azure App Registration — no open redirect | ☐ |

**Notes/Learnings**:
- Azure AD tenant URL format: `https://login.microsoftonline.com/{AZURE_TENANT_ID}` (single-tenant) or `https://login.microsoftonline.com/common` (multi-tenant)
- `xms_edov` (Email Domain Owner Verified) prevents email impersonation — REQUIRED for security
- PKCE flow is mandatory (`flowType: 'pkce'` in Supabase client) — implicit flow exposes tokens in URL fragments
- Supabase Automatic Identity Linking: same email via Azure + email/password merges into one `auth.users` row with two `auth.identities`
- The `handle_new_user()` trigger creates a profile on first SSO login (resolves tenant from email domain)
- `password_verification_hook()` blocks password login for SSO-only tenants — even if someone discovers the API endpoint
- After Azure setup, the `signInWithOAuth('azure')` call redirects immediately — there's no intermediate Supabase UI

---

## Known Issues

_No issues discovered yet — update this section during test execution._

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|------------------|------|------|-------|
| - | - | - | - | - | No test sessions yet |

---

## References

| Document | Purpose |
|----------|---------|
| `docs/AUTH_SYSTEM.md` | Full auth architecture, JWT claims, multi-provider flows |
| `docs/x_course_development_approach.md` | Phase 1F completion details |
| `docs/STYLING_GUIDE.md` | Calypso design tokens for UI verification |
| `backend/app/routers/auth.py` | FastAPI auth endpoints (resolve-tenant, reset-password) |
| `frontend/src/app/features/auth/` | All auth components (login, reset-password, access-request, callback) |
| `supabase/migrations/00012*.sql` | Per-tenant auth method enforcement |
| `supabase/migrations/00013*.sql` | Password verification hook, security hardening |
