import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PosthogService } from './posthog.service';
import { AppUser } from '../models/auth.model';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}));

vi.mock('../../../environments/environment', () => ({
  environment: {
    posthogApiKey: 'phc_test_key',
    posthogHost: 'https://eu.i.posthog.com',
  },
}));

import posthog from 'posthog-js';
import { environment } from '../../../environments/environment';

describe('PosthogService', () => {
  let service: PosthogService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PosthogService);
  });

  describe('init', () => {
    it('should call posthog.init with environment config', () => {
      service.init();

      expect(posthog.init).toHaveBeenCalledWith('phc_test_key', {
        api_host: 'https://eu.i.posthog.com',
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        persistence: 'localStorage',
      });
    });

    it('should not initialize twice', () => {
      service.init();
      service.init();

      expect(posthog.init).toHaveBeenCalledTimes(1);
    });

    it('should skip init when API key is empty', () => {
      (environment as any).posthogApiKey = '';
      const freshService = new PosthogService();
      freshService.init();

      expect(posthog.init).not.toHaveBeenCalled();

      (environment as any).posthogApiKey = 'phc_test_key';
    });
  });

  describe('identify', () => {
    const mockUser: AppUser = {
      id: 'user-123',
      email: 'test@example.com',
      tenantId: 'tenant-456',
      roles: ['learner', 'tenant_admin'],
      claims: {
        tenant_id: 'tenant-456',
        is_tenant_admin: true,
        is_platform_admin: false,
        csm_tenant_ids: [],
        lecturer_course_ids: [],
        lecturer_can_edit_course_ids: [],
        lecturer_can_grade_course_ids: [],
      },
    };

    it('should call posthog.identify with user properties after init', () => {
      service.init();
      service.identify(mockUser);

      expect(posthog.identify).toHaveBeenCalledWith('user-123', {
        email: 'test@example.com',
        tenant_id: 'tenant-456',
        roles: ['learner', 'tenant_admin'],
      });
    });

    it('should not identify before init', () => {
      service.identify(mockUser);
      expect(posthog.identify).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should call posthog.reset after init', () => {
      service.init();
      service.reset();
      expect(posthog.reset).toHaveBeenCalled();
    });

    it('should not reset before init', () => {
      service.reset();
      expect(posthog.reset).not.toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    it('should call posthog.capture with event and properties after init', () => {
      service.init();
      service.capture('quiz_started', { quiz_id: 'q-1', attempt_number: 1 });

      expect(posthog.capture).toHaveBeenCalledWith('quiz_started', {
        quiz_id: 'q-1',
        attempt_number: 1,
      });
    });

    it('should not capture before init', () => {
      service.capture('quiz_started', { quiz_id: 'q-1' });
      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should capture without properties', () => {
      service.init();
      service.capture('page_viewed');

      expect(posthog.capture).toHaveBeenCalledWith('page_viewed', undefined);
    });
  });
});
