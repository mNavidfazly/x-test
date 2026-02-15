import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideAngularModule, Check, Lock, UserPlus, Info } from 'lucide-angular';
import { EnrollmentType } from '../../../core/models/course.model';

@Component({
  selector: 'app-enrollment-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (!canEdit()) {
      @if (isEnrolled()) {
        <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 inline-flex items-center gap-2">
          <lucide-icon [img]="icons.Check" [size]="16" class="text-emerald-600"></lucide-icon>
          <span class="text-sm font-semibold text-emerald-700">You're enrolled</span>
        </div>
      } @else {
        @switch (enrollmentType()) {
          @case ('open') {
            <button
              type="button"
              (click)="onEnroll()"
              [disabled]="enrolling()"
              class="btn-primary px-5 py-2.5"
            >
              <lucide-icon [img]="icons.UserPlus" [size]="16"></lucide-icon>
              @if (enrolling()) {
                Enrolling...
              } @else {
                Enroll Now
              }
            </button>
          }
          @case ('password_protected') {
            <div class="bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-lg p-4 max-w-md">
              <div class="flex items-center gap-2 mb-3">
                <lucide-icon [img]="icons.Lock" [size]="16" class="text-slate-500"></lucide-icon>
                <span class="text-sm font-semibold text-slate-700">Password required to enroll</span>
              </div>
              <div class="flex gap-2">
                <input
                  type="password"
                  [value]="password()"
                  (input)="onPasswordInput($event)"
                  (keydown.enter)="onPasswordSubmit()"
                  placeholder="Enter course password"
                  class="input-field flex-1 focus:outline-none"
                />
                <button
                  type="button"
                  (click)="onPasswordSubmit()"
                  [disabled]="enrolling()"
                  class="btn-primary shrink-0"
                >
                  @if (enrolling()) {
                    ...
                  } @else {
                    Enroll
                  }
                </button>
              </div>
              @if (passwordError()) {
                <p class="text-xs text-rose-600 mt-2">{{ passwordError() }}</p>
              }
            </div>
          }
          @case ('invite_only') {
            <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 inline-flex items-center gap-2">
              <lucide-icon [img]="icons.Info" [size]="16" class="text-amber-600"></lucide-icon>
              <span class="text-sm text-amber-700">This course requires an invitation from your administrator.</span>
            </div>
          }
        }
      }
    }
  `,
})
export class EnrollmentCtaComponent {
  readonly enrollmentType = input.required<EnrollmentType>();
  readonly isEnrolled = input.required<boolean>();
  readonly canEdit = input.required<boolean>();

  readonly enroll = output<void>();
  readonly enrollWithPassword = output<string>();

  readonly password = signal('');
  readonly passwordError = signal('');
  readonly enrolling = signal(false);

  readonly icons = { Check, Lock, UserPlus, Info };

  onEnroll() {
    this.enrolling.set(true);
    this.enroll.emit();
  }

  onPasswordInput(event: Event) {
    this.password.set((event.target as HTMLInputElement).value);
    this.passwordError.set('');
  }

  onPasswordSubmit() {
    const pwd = this.password();
    if (!pwd.trim()) {
      this.passwordError.set('Please enter the course password');
      return;
    }
    this.enrolling.set(true);
    this.passwordError.set('');
    this.enrollWithPassword.emit(pwd);
  }

  setError(message: string) {
    this.enrolling.set(false);
    this.passwordError.set(message);
  }
}
