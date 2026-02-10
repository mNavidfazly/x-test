import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TenantResolution } from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  #api = inject(ApiService);
  #cache = new Map<string, TenantResolution>();

  resolveTenant(email: string): Observable<TenantResolution> {
    if (!email || !email.includes('@')) {
      return of({ tenant_name: null, auth_methods: [], idp_hint: null });
    }

    const cacheKey = email.toLowerCase();

    const cached = this.#cache.get(cacheKey);
    if (cached) {
      return of(cached);
    }

    return this.#api
      .post<TenantResolution>('/auth/resolve-tenant', { email })
      .pipe(tap((result) => this.#cache.set(cacheKey, result)));
  }

  clearCache(): void {
    this.#cache.clear();
  }
}
