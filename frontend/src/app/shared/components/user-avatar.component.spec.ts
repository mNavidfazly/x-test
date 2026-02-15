import { render, screen } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  it('should render img when avatarUrl is provided', async () => {
    await render(UserAvatarComponent, {
      componentInputs: {
        avatarUrl: 'https://example.com/avatar.jpg',
        name: 'John Doe',
      },
    });

    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
    expect(img.getAttribute('alt')).toBe('John Doe');
  });

  it('should render initials fallback when avatarUrl is null', async () => {
    await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'John Doe' },
    });

    expect(screen.getByText('JD')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should compute initials from email', async () => {
    await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'alice@example.com' },
    });

    expect(screen.getByText('AE')).toBeTruthy();
  });

  it('should apply sm size classes by default', async () => {
    const { container } = await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'Test User' },
    });

    const div = container.querySelector('.w-8.h-8');
    expect(div).toBeTruthy();
  });

  it('should apply xs size classes', async () => {
    const { container } = await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'Test', size: 'xs' },
    });

    const div = container.querySelector('.w-6.h-6');
    expect(div).toBeTruthy();
  });

  it('should apply lg size classes', async () => {
    const { container } = await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'Test', size: 'lg' },
    });

    const div = container.querySelector('.w-28.h-28');
    expect(div).toBeTruthy();
  });

  it('should apply slate color variant', async () => {
    const { container } = await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'Test', color: 'slate' },
    });

    const div = container.querySelector('.bg-slate-100');
    expect(div).toBeTruthy();
  });

  it('should apply teal color by default', async () => {
    const { container } = await render(UserAvatarComponent, {
      componentInputs: { avatarUrl: null, name: 'Test' },
    });

    const div = container.querySelector('.bg-teal-100');
    expect(div).toBeTruthy();
  });
});
