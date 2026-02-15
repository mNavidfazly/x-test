import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Comment, CommentAuthor } from '../models/comment.model';
import { extractErrorMessage } from '../utils/error.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';

@Injectable({ providedIn: 'root' })
export class CommentService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #comments = signal<Comment[]>([]);
  #loading = signal(false);
  #error = signal('');
  #currentModuleId = '';

  readonly comments = this.#comments.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadComments(moduleId: string): Promise<void> {
    this.#currentModuleId = moduleId;
    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('comments')
        .select(`
          *,
          author:profiles!user_id(full_name, email, avatar_url),
          comment_replies(
            *,
            author:profiles!user_id(full_name, email, avatar_url)
          )
        `)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const fallbackAuthor: CommentAuthor = { full_name: null, email: 'Unknown user', avatar_url: null };
      const comments = (data ?? []).map((c: any) => ({
        ...c,
        author: c.author ?? fallbackAuthor,
        replies: (c.comment_replies ?? []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ).map((r: any) => ({ ...r, author: r.author ?? fallbackAuthor })),
      })) as Comment[];

      // Batch-resolve avatar URLs for all comment/reply authors
      const allAuthors: CommentAuthor[] = [];
      for (const c of comments) {
        if (c.author) allAuthors.push(c.author);
        for (const r of c.replies) {
          if (r.author) allAuthors.push(r.author);
        }
      }
      await resolveAvatarUrls(this.#supabase.client, allAuthors);

      this.#comments.set(comments);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load comments'));
    } finally {
      this.#loading.set(false);
    }
  }

  async addComment(moduleId: string, body: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('comments')
      .insert({
        module_id: moduleId,
        user_id: user.id,
        tenant_id: user.claims.tenant_id,
        body,
      });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to add comment'));
    await this.loadComments(this.#currentModuleId);
  }

  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comments')
      .update({ body })
      .eq('id', commentId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update comment'));
    await this.loadComments(this.#currentModuleId);
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete comment'));
    await this.loadComments(this.#currentModuleId);
  }

  async addReply(commentId: string, body: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('comment_replies')
      .insert({
        comment_id: commentId,
        user_id: user.id,
        tenant_id: user.claims.tenant_id,
        body,
      });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to add reply'));
    await this.loadComments(this.#currentModuleId);
  }

  async updateReply(replyId: string, body: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comment_replies')
      .update({ body })
      .eq('id', replyId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update reply'));
    await this.loadComments(this.#currentModuleId);
  }

  async deleteReply(replyId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comment_replies')
      .delete()
      .eq('id', replyId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete reply'));
    await this.loadComments(this.#currentModuleId);
  }
}
