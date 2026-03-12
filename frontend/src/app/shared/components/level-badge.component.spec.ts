import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LevelBadgeComponent } from './level-badge.component';
import { XpService, LEVELS } from '../../core/services/xp.service';
import { AuthService } from '../../core/services/auth.service';
import { createMockXpService } from '../../__mocks__/xp.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

@Component({ selector: 'lucide-icon', standalone: true, template: '', inputs: ['img', 'size'] })
class MockLucideIconComponent {}

async function renderBadge(options?: {
  roles?: string[];
  totalXp?: number;
  loading?: boolean;
}) {
  const mockAuth = createMockAuthService({
    isAuthenticated: true,
    roles: (options?.roles as any) ?? ['learner'],
  });
  const mockXp = createMockXpService({ totalXp: options?.totalXp ?? 150 });
  if (options?.loading) mockXp._setLoading(true);

  const result = await render(LevelBadgeComponent, {
    componentImports: [MockLucideIconComponent, DecimalPipe],
    providers: [
      { provide: AuthService, useValue: mockAuth },
      { provide: XpService, useValue: mockXp },
    ],
  });

  return { ...result, mockXp, mockAuth };
}

describe('LevelBadgeComponent', () => {
  it('renders badge for learner role', async () => {
    await renderBadge({ totalXp: 150 });
    expect(screen.getByRole('button', { name: /level 3/i })).toBeTruthy();
  });

  it('does not render for platform_admin', async () => {
    await renderBadge({ roles: ['platform_admin'] });
    expect(screen.queryByRole('button', { name: /level/i })).toBeNull();
  });

  it('does not render for tenant_admin', async () => {
    await renderBadge({ roles: ['tenant_admin', 'learner'] });
    expect(screen.queryByRole('button', { name: /level/i })).toBeNull();
  });

  it('shows correct level number in badge', async () => {
    await renderBadge({ totalXp: 700 });
    expect(screen.getByRole('button', { name: /level 5.*scholar/i })).toBeTruthy();
  });

  it('shows loading skeleton when loading with zero XP', async () => {
    await renderBadge({ totalXp: 0, loading: true });
    expect(screen.queryByRole('button', { name: /level/i })).toBeNull();
    // Should show skeleton
    const container = document.querySelector('.skeleton-bar');
    expect(container).toBeTruthy();
  });

  it('opens popover on click and shows level name', async () => {
    await renderBadge({ totalXp: 150 });
    const badge = screen.getByRole('button', { name: /level 3/i });
    await fireEvent.click(badge);

    expect(screen.getByRole('dialog', { name: /xp details/i })).toBeTruthy();
    expect(screen.getByText('Learner')).toBeTruthy();
  });

  it('shows XP total in popover', async () => {
    await renderBadge({ totalXp: 150 });
    const badge = screen.getByRole('button', { name: /level 3/i });
    await fireEvent.click(badge);

    expect(screen.getAllByText('150 XP').length).toBeGreaterThanOrEqual(1);
  });

  it('shows breakdown categories in popover', async () => {
    const { mockXp } = await renderBadge({ totalXp: 100 });
    mockXp._setBreakdown({
      total: 100,
      modules: 50,
      quizzes: 30,
      exams: 10,
      knowledgeChecks: 5,
      engagement: 5,
    });

    const badge = screen.getByRole('button', { name: /level/i });
    await fireEvent.click(badge);

    expect(screen.getByText('Modules')).toBeTruthy();
    expect(screen.getByText('Quizzes')).toBeTruthy();
    expect(screen.getByText('Exams')).toBeTruthy();
    expect(screen.getByText('Knowledge Checks')).toBeTruthy();
    expect(screen.getByText('Engagement')).toBeTruthy();
  });

  it('shows max level message at level 10', async () => {
    await renderBadge({ totalXp: 5000 });
    const badge = screen.getByRole('button', { name: /level 10/i });
    await fireEvent.click(badge);

    expect(screen.getByText('Max level reached')).toBeTruthy();
  });

  it('closes popover on backdrop click', async () => {
    await renderBadge({ totalXp: 150 });
    const badge = screen.getByRole('button', { name: /level 3/i });
    await fireEvent.click(badge);
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Click the backdrop (fixed inset-0 div)
    const backdrop = document.querySelector('.fixed.inset-0');
    await fireEvent.click(backdrop!);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows level-up celebration', async () => {
    const { fixture, mockXp } = await renderBadge({ totalXp: 650 });
    mockXp._setLevelUp(LEVELS[4]); // Scholar
    fixture.detectChanges();

    expect(screen.getByText('Level Up!')).toBeTruthy();
    expect(screen.getByText('Scholar')).toBeTruthy();
  });

  it('has correct aria-label with level info', async () => {
    await renderBadge({ totalXp: 350 });
    const badge = screen.getByRole('button');
    expect(badge.getAttribute('aria-label')).toContain('Level 4');
    expect(badge.getAttribute('aria-label')).toContain('Student');
    expect(badge.getAttribute('aria-label')).toContain('350 XP');
  });
});
