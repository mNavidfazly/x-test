import { effect, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  readonly #collapsed = signal(this.#readPersistedState());
  readonly collapsed = this.#collapsed.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem('sidebar-collapsed', JSON.stringify(this.#collapsed()));
    });
  }

  toggle(): void {
    this.#collapsed.update(v => !v);
  }

  collapse(): void {
    this.#collapsed.set(true);
  }

  expand(): void {
    this.#collapsed.set(false);
  }

  #readPersistedState(): boolean {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  }
}
