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
      return of({ tenant_name: null, auth_methods: [] });
    }

    const domain = email.split('@')[1].toLowerCase();

    const cached = this.#cache.get(domain);
    if (cached) {
      return of(cached);
    }

    return this.#api
      .post<TenantResolution>('/auth/resolve-tenant', { email })
      .pipe(tap((result) => this.#cache.set(domain, result)));
  }

  clearCache(): void {
    this.#cache.clear();
  }
}
