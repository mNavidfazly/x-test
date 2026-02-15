import { render, screen } from '@testing-library/angular';
import { EmptyStateComponent } from './empty-state.component';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';
import { Users } from 'lucide-angular';

describe('EmptyStateComponent', () => {
  it('should render the message', async () => {
    await render(EmptyStateComponent, {
      componentImports: [MockLucideIconComponent],
      inputs: { icon: Users, message: 'No users found.' },
    });
    expect(screen.getByText('No users found.')).toBeTruthy();
  });

  it('should render an icon', async () => {
    const { container } = await render(EmptyStateComponent, {
      componentImports: [MockLucideIconComponent],
      inputs: { icon: Users, message: 'No data.' },
    });
    expect(container.querySelector('lucide-icon')).toBeTruthy();
  });

  it('should center content', async () => {
    const { container } = await render(EmptyStateComponent, {
      componentImports: [MockLucideIconComponent],
      inputs: { icon: Users, message: 'Empty' },
    });
    expect(container.querySelector('.text-center')).toBeTruthy();
  });
});
