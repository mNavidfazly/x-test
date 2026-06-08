import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { KeycloakService } from './keycloak.service';

const CLAIMS_REFRESH_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  #keycloak = inject(KeycloakService);
  #cachedToken: string | null = null;
  #tokenExpiresAt = 0;
  #refreshAt = 0;

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        accessToken: () => this.#getSupabaseToken(),
      },
    );
  }

  clearToken(): void {
    this.#cachedToken = null;
    this.#tokenExpiresAt = 0;
    this.#refreshAt = 0;
  }

  async getToken(): Promise<string | null> {
    return this.#getSupabaseToken();
  }

  async #getSupabaseToken(): Promise<string | null> {
    const keycloakToken = this.#keycloak.getToken();
    if (!keycloakToken) return null;

    const now = Date.now();
    if (this.#cachedToken && now < this.#refreshAt) {
      return this.#cachedToken;
    }

    const exchangeUrl = `${environment.supabaseUrl}/functions/v1/exchange-token`;
    const res = await fetch(exchangeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keycloakToken}`,
        'Content-Type': 'application/json',
        'apikey': environment.supabaseAnonKey,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Token exchange failed' }));
      throw new Error(err.error || 'Token exchange failed');
    }

    const { token, expires_in } = await res.json();
    this.#cachedToken = token;
    this.#tokenExpiresAt = now + expires_in * 1000;
    this.#refreshAt = now + CLAIMS_REFRESH_MS;
    return token;
  }
}
