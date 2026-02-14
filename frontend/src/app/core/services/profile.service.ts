import { Injectable, effect, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { UserProfile } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #profile = signal<UserProfile | null>(null);

  readonly profile = this.#profile.asReadonly();

  constructor() {
    effect(() => {
      const user = this.#auth.currentUser();
      if (user) {
        this.#fetchProfile(user.id);
      } else {
        this.#profile.set(null);
      }
    });
  }

  async refreshProfile() {
    const user = this.#auth.currentUser();
    if (user) {
      await this.#fetchProfile(user.id);
    }
  }

  async #fetchProfile(userId: string) {
    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile:', error.message);
    }
    this.#profile.set(data ?? null);
  }
}
