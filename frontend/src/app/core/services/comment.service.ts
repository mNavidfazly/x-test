import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Comment } from '../models/comment.model';

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
          author:profiles!user_id(full_name, email),
          comment_replies(
            *,
            author:profiles!user_id(full_name, email)
          )
        `)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const fallbackAuthor = { full_name: null, email: 'Unknown user' };
      const comments = (data ?? []).map((c: any) => ({
        ...c,
        author: c.author ?? fallbackAuthor,
        replies: (c.comment_replies ?? []).sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        ).map((r: any) => ({ ...r, author: r.author ?? fallbackAuthor })),
      })) as Comment[];

      this.#comments.set(comments);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      this.#error.set(msg || 'Failed to load comments');
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

    if (error) throw new Error(error.message);
    await this.loadComments(this.#currentModuleId);
  }

  async updateComment(commentId: string, body: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comments')
      .update({ body })
      .eq('id', commentId);

    if (error) throw new Error(error.message);
    await this.loadComments(this.#currentModuleId);
  }

  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw new Error(error.message);
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

    if (error) throw new Error(error.message);
    await this.loadComments(this.#currentModuleId);
  }

  async updateReply(replyId: string, body: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comment_replies')
      .update({ body })
      .eq('id', replyId);

    if (error) throw new Error(error.message);
    await this.loadComments(this.#currentModuleId);
  }

  async deleteReply(replyId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('comment_replies')
      .delete()
      .eq('id', replyId);

    if (error) throw new Error(error.message);
    await this.loadComments(this.#currentModuleId);
  }
}
