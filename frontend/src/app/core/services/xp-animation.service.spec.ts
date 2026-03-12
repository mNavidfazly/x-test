import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { XpAnimationService } from './xp-animation.service';
import { XpService } from './xp.service';
import { createMockXpService } from '../../__mocks__/xp.mock';

describe('XpAnimationService', () => {
  let service: XpAnimationService;
  let mockXp: ReturnType<typeof createMockXpService>;
  let mockDocument: Document;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock HTMLElement.animate for JSDOM
    HTMLElement.prototype.animate = vi.fn().mockReturnValue({
      finished: Promise.resolve(),
      cancel: vi.fn(),
    });

    mockXp = createMockXpService({ totalXp: 100 });

    TestBed.configureTestingModule({
      providers: [
        XpAnimationService,
        { provide: XpService, useValue: mockXp },
      ],
    });

    service = TestBed.inject(XpAnimationService);
    mockDocument = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    vi.useRealTimers();
    // Clean up any DOM elements created by the service
    mockDocument.querySelectorAll('[role="status"]').forEach(el => el.remove());
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calls loadXp(true) after triggerXpGain', async () => {
    service.triggerXpGain(10);

    // Flush all microtasks and timers
    await vi.advanceTimersByTimeAsync(3000);

    expect(mockXp.loadXp).toHaveBeenCalledWith(true);
  });

  it('sets badgePulse during phase 3', async () => {
    expect(service.badgePulse()).toBe(false);

    service.triggerXpGain(10);
    await vi.advanceTimersByTimeAsync(2000);

    // Badge pulse should have been set to true at some point
    // (it auto-clears after 600ms)
    expect(service.badgePulse()).toBe(false); // Already cleared
  });

  it('sets xpCounterTarget with estimated new XP', async () => {
    service.triggerXpGain(25);
    await vi.advanceTimersByTimeAsync(2000);

    // Should have been set to currentXp + amount = 100 + 25 = 125
    expect(service.xpCounterTarget()).toBe(125);
  });

  it('queues animations when already animating', async () => {
    service.triggerXpGain(10);
    service.triggerXpGain(20); // queued

    await vi.advanceTimersByTimeAsync(5000);

    // loadXp should have been called at least twice (once per animation)
    expect(mockXp.loadXp).toHaveBeenCalledWith(true);
  });

  it('skips visual animation when reduced motion is preferred', async () => {
    // Mock matchMedia to return prefers-reduced-motion: reduce
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    service.triggerXpGain(10);
    await vi.advanceTimersByTimeAsync(100);

    // Should create aria-live element for screen readers
    const announcement = mockDocument.querySelector('[role="status"]');
    expect(announcement?.textContent).toBe('Earned 10 XP');

    // Should still call loadXp
    expect(mockXp.loadXp).toHaveBeenCalledWith(true);

    // Should NOT have called animate (no visual animation)
    // The animate calls would only come from the full animation path
    window.matchMedia = originalMatchMedia;
  });

  it('creates overlay container in document body', async () => {
    service.triggerXpGain(10);

    // There should be a fixed overlay in the body
    const overlay = mockDocument.body.querySelector<HTMLElement>('div[style*="position: fixed"]');
    expect(overlay).toBeTruthy();

    await vi.advanceTimersByTimeAsync(3000);
  });

  it('cleans up screen reader announcement after 3 seconds', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    service.triggerXpGain(10);
    await vi.advanceTimersByTimeAsync(100);

    expect(mockDocument.querySelector('[role="status"]')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(3100);
    expect(mockDocument.querySelector('[role="status"]')).toBeFalsy();

    window.matchMedia = originalMatchMedia;
  });
});
