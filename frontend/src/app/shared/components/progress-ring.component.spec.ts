import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  it('should render with given percent', async () => {
    await render(ProgressRingComponent, {
      componentInputs: { percent: 30 },
    });
    const svg = screen.getByRole('img', { name: '30% complete' });
    expect(svg).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
  });

  it('should set stroke-dashoffset based on percent', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 75 },
    });
    const circles = container.querySelectorAll('circle');
    const progressCircle = circles[1];
    expect(progressCircle.getAttribute('stroke-dashoffset')).toBe('25');
  });

  it('should show 0% with full dashoffset', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 0 },
    });
    const circles = container.querySelectorAll('circle');
    expect(circles[1].getAttribute('stroke-dashoffset')).toBe('100');
  });

  it('should show percentage label by default', async () => {
    await render(ProgressRingComponent, {
      componentInputs: { percent: 50 },
    });
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('should hide label when showLabel is false', async () => {
    await render(ProgressRingComponent, {
      componentInputs: { percent: 50, showLabel: false },
    });
    expect(screen.queryByText('50%')).toBeNull();
  });

  it('should use emerald stroke at 100%', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 100 },
    });
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.classList.contains('stroke-emerald-500')).toBe(true);
  });

  it('should use teal stroke below 100%', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 50 },
    });
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.classList.contains('stroke-teal-500')).toBe(true);
  });

  it('should apply md size class by default', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 50 },
    });
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-12')).toBe(true);
    expect(svg?.classList.contains('h-12')).toBe(true);
  });

  it('should apply sm size class', async () => {
    const { container } = await render(ProgressRingComponent, {
      componentInputs: { percent: 50, size: 'sm' },
    });
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-8')).toBe(true);
  });
});
