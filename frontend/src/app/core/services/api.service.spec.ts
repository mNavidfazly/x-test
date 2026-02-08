import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    const mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    });

    service = TestBed.inject(ApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have get method', () => {
    expect(typeof service.get).toBe('function');
  });

  it('should have post method', () => {
    expect(typeof service.post).toBe('function');
  });
});
