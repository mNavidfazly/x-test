import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { AppNotification } from '../models/notification.model';
import { extractErrorMessage } from '../utils/error.utils';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #notifications = signal<AppNotification[]>([]);
  #loading = signal(false);
  #error = signal('');
  #latestToast = signal<AppNotification | null>(null);
  #channel: RealtimeChannel | null = null;
  #toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly notifications = this.#notifications.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();
  readonly latestToast = this.#latestToast.asReadonly();
  readonly unreadCount = computed(() => this.#notifications().filter(n => !n.read_at).length);

  constructor() {
    effect((onCleanup) => {
      const user = this.#auth.currentUser();
      if (user) {
        this.loadNotifications();
        this.#startListening(user.id);
        onCleanup(() => this.#stopListening());
      } else {
        this.#notifications.set([]);
        this.#stopListening();
      }
    });
  }

  async loadNotifications(): Promise<void> {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      this.#notifications.set((data ?? []) as AppNotification[]);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load notifications'));
    } finally {
      this.#loading.set(false);
    }
  }

  async markAsRead(id: string): Promise<void> {
    const readAt = new Date().toISOString();
    const { error } = await this.#supabase.client
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id);

    if (error) return;

    this.#notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read_at: readAt } : n),
    );
  }

  async markAllAsRead(): Promise<void> {
    const readAt = new Date().toISOString();
    const { error } = await this.#supabase.client
      .from('notifications')
      .update({ read_at: readAt })
      .is('read_at', null);

    if (error) return;

    this.#notifications.update(list =>
      list.map(n => n.read_at ? n : { ...n, read_at: readAt }),
    );
  }

  dismissToast(): void {
    this.#latestToast.set(null);
    if (this.#toastTimer) {
      clearTimeout(this.#toastTimer);
      this.#toastTimer = null;
    }
  }

  #startListening(userId: string): void {
    this.#channel = this.#supabase.client
      .channel('notifs-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.' + userId,
        },
        (payload) => {
          const notification = payload.new as AppNotification;
          this.#notifications.update(list => [notification, ...list]);
          this.#latestToast.set(notification);
          if (this.#toastTimer) clearTimeout(this.#toastTimer);
          this.#toastTimer = setTimeout(() => this.#latestToast.set(null), 5000);
        },
      )
      .subscribe();
  }

  #stopListening(): void {
    if (this.#channel) {
      this.#supabase.client.removeChannel(this.#channel);
      this.#channel = null;
    }
    if (this.#toastTimer) {
      clearTimeout(this.#toastTimer);
      this.#toastTimer = null;
    }
  }
}
