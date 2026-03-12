import { signal } from '@angular/core';
import { vi } from 'vitest';
import { XpAnimationService } from '../core/services/xp-animation.service';

export function createMockXpAnimationService(): Partial<XpAnimationService> {
  return {
    triggerXpGain: vi.fn(),
    badgePulse: signal(false).asReadonly(),
    xpCounterTarget: signal<number | null>(null).asReadonly(),
  };
}
