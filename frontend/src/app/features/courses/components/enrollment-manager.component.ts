import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { LucideAngularModule, Users, UserPlus, Trash2, Loader2 } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { EnrolledUser, EnrollmentType } from '../../../core/models/course.model';

@Component({
  selector: 'app-enrollment-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4 flex items-center gap-2">
        <lucide-icon [img]="icons.Users" [size]="14"></lucide-icon>
        Enrolled Users ({{ enrolledUsers().length }})
      </h3>

      <!-- Add user form -->
      <div class="flex gap-2 mb-4">
        <input
          type="email"
          [value]="addEmail()"
          (input)="onEmailInput($event)"
          (keydown.enter)="onAddUser()"
          placeholder="Enter user email to enroll"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
        />
        <button
          type="button"
          (click)="onAddUser()"
          [disabled]="adding()"
          class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 text-sm shrink-0 inline-flex items-center gap-1.5"
        >
          <lucide-icon [img]="icons.UserPlus" [size]="14"></lucide-icon>
          @if (adding()) {
            Adding...
          } @else {
            Add
          }
        </button>
      </div>

      @if (addError()) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-4">
          {{ addError() }}
        </div>
      }

      @if (loadingUsers()) {
        <div class="flex items-center gap-2 py-4">
          <lucide-icon [img]="icons.Loader2" [size]="16" class="text-slate-400 animate-spin"></lucide-icon>
          <span class="text-sm text-slate-500">Loading enrolled users...</span>
        </div>
      } @else if (enrolledUsers().length === 0) {
        <div class="text-center py-6">
          <lucide-icon [img]="icons.Users" [size]="32" class="text-slate-300 mx-auto mb-2"></lucide-icon>
          <p class="text-sm text-slate-500">No users enrolled yet.</p>
        </div>
      } @else {
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Enrolled</th>
                <th class="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (user of enrolledUsers(); track user.id) {
                <tr class="hover:bg-slate-50/50 transition-colors">
                  <td class="px-4 py-2.5 text-slate-700">{{ user.email }}</td>
                  <td class="px-4 py-2.5 text-slate-600">{{ user.full_name ?? '—' }}</td>
                  <td class="px-4 py-2.5 text-slate-500 tabular-nums">{{ formatDate(user.enrolled_at) }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      (click)="onUnenroll(user.id)"
                      class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded p-1 transition-all duration-200"
                      title="Unenroll user"
                    >
                      <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class EnrollmentManagerComponent implements OnInit {
  readonly courseId = input.required<string>();
  readonly enrollmentType = input.required<EnrollmentType>();

  #courseService = inject(CourseService);
  #auth = inject(AuthService);

  readonly enrolledUsers = signal<EnrolledUser[]>([]);
  readonly loadingUsers = signal(false);
  readonly addEmail = signal('');
  readonly addError = signal('');
  readonly adding = signal(false);

  readonly icons = { Users, UserPlus, Trash2, Loader2 };

  ngOnInit() {
    this.#loadUsers();
  }

  onEmailInput(event: Event) {
    this.addEmail.set((event.target as HTMLInputElement).value);
    this.addError.set('');
  }

  async onAddUser() {
    const email = this.addEmail().trim();
    if (!email) {
      this.addError.set('Please enter an email address');
      return;
    }

    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!tenantId) return;

    this.adding.set(true);
    this.addError.set('');

    try {
      const user = await this.#courseService.lookupUserByEmail(email, tenantId);
      if (!user) {
        this.addError.set('No user found with this email in your tenant');
        return;
      }

      // Check if already enrolled
      const existing = this.enrolledUsers().find(u => u.user_id === user.id);
      if (existing) {
        this.addError.set('This user is already enrolled');
        return;
      }

      await this.#courseService.adminEnrollUser(user.id, tenantId, this.courseId());
      this.addEmail.set('');
      await this.#loadUsers();
    } catch (err) {
      this.addError.set(err instanceof Error ? err.message : 'Failed to enroll user');
    } finally {
      this.adding.set(false);
    }
  }

  async onUnenroll(enrollmentId: string) {
    try {
      await this.#courseService.unenrollUser(enrollmentId);
      await this.#loadUsers();
    } catch (err) {
      this.addError.set(err instanceof Error ? err.message : 'Failed to unenroll user');
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  async #loadUsers() {
    this.loadingUsers.set(true);
    try {
      const users = await this.#courseService.loadEnrolledUsers(this.courseId());
      this.enrolledUsers.set(users);
    } catch {
      this.addError.set('Failed to load enrolled users');
    } finally {
      this.loadingUsers.set(false);
    }
  }
}
