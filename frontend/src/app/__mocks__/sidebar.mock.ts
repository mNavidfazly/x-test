import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SidebarService } from '../core/services/sidebar.service';

export function createMockSidebarService(options?: {
  collapsed?: boolean;
}): Partial<SidebarService> {
  return {
    collapsed: signal(options?.collapsed ?? false),
    toggle: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn(),
  };
}
