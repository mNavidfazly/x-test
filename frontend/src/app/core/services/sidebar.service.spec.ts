import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SidebarService } from './sidebar.service';

describe('SidebarService', () => {
  let service: SidebarService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidebarService);
  });

  it('should default to expanded (collapsed = false)', () => {
    expect(service.collapsed()).toBe(false);
  });

  it('should toggle collapsed state', () => {
    service.toggle();
    expect(service.collapsed()).toBe(true);

    service.toggle();
    expect(service.collapsed()).toBe(false);
  });

  it('should explicitly collapse', () => {
    service.collapse();
    expect(service.collapsed()).toBe(true);
  });

  it('should explicitly expand', () => {
    service.collapse();
    expect(service.collapsed()).toBe(true);

    service.expand();
    expect(service.collapsed()).toBe(false);
  });

  it('should restore state from localStorage', () => {
    localStorage.setItem('sidebar-collapsed', 'true');

    // Need fresh TestBed to re-create service reading localStorage in constructor
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const restored = TestBed.inject(SidebarService);
    expect(restored.collapsed()).toBe(true);
  });
});
