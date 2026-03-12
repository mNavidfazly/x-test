import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { XpService } from './xp.service';

// ── Star SVG for particles ──────────────────────────────────────────

const STAR_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>`;

const GOLDEN_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#f97316', '#eab308'];

// ── Particle Tier ───────────────────────────────────────────────────

interface ParticleTier {
  count: number;
  minSize: number;
  maxSize: number;
  minDistance: number;
  maxDistance: number;
}

function getParticleTier(amount: number): ParticleTier {
  if (amount <= 5) return { count: 8, minSize: 6, maxSize: 12, minDistance: 60, maxDistance: 140 };
  if (amount <= 10) return { count: 12, minSize: 8, maxSize: 14, minDistance: 70, maxDistance: 160 };
  if (amount <= 20) return { count: 16, minSize: 10, maxSize: 16, minDistance: 80, maxDistance: 200 };
  return { count: 22, minSize: 10, maxSize: 18, minDistance: 80, maxDistance: 220 };
}

// ── Service ─────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class XpAnimationService {
  #document = inject(DOCUMENT);
  #xpService = inject(XpService);

  #animating = false;
  #queue: number[] = [];

  /** LevelBadgeComponent watches this to pulse the badge */
  readonly badgePulse = signal(false);

  /** LevelBadgeComponent watches this to animate XP counter */
  readonly xpCounterTarget = signal<number | null>(null);

  triggerXpGain(amount: number): void {
    if (this.#animating) {
      this.#queue.push(amount);
      return;
    }
    this.#runAnimation(amount);
  }

  async #runAnimation(amount: number): Promise<void> {
    this.#animating = true;

    // Respect reduced motion preference
    const prefersReducedMotion = this.#document.defaultView
      ?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    if (prefersReducedMotion) {
      this.#announceForScreenReader(amount);
      this.#finalize(amount);
      return;
    }

    try {
      const container = this.#createOverlay();
      const pill = this.#createPill(amount, container);

      // Phase 1: Splash + particles
      await this.#phase1Splash(pill, amount, container);

      // Phase 2: Fly to badge
      await this.#phase2FlyToBadge(pill, container);

      // Cleanup splash container
      container.remove();

      // Phase 3: Badge react
      await this.#phase3BadgeReact(amount);
    } catch {
      // If animation fails for any reason, still finalize
    }

    this.#finalize(amount);
  }

  // ── Phase 1: Splash ─────────────────────────────────────────────

  async #phase1Splash(pill: HTMLElement, amount: number, container: HTMLElement): Promise<void> {
    // Animate pill entrance
    const pillAnim = pill.animate(
      [
        { transform: 'scale(0.5)', opacity: 0 },
        { transform: 'scale(1.1)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 400, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' },
    );

    // Spawn particles
    this.#spawnParticles(amount, container);

    await pillAnim.finished;
    // Hold for a moment
    await this.#wait(200);
  }

  // ── Phase 2: Fly to Badge ───────────────────────────────────────

  async #phase2FlyToBadge(pill: HTMLElement, container: HTMLElement): Promise<void> {
    const badge = this.#document.getElementById('xp-level-badge');
    const badgeRect = badge?.getBoundingClientRect();
    const win = this.#document.defaultView;

    if (!badgeRect || !win) {
      // No badge visible — fade out in place
      const fadeAnim = pill.animate(
        [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }],
        { duration: 300, easing: 'ease-out', fill: 'forwards' },
      );
      await fadeAnim.finished;
      return;
    }

    const startX = win.innerWidth / 2;
    const startY = win.innerHeight / 2;
    const endX = badgeRect.left + badgeRect.width / 2;
    const endY = badgeRect.top + badgeRect.height / 2;

    // Control point for bezier arc (arc upward)
    const cpX = (startX + endX) / 2;
    const cpY = Math.min(startY, endY) - 80;

    const flyAnim = pill.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        {
          transform: `translate(${cpX - startX}px, ${cpY - startY}px) scale(0.5)`,
          opacity: 0.8,
          offset: 0.4,
        },
        {
          transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.15)`,
          opacity: 0,
        },
      ],
      { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    );

    await flyAnim.finished;
  }

  // ── Phase 3: Badge React ────────────────────────────────────────

  async #phase3BadgeReact(amount: number): Promise<void> {
    // Pulse the badge
    this.badgePulse.set(true);
    setTimeout(() => this.badgePulse.set(false), 600);

    // Animate XP counter (optimistic estimate before server refresh)
    const currentXp = this.#xpService.totalXp();
    this.xpCounterTarget.set(currentXp + amount);

    await this.#wait(600);
  }

  // ── DOM Creation Helpers ────────────────────────────────────────

  #createOverlay(): HTMLElement {
    const container = this.#document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    this.#document.body.appendChild(container);
    return container;
  }

  #createPill(amount: number, container: HTMLElement): HTMLElement {
    const pill = this.#document.createElement('div');
    Object.assign(pill.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 24px',
      borderRadius: '9999px',
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: 'white',
      fontSize: '1.5rem',
      fontWeight: '800',
      fontFamily: 'Inter, system-ui, sans-serif',
      textShadow: '0 0 20px rgba(245, 158, 11, 0.6)',
      boxShadow: '0 0 30px rgba(245, 158, 11, 0.3), 0 4px 15px rgba(0, 0, 0, 0.1)',
      opacity: '0',
      willChange: 'transform, opacity',
    });

    // Star icon
    const starIcon = this.#document.createElement('span');
    starIcon.innerHTML = STAR_SVG;
    Object.assign(starIcon.style, { width: '24px', height: '24px', display: 'flex', flexShrink: '0' });
    pill.appendChild(starIcon);

    // Text
    const text = this.#document.createElement('span');
    text.textContent = `+${amount} XP`;
    pill.appendChild(text);

    container.appendChild(pill);
    return pill;
  }

  #spawnParticles(amount: number, container: HTMLElement): void {
    const tier = getParticleTier(amount);

    for (let i = 0; i < tier.count; i++) {
      const particle = this.#document.createElement('div');
      const size = tier.minSize + Math.random() * (tier.maxSize - tier.minSize);
      const color = GOLDEN_COLORS[Math.floor(Math.random() * GOLDEN_COLORS.length)];
      const angle = (Math.PI * 2 * i) / tier.count + (Math.random() - 0.5) * 0.5;
      const distance = tier.minDistance + Math.random() * (tier.maxDistance - tier.minDistance);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = Math.random() * 360;

      particle.innerHTML = STAR_SVG;
      Object.assign(particle.style, {
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        color,
        filter: `drop-shadow(0 0 ${size / 2}px ${color})`,
        willChange: 'transform, opacity',
      });

      container.appendChild(particle);

      const anim = particle.animate(
        [
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.2) rotate(${rotation}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 500,
          delay: 50 + Math.random() * 100,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fill: 'forwards',
        },
      );

      anim.finished.then(() => particle.remove()).catch(() => particle.remove());
    }
  }

  // ── Utilities ───────────────────────────────────────────────────

  #announceForScreenReader(amount: number): void {
    const el = this.#document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.className = 'sr-only';
    el.textContent = `Earned ${amount} XP`;
    this.#document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  #finalize(amount: number): void {
    // Reset counter target so LevelBadge syncs with real XP
    this.xpCounterTarget.set(null);

    // Refresh real XP from server
    this.#xpService.loadXp(true);

    this.#animating = false;

    // Process next in queue
    const next = this.#queue.shift();
    if (next !== undefined) {
      this.#runAnimation(next);
    }
  }

  #wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
