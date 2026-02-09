import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AppUser, JwtClaims, UserRole } from '../models/auth.model';

const DEFAULT_CLAIMS: JwtClaims = {
  tenant_id: '',
  is_tenant_admin: false,
  is_platform_admin: false,
  csm_tenant_ids: [],
  lecturer_course_ids: [],
  lecturer_can_edit_course_ids: [],
  lecturer_can_grade_course_ids: [],
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  #supabase = inject(SupabaseService);
  #currentUser = signal<AppUser | null>(null);
  #loading = signal(true);

  readonly currentUser = this.#currentUser.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly isAuthenticated = computed(() => this.#currentUser() !== null);
  readonly roles = computed(() => this.#currentUser()?.roles ?? []);

  constructor() {
    this.#supabase.client.auth.onAuthStateChange((_event, session) => {
      this.#currentUser.set(this.#parseSession(session));
      this.#loading.set(false);
    });

    this.#supabase.client.auth.getSession().then(({ data: { session } }) => {
      this.#currentUser.set(this.#parseSession(session));
      this.#loading.set(false);
    });
  }

  async signInWithPassword(email: string, password: string) {
    return this.#supabase.client.auth.signInWithPassword({ email, password });
  }

  async signInWithOtp(email: string) {
    return this.#supabase.client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
  }

  async verifyOtp(email: string, token: string) {
    return this.#supabase.client.auth.verifyOtp({ email, token, type: 'email' });
  }

  async signInWithOAuth(provider: 'azure') {
    return this.#supabase.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async signOut() {
    await this.#supabase.client.auth.signOut();
  }

  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((r) => this.roles().includes(r));
  }

  #parseSession(session: Session | null): AppUser | null {
    if (!session?.user) return null;

    const claims = this.#decodeJwtClaims(session.access_token);
    const roles = this.#computeRoles(claims);

    return {
      id: session.user.id,
      email: session.user.email ?? '',
      tenantId: claims.tenant_id,
      roles,
      claims,
    };
  }

  #decodeJwtClaims(accessToken: string): JwtClaims {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return {
        tenant_id: payload.tenant_id ?? '',
        is_tenant_admin: payload.is_tenant_admin === true,
        is_platform_admin: payload.is_platform_admin === true,
        csm_tenant_ids: payload.csm_tenant_ids ?? [],
        lecturer_course_ids: payload.lecturer_course_ids ?? [],
        lecturer_can_edit_course_ids: payload.lecturer_can_edit_course_ids ?? [],
        lecturer_can_grade_course_ids: payload.lecturer_can_grade_course_ids ?? [],
      };
    } catch {
      return DEFAULT_CLAIMS;
    }
  }

  #computeRoles(claims: JwtClaims): UserRole[] {
    const roles: UserRole[] = ['learner'];
    if (claims.is_tenant_admin) roles.push('tenant_admin');
    if (claims.is_platform_admin) roles.push('platform_admin');
    if (claims.csm_tenant_ids.length > 0) roles.push('csm');
    if (claims.lecturer_course_ids.length > 0) roles.push('lecturer');
    return roles;
  }
}
