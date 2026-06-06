import { Injectable, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';

export interface KeycloakUser {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable({ providedIn: 'root' })
export class KeycloakService {
  readonly #keycloak = new Keycloak({
    url: environment.keycloakUrl,
    realm: environment.keycloakRealm,
    clientId: environment.keycloakClientId,
  });

  readonly #authenticated = signal(false);
  readonly #initialized = signal(false);

  readonly authenticated = this.#authenticated.asReadonly();
  readonly initialized = this.#initialized.asReadonly();

  async init(): Promise<boolean> {
    if (this.#initialized()) return this.#authenticated();

    try {
      const auth = await this.#keycloak.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        pkceMethod: 'S256',
      });

      this.#keycloak.onTokenExpired = () => {
        this.#keycloak.updateToken(30).catch(() => {
          this.#authenticated.set(false);
        });
      };

      this.#keycloak.onAuthRefreshSuccess = () => {
        this.#authenticated.set(this.#keycloak.authenticated ?? false);
      };

      this.#keycloak.onAuthRefreshError = () => {
        this.#authenticated.set(false);
      };

      this.#keycloak.onAuthLogout = () => {
        this.#authenticated.set(false);
      };

      this.#initialized.set(true);
      this.#authenticated.set(auth);
      return auth;
    } catch {
      this.#initialized.set(true);
      this.#authenticated.set(false);
      return false;
    }
  }

  login(): Promise<void> {
    return this.#keycloak.login({ redirectUri: window.location.origin + '/' });
  }

  logout(): Promise<void> {
    return this.#keycloak.logout({ redirectUri: window.location.origin + '/login' });
  }

  getToken(): string | undefined {
    return this.#keycloak.token;
  }

  getUserId(): string | undefined {
    return this.#keycloak.tokenParsed?.sub;
  }

  getUser(): KeycloakUser | null {
    const parsed = this.#keycloak.tokenParsed;
    if (!parsed) return null;
    return {
      email: parsed['email'] as string | undefined,
      name: parsed['preferred_username'] as string | undefined,
      firstName: parsed['given_name'] as string | undefined,
      lastName: parsed['family_name'] as string | undefined,
    };
  }

  async refreshToken(): Promise<void> {
    try {
      await this.#keycloak.updateToken(30);
      this.#authenticated.set(this.#keycloak.authenticated ?? false);
    } catch {
      this.#authenticated.set(false);
    }
  }
}
