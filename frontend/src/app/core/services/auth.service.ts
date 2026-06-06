import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { KeycloakService } from './keycloak.service';
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
  #keycloak = inject(KeycloakService);
  #supabase = inject(SupabaseService);
  #router = inject(Router);
  #currentUser = signal<AppUser | null>(null);
  #loading = signal(true);

  readonly currentUser = this.#currentUser.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly isAuthenticated = computed(() => this.#currentUser() !== null);
  readonly roles = computed(() => this.#currentUser()?.roles ?? []);

  constructor() {
    this.#initKeycloak();
  }

  async #initKeycloak(): Promise<void> {
    const authenticated = await this.#keycloak.init();

    if (authenticated) {
      this.#updateUser();
    }

    this.#loading.set(false);
  }

  #updateUser(): void {
    const kcUser = this.#keycloak.getUser();
    const token = this.#keycloak.getToken();

    if (!kcUser || !token) {
      this.#currentUser.set(null);
      return;
    }

    const claims = this.#decodeJwtClaims(token);
    const roles = this.#computeRoles(claims);
    const userId = this.#keycloak.getUserId() ?? '';

    const user: AppUser = {
      id: userId,
      email: kcUser.email ?? '',
      tenantId: claims.tenant_id,
      roles,
      claims,
    };

    this.#currentUser.set(user);
    Sentry.setUser({ id: user.id, email: user.email });
    Sentry.setTag('tenant_id', user.tenantId);
    Sentry.setTag('roles', user.roles.join(','));
  }

  async login(): Promise<void> {
    await this.#keycloak.login();
  }

  async signOut(): Promise<void> {
    this.#supabase.clearToken();
    this.#currentUser.set(null);
    Sentry.setUser(null);
    await this.#keycloak.logout();
  }

  hasRole(role: UserRole): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return roles.some((r) => this.roles().includes(r));
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
