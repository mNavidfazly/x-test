import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CommentService } from './comment.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('CommentService', () => {
  let service: CommentService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1', tenantId: 'tenant-1', claims: { tenant_id: 'tenant-1' } });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CommentService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(CommentService);
  });

  it('should have empty initial state', () => {
    expect(service.comments()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadComments', () => {
    it('should load comments with author and replies', async () => {
      const mockComments = [
        {
          id: 'c1', user_id: 'user-1', tenant_id: 'tenant-1', module_id: 'mod-1',
          body: 'Hello', badge_type: null, created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
          author: { full_name: 'Test User', email: 'test@example.com' },
          comment_replies: [
            {
              id: 'r1', comment_id: 'c1', user_id: 'user-2', tenant_id: 'tenant-1',
              body: 'Reply', badge_type: 'expert', created_at: '2026-02-01T11:00:00Z', updated_at: '2026-02-01T11:00:00Z',
              author: { full_name: 'Expert', email: 'expert@example.com' },
            },
          ],
        },
      ];
      supabase._mockQueryResponse(mockComments);

      await service.loadComments('mod-1');

      expect(service.comments().length).toBe(1);
      expect(service.comments()[0].body).toBe('Hello');
      expect(service.comments()[0].replies.length).toBe(1);
      expect(service.comments()[0].replies[0].badge_type).toBe('expert');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should handle empty comments', async () => {
      supabase._mockQueryResponse([]);

      await service.loadComments('mod-1');

      expect(service.comments()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'DB error' });

      await service.loadComments('mod-1');

      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });
  });

  describe('addComment', () => {
    it('should insert comment and reload', async () => {
      // First call: insert, second call: reload
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.addComment('mod-1', 'New comment');

      expect(supabase.client.from).toHaveBeenCalledWith('comments');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          module_id: 'mod-1',
          body: 'New comment',
          user_id: 'user-1',
          tenant_id: 'tenant-1',
        }),
      );
    });

    it('should throw on error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Insert failed' } }),
      );

      await expect(service.addComment('mod-1', 'text')).rejects.toThrow('Insert failed');
    });
  });

  describe('updateComment', () => {
    it('should update comment body and reload', async () => {
      // First: load to set currentModuleId
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      // Setup for update + reload
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.updateComment('c1', 'Updated body');

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ body: 'Updated body' });
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Update failed' } }),
      );

      await expect(service.updateComment('c1', 'text')).rejects.toThrow('Update failed');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment and reload', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.deleteComment('c1');

      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Delete failed' } }),
      );

      await expect(service.deleteComment('c1')).rejects.toThrow('Delete failed');
    });
  });

  describe('addReply', () => {
    it('should insert reply and reload', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.addReply('c1', 'A reply');

      expect(supabase.client.from).toHaveBeenCalledWith('comment_replies');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          comment_id: 'c1',
          body: 'A reply',
          user_id: 'user-1',
          tenant_id: 'tenant-1',
        }),
      );
    });
  });

  describe('updateReply', () => {
    it('should update reply body and reload', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.updateReply('r1', 'Updated reply');

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ body: 'Updated reply' });
    });
  });

  describe('deleteReply', () => {
    it('should delete reply and reload', async () => {
      supabase._mockQueryResponse([]);
      await service.loadComments('mod-1');

      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.deleteReply('r1');

      expect(supabase.client.from).toHaveBeenCalledWith('comment_replies');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });
});
