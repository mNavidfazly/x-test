import { render, screen } from '@testing-library/angular';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  it('should render label and value', async () => {
    await render(StatCardComponent, {
      inputs: { label: 'Total Users', value: 42 },
    });
    expect(screen.getByText('Total Users')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('should apply default color to value', async () => {
    await render(StatCardComponent, {
      inputs: { label: 'Count', value: 10 },
    });
    expect(screen.getByText('10').className).toContain('text-slate-900');
  });

  it('should apply custom color to value', async () => {
    await render(StatCardComponent, {
      inputs: { label: 'Pending', value: 5, color: 'text-amber-600' },
    });
    expect(screen.getByText('5').className).toContain('text-amber-600');
  });

  it('should render string values', async () => {
    await render(StatCardComponent, {
      inputs: { label: 'Progress', value: '85%' },
    });
    expect(screen.getByText('85%')).toBeTruthy();
  });

  it('should apply stat-card class', async () => {
    const { container } = await render(StatCardComponent, {
      inputs: { label: 'Test', value: 0 },
    });
    expect(container.querySelector('.stat-card')).toBeTruthy();
  });
});
