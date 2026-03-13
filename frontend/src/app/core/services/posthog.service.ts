import { Injectable } from '@angular/core';
import posthog from 'posthog-js';
import { environment } from '../../../environments/environment';
import { AppUser } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class PosthogService {
  #initialized = false;

  init(): void {
    if (this.#initialized || !environment.posthogApiKey) return;

    posthog.init(environment.posthogApiKey, {
      api_host: environment.posthogHost,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
    });

    this.#initialized = true;
  }

  identify(user: AppUser): void {
    if (!this.#initialized) return;

    posthog.identify(user.id, {
      email: user.email,
      tenant_id: user.tenantId,
      roles: user.roles,
    });
  }

  reset(): void {
    if (!this.#initialized) return;
    posthog.reset();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    if (!this.#initialized) return;
    posthog.capture(event, properties);
  }
}
