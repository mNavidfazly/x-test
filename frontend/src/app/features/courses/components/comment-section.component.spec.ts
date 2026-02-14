import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { CommentSectionComponent } from './comment-section.component';
import { CommentService } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  createMockCommentService, createMockComment, createMockCommentReply,
} from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';

describe('CommentSectionComponent', () => {
  const renderSection = async (options?: {
    comments?: ReturnType<typeof createMockComment>[];
    loading?: boolean;
    error?: string;
    userId?: string;
    tenantId?: string;
    claims?: { is_platform_admin?: boolean; is_tenant_admin?: boolean; tenant_id?: string };
  }) => {
    const mockCommentService = createMockCommentService({
      comments: options?.comments ?? [],
      loading: options?.loading ?? false,
      error: options?.error ?? '',
    });

    const mockAuthService = createMockAuthService({
      isAuthenticated: true,
      userId: options?.userId ?? 'user-1',
      tenantId: options?.tenantId ?? 'tenant-1',
      claims: options?.claims ?? {},
    });

    const toast = createMockToastService();

    const result = await render(CommentSectionComponent, {
      componentInputs: { moduleId: 'module-1', courseId: 'course-1' },
      providers: [
        { provide: CommentService, useValue: mockCommentService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ToastService, useValue: toast },
      ],
    });

    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, mockCommentService, mockAuthService, toast };
  };

  it('shows empty state when no comments', async () => {
    await renderSection();
    expect(screen.getByText(/No comments yet/)).toBeTruthy();
  });

  it('renders discussion header with count', async () => {
    const comments = [createMockComment({ id: 'c1' }), createMockComment({ id: 'c2' })];
    await renderSection({ comments });
    expect(screen.getByText('Discussion (2)')).toBeTruthy();
  });

  it('renders comment with author name', async () => {
    const comments = [createMockComment({ author: { full_name: 'Alice Smith', email: 'alice@test.com' } })];
    await renderSection({ comments });
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('This is a comment')).toBeTruthy();
  });

  it('renders expert badge for lecturer comments', async () => {
    const comments = [createMockComment({ badge_type: 'expert' })];
    await renderSection({ comments });
    expect(screen.getByText('Expert')).toBeTruthy();
  });

  it('renders calypso badge for PA/CSM comments', async () => {
    const comments = [createMockComment({ badge_type: 'calypso' })];
    await renderSection({ comments });
    expect(screen.getByText('Calypso')).toBeTruthy();
  });

  it('shows edit and delete buttons for own comments', async () => {
    const comments = [createMockComment({ user_id: 'user-1' })];
    await renderSection({ userId: 'user-1', comments });
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides edit button for other users comments', async () => {
    const comments = [createMockComment({ user_id: 'other-user' })];
    await renderSection({ userId: 'user-1', comments });
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('shows delete for tenant admin on same-tenant comments', async () => {
    const comments = [createMockComment({ user_id: 'other-user', tenant_id: 'tenant-1' })];
    await renderSection({
      userId: 'user-1',
      tenantId: 'tenant-1',
      claims: { is_tenant_admin: true, tenant_id: 'tenant-1' },
      comments,
    });
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('shows delete for platform admin on any comment', async () => {
    const comments = [createMockComment({ user_id: 'other-user', tenant_id: 'other-tenant' })];
    await renderSection({
      userId: 'user-1',
      tenantId: 'tenant-1',
      claims: { is_platform_admin: true },
      comments,
    });
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('hides delete for regular user on other user comment', async () => {
    const comments = [createMockComment({ user_id: 'other-user', tenant_id: 'tenant-1' })];
    await renderSection({ userId: 'user-1', tenantId: 'tenant-1', comments });
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('renders replies indented under comment', async () => {
    const reply = createMockCommentReply({ body: 'A thoughtful reply', author: { full_name: 'Bob', email: 'bob@test.com' } });
    const comments = [createMockComment({ replies: [reply] })];
    await renderSection({ comments });
    expect(screen.getByText('A thoughtful reply')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('calls addComment on form submission', async () => {
    const { mockCommentService } = await renderSection();

    const textarea = screen.getByPlaceholderText('Write a comment...');
    fireEvent.input(textarea, { target: { value: 'My new comment' } });

    const postBtn = screen.getByText('Post Comment');
    fireEvent.click(postBtn);

    await new Promise(r => setTimeout(r));

    expect(mockCommentService.addComment).toHaveBeenCalledWith('module-1', 'My new comment');
  });

  it('shows reply form when Reply is clicked', async () => {
    const comments = [createMockComment()];
    await renderSection({ comments });

    fireEvent.click(screen.getByText('Reply'));

    expect(screen.getByPlaceholderText('Write a reply...')).toBeTruthy();
    expect(screen.getByText('Post Reply')).toBeTruthy();
  });

  it('calls addReply on reply submission', async () => {
    const comments = [createMockComment({ id: 'c1' })];
    const { mockCommentService } = await renderSection({ comments });

    fireEvent.click(screen.getByText('Reply'));

    const replyTextarea = screen.getByPlaceholderText('Write a reply...');
    fireEvent.input(replyTextarea, { target: { value: 'My reply' } });
    fireEvent.click(screen.getByText('Post Reply'));

    await new Promise(r => setTimeout(r));

    expect(mockCommentService.addReply).toHaveBeenCalledWith('c1', 'My reply');
  });

  it('shows loading state', async () => {
    await renderSection({ loading: true });
    const container = screen.getByText('Discussion (0)').closest('div');
    expect(container?.innerHTML).toContain('animate-pulse');
  });

  it('shows error state', async () => {
    await renderSection({ error: 'Something went wrong' });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  describe('formatRelativeTime', () => {
    it('shows just now for recent timestamps', async () => {
      const now = new Date().toISOString();
      const comments = [createMockComment({ created_at: now })];
      await renderSection({ comments });
      expect(screen.getByText('just now')).toBeTruthy();
    });
  });
});
