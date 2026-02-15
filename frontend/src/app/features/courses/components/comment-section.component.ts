import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
import { LucideAngularModule, MessageSquare, Reply, Pencil, Trash2, Loader2, GraduationCap, Building2, Send } from 'lucide-angular';
import { CommentService } from '../../../core/services/comment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Comment, CommentReply } from '../../../core/models/comment.model';
import { formatRelativeTime } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-comment-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div>
      <h3 class="section-label mb-4 flex items-center gap-2">
        <lucide-icon [img]="icons.MessageSquare" [size]="14"></lucide-icon>
        Discussion ({{ commentService.comments().length }})
      </h3>

      <!-- Add comment form -->
      <div class="mb-6">
        <textarea
          [value]="newCommentBody()"
          (input)="onNewCommentInput($event)"
          placeholder="Write a comment..."
          rows="3"
          class="input-field focus:outline-none resize-none"
        ></textarea>
        <div class="flex justify-end mt-2">
          <button
            type="button"
            (click)="onAddComment()"
            [disabled]="!newCommentBody().trim() || submitting()"
            class="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (submitting()) {
              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
            } @else {
              <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
            }
            Post Comment
          </button>
        </div>
      </div>

      @if (commentService.loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2]; track $index) {
            <div class="animate-pulse bg-slate-100 rounded-xl h-20"></div>
          }
        </div>
      } @else if (commentService.error()) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {{ commentService.error() }}
        </div>
      } @else if (commentService.comments().length === 0) {
        <p class="text-sm text-slate-400 text-center py-8">No comments yet. Be the first to start the discussion.</p>
      } @else {
        <div class="space-y-4">
          @for (comment of commentService.comments(); track comment.id) {
            <div class="bg-white border border-slate-200 rounded-xl p-4">
              <!-- Comment header -->
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold flex items-center justify-center shrink-0">
                  {{ getInitials(comment.author?.full_name ?? comment.author?.email ?? '?') }}
                </div>
                <span class="text-sm font-semibold text-slate-900">{{ comment.author?.full_name ?? comment.author?.email ?? 'Unknown' }}</span>
                @if (comment.badge_type === 'expert') {
                  <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                    <lucide-icon [img]="icons.GraduationCap" [size]="12"></lucide-icon>
                    Expert
                  </span>
                }
                @if (comment.badge_type === 'calypso') {
                  <span class="inline-flex items-center gap-1 bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                    <lucide-icon [img]="icons.Building2" [size]="12"></lucide-icon>
                    Calypso
                  </span>
                }
                <span class="text-xs text-slate-400 ml-auto">{{ formatRelativeTime(comment.created_at) }}</span>
              </div>

              <!-- Comment body or edit form -->
              @if (editingCommentId() === comment.id) {
                <textarea
                  [value]="editBody()"
                  (input)="onEditInput($event)"
                  rows="3"
                  class="input-field focus:outline-none resize-none mb-2"
                ></textarea>
                <div class="flex gap-2">
                  <button type="button" (click)="onSaveEditComment(comment.id)" [disabled]="submitting()" class="bg-teal-600 text-white rounded-lg px-3 py-1 text-xs font-semibold hover:bg-teal-700 transition-all duration-200 disabled:opacity-50">Save</button>
                  <button type="button" (click)="onCancelEdit()" class="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-slate-50 transition-all duration-200">Cancel</button>
                </div>
              } @else {
                <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ comment.body }}</p>
              }

              <!-- Comment actions -->
              @if (editingCommentId() !== comment.id) {
                <div class="flex items-center gap-3 mt-2">
                  <button type="button" (click)="onStartReply(comment.id)" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-all duration-200">
                    <lucide-icon [img]="icons.Reply" [size]="12"></lucide-icon>
                    Reply
                  </button>
                  @if (canEdit(comment)) {
                    <button type="button" (click)="onStartEditComment(comment)" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-all duration-200">
                      <lucide-icon [img]="icons.Pencil" [size]="12"></lucide-icon>
                      Edit
                    </button>
                  }
                  @if (canDelete(comment)) {
                    <button type="button" (click)="onDeleteComment(comment.id)" class="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 transition-all duration-200">
                      <lucide-icon [img]="icons.Trash2" [size]="12"></lucide-icon>
                      Delete
                    </button>
                  }
                </div>
              }

              <!-- Replies -->
              @for (reply of comment.replies; track reply.id) {
                <div class="ml-8 mt-3 border-l-2 border-slate-200 pl-4">
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center shrink-0">
                      {{ getInitials(reply.author?.full_name ?? reply.author?.email ?? '?') }}
                    </div>
                    <span class="text-sm font-semibold text-slate-900">{{ reply.author?.full_name ?? reply.author?.email ?? 'Unknown' }}</span>
                    @if (reply.badge_type === 'expert') {
                      <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                        <lucide-icon [img]="icons.GraduationCap" [size]="12"></lucide-icon>
                        Expert
                      </span>
                    }
                    @if (reply.badge_type === 'calypso') {
                      <span class="inline-flex items-center gap-1 bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                        <lucide-icon [img]="icons.Building2" [size]="12"></lucide-icon>
                        Calypso
                      </span>
                    }
                    <span class="text-xs text-slate-400 ml-auto">{{ formatRelativeTime(reply.created_at) }}</span>
                  </div>

                  @if (editingReplyId() === reply.id) {
                    <textarea
                      [value]="editBody()"
                      (input)="onEditInput($event)"
                      rows="2"
                      class="input-field focus:outline-none resize-none mb-2"
                    ></textarea>
                    <div class="flex gap-2">
                      <button type="button" (click)="onSaveEditReply(reply.id)" [disabled]="submitting()" class="bg-teal-600 text-white rounded-lg px-3 py-1 text-xs font-semibold hover:bg-teal-700 transition-all duration-200 disabled:opacity-50">Save</button>
                      <button type="button" (click)="onCancelEdit()" class="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-slate-50 transition-all duration-200">Cancel</button>
                    </div>
                  } @else {
                    <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ reply.body }}</p>
                    <div class="flex items-center gap-3 mt-1">
                      @if (canEdit(reply)) {
                        <button type="button" (click)="onStartEditReply(reply)" class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-all duration-200">
                          <lucide-icon [img]="icons.Pencil" [size]="12"></lucide-icon>
                          Edit
                        </button>
                      }
                      @if (canDelete(reply)) {
                        <button type="button" (click)="onDeleteReply(reply.id)" class="inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 transition-all duration-200">
                          <lucide-icon [img]="icons.Trash2" [size]="12"></lucide-icon>
                          Delete
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Reply form -->
              @if (replyingToId() === comment.id) {
                <div class="ml-8 mt-3 border-l-2 border-teal-200 pl-4">
                  <textarea
                    [value]="replyBody()"
                    (input)="onReplyInput($event)"
                    placeholder="Write a reply..."
                    rows="2"
                    class="input-field focus:outline-none resize-none"
                  ></textarea>
                  <div class="flex gap-2 mt-2">
                    <button
                      type="button"
                      (click)="onSubmitReply(comment.id)"
                      [disabled]="!replyBody().trim() || submitting()"
                      class="bg-teal-600 text-white rounded-lg px-3 py-1 text-xs font-semibold hover:bg-teal-700 transition-all duration-200 disabled:opacity-50"
                    >Post Reply</button>
                    <button type="button" (click)="onCancelReply()" class="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-1 text-xs font-semibold hover:bg-slate-50 transition-all duration-200">Cancel</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CommentSectionComponent implements OnInit {
  readonly moduleId = input.required<string>();
  readonly courseId = input.required<string>();

  readonly commentService = inject(CommentService);
  #auth = inject(AuthService);
  #toast = inject(ToastService);

  readonly newCommentBody = signal('');
  readonly replyingToId = signal<string | null>(null);
  readonly replyBody = signal('');
  readonly editingCommentId = signal<string | null>(null);
  readonly editingReplyId = signal<string | null>(null);
  readonly editBody = signal('');
  readonly submitting = signal(false);

  readonly #currentUserId = computed(() => this.#auth.currentUser()?.id ?? '');
  readonly #isTenantAdmin = computed(() => this.#auth.currentUser()?.claims?.is_tenant_admin ?? false);
  readonly #isPlatformAdmin = computed(() => this.#auth.currentUser()?.claims?.is_platform_admin ?? false);
  readonly #userTenantId = computed(() => this.#auth.currentUser()?.claims?.tenant_id ?? '');

  readonly icons = { MessageSquare, Reply, Pencil, Trash2, Loader2, GraduationCap, Building2, Send };
  readonly formatRelativeTime = formatRelativeTime;

  constructor() {
    effect(() => {
      const mid = this.moduleId();
      if (mid) {
        this.commentService.loadComments(mid);
      }
    });
  }

  ngOnInit() {
    // Initial load handled by effect
  }

  canEdit(item: Comment | CommentReply): boolean {
    return item.user_id === this.#currentUserId();
  }

  canDelete(item: Comment | CommentReply): boolean {
    if (item.user_id === this.#currentUserId()) return true;
    if (this.#isPlatformAdmin()) return true;
    if (this.#isTenantAdmin() && item.tenant_id === this.#userTenantId()) return true;
    return false;
  }

  getInitials(name: string): string {
    return name
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  onNewCommentInput(event: Event) {
    this.newCommentBody.set((event.target as HTMLTextAreaElement).value);
  }

  onReplyInput(event: Event) {
    this.replyBody.set((event.target as HTMLTextAreaElement).value);
  }

  onEditInput(event: Event) {
    this.editBody.set((event.target as HTMLTextAreaElement).value);
  }

  async onAddComment() {
    const body = this.newCommentBody().trim();
    if (!body) return;

    this.submitting.set(true);

    try {
      await this.commentService.addComment(this.moduleId(), body);
      this.newCommentBody.set('');
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      this.submitting.set(false);
    }
  }

  onStartReply(commentId: string) {
    this.replyingToId.set(commentId);
    this.replyBody.set('');
    this.editingCommentId.set(null);
    this.editingReplyId.set(null);
  }

  onCancelReply() {
    this.replyingToId.set(null);
    this.replyBody.set('');
  }

  async onSubmitReply(commentId: string) {
    const body = this.replyBody().trim();
    if (!body) return;

    this.submitting.set(true);

    try {
      await this.commentService.addReply(commentId, body);
      this.replyingToId.set(null);
      this.replyBody.set('');
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      this.submitting.set(false);
    }
  }

  onStartEditComment(comment: Comment) {
    this.editingCommentId.set(comment.id);
    this.editingReplyId.set(null);
    this.replyingToId.set(null);
    this.editBody.set(comment.body);
  }

  onStartEditReply(reply: CommentReply) {
    this.editingReplyId.set(reply.id);
    this.editingCommentId.set(null);
    this.replyingToId.set(null);
    this.editBody.set(reply.body);
  }

  onCancelEdit() {
    this.editingCommentId.set(null);
    this.editingReplyId.set(null);
    this.editBody.set('');
  }

  async onSaveEditComment(commentId: string) {
    const body = this.editBody().trim();
    if (!body) return;

    this.submitting.set(true);

    try {
      await this.commentService.updateComment(commentId, body);
      this.editingCommentId.set(null);
      this.editBody.set('');
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to update comment');
    } finally {
      this.submitting.set(false);
    }
  }

  async onSaveEditReply(replyId: string) {
    const body = this.editBody().trim();
    if (!body) return;

    this.submitting.set(true);

    try {
      await this.commentService.updateReply(replyId, body);
      this.editingReplyId.set(null);
      this.editBody.set('');
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to update reply');
    } finally {
      this.submitting.set(false);
    }
  }

  async onDeleteComment(commentId: string) {
    try {
      await this.commentService.deleteComment(commentId);
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to delete comment');
    }
  }

  async onDeleteReply(replyId: string) {
    try {
      await this.commentService.deleteReply(replyId);
    } catch (err) {
      this.#toast.error(err instanceof Error ? err.message : 'Failed to delete reply');
    }
  }
}
