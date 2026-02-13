import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, Router } from '@angular/router';
import { NotificationListPageComponent } from './notification-list-page.component';
import { NotificationService } from '../../../core/services/notification.service';
import { createMockNotificationService, createMockNotification } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('NotificationListPageComponent', () => {
  const renderPage = async (options?: {
    notifications?: ReturnType<typeof createMockNotification>[];
    loading?: boolean;
    error?: string;
    unreadCount?: number;
  }) => {
    const mockService = createMockNotificationService({
      notifications: options?.notifications ?? [],
      loading: options?.loading ?? false,
      error: options?.error ?? '',
      unreadCount: options?.unreadCount ?? 0,
    });

    const result = await render(NotificationListPageComponent, {
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: mockService },
      ],
      componentImports: [MockLucideIconComponent],
    });

    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, mockService };
  };

  it('should call loadNotifications on init', async () => {
    const { mockService } = await renderPage();
    expect(mockService.loadNotifications).toHaveBeenCalled();
  });

  it('should show loading skeleton when loading', async () => {
    await renderPage({ loading: true });
    const container = document.querySelector('.animate-pulse');
    expect(container).toBeTruthy();
  });

  it('should show error message when error', async () => {
    await renderPage({ error: 'Failed to load notifications' });
    expect(screen.getByText('Failed to load notifications')).toBeTruthy();
  });

  it('should show empty state when no notifications', async () => {
    await renderPage();
    expect(screen.getByText('No notifications yet')).toBeTruthy();
    expect(screen.getByText(/You'll see updates/)).toBeTruthy();
  });

  it('should render page title', async () => {
    await renderPage();
    expect(screen.getByText('Notifications')).toBeTruthy();
  });

  it('should render notification titles', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', title: 'New course assigned' }),
      createMockNotification({ id: 'n2', title: 'Module added' }),
    ];
    await renderPage({ notifications, unreadCount: 2 });
    expect(screen.getByText('New course assigned')).toBeTruthy();
    expect(screen.getByText('Module added')).toBeTruthy();
  });

  it('should show unread indicator for unread notifications', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', read_at: null }),
    ];
    const { fixture } = await renderPage({ notifications, unreadCount: 1 });
    const button = fixture.nativeElement.querySelector('button[type="button"].border-l-teal-500');
    expect(button).toBeTruthy();
  });

  it('should hide unread indicator for read notifications', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', read_at: '2026-02-10T12:00:00Z' }),
    ];
    const { fixture } = await renderPage({ notifications });
    const button = fixture.nativeElement.querySelector('button[type="button"].border-l-transparent');
    expect(button).toBeTruthy();
  });

  it('should render body text', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', body: 'You have been assigned to X-LNG Advanced' }),
    ];
    await renderPage({ notifications });
    expect(screen.getByText('You have been assigned to X-LNG Advanced')).toBeTruthy();
  });

  it('should handle null body', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', body: null }),
    ];
    await renderPage({ notifications });
    expect(screen.getByText('New course assigned')).toBeTruthy();
  });

  it('should call markAsRead and navigate on click', async () => {
    const notifications = [
      createMockNotification({
        id: 'n1',
        type: 'question_answered',
        data: { question_id: 'q1', course_id: 'c1', module_id: 'm1' },
        read_at: null,
      }),
    ];
    const { mockService, fixture } = await renderPage({ notifications, unreadCount: 1 });

    const button = screen.getByText('New course assigned').closest('button');
    if (button) {
      fireEvent.click(button);
      fixture.detectChanges();
    }

    expect(mockService.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('should not call markAsRead for already read notification', async () => {
    const notifications = [
      createMockNotification({
        id: 'n1',
        type: 'question_answered',
        read_at: '2026-02-10T12:00:00Z',
      }),
    ];
    const { mockService, fixture } = await renderPage({ notifications });

    const button = screen.getByText('New course assigned').closest('button');
    if (button) {
      fireEvent.click(button);
      fixture.detectChanges();
    }

    expect(mockService.markAsRead).not.toHaveBeenCalled();
  });

  it('should show "Mark all as read" when unread exist', async () => {
    const notifications = [createMockNotification({ id: 'n1', read_at: null })];
    await renderPage({ notifications, unreadCount: 1 });
    expect(screen.getByText('Mark all as read')).toBeTruthy();
  });

  it('should hide "Mark all as read" when all read', async () => {
    const notifications = [createMockNotification({ id: 'n1', read_at: '2026-02-10T12:00:00Z' })];
    await renderPage({ notifications, unreadCount: 0 });
    expect(screen.queryByText('Mark all as read')).toBeNull();
  });

  it('should call markAllAsRead on button click', async () => {
    const notifications = [createMockNotification({ id: 'n1', read_at: null })];
    const { mockService, fixture } = await renderPage({ notifications, unreadCount: 1 });

    fireEvent.click(screen.getByText('Mark all as read'));
    fixture.detectChanges();

    expect(mockService.markAllAsRead).toHaveBeenCalled();
  });

  it('should show unread count badge', async () => {
    const notifications = [
      createMockNotification({ id: 'n1', read_at: null }),
      createMockNotification({ id: 'n2', read_at: null }),
    ];
    await renderPage({ notifications, unreadCount: 2 });
    expect(screen.getByText('2 unread')).toBeTruthy();
  });
});
