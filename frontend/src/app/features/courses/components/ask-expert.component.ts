import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { LucideAngularModule, HelpCircle, Send, Loader2, X, CheckCircle2 } from 'lucide-angular';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { ToastService } from '../../../core/services/toast.service';
import { CourseLecturer } from '../../../core/models/course.model';

@Component({
  selector: 'app-ask-expert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (submitted()) {
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <lucide-icon [img]="icons.CheckCircle2" [size]="20" class="text-emerald-600 shrink-0 mt-0.5"></lucide-icon>
        <div>
          <p class="text-sm font-semibold text-emerald-800">Your question has been sent!</p>
          <p class="text-xs text-emerald-600 mt-1">
            @if (expertNames()) {
              {{ expertNames() }} will be notified.
            } @else {
              The course expert(s) will be notified.
            }
            You can track your questions on the My Questions page.
          </p>
          <button
            type="button"
            (click)="onReset()"
            class="text-xs text-teal-600 hover:text-teal-800 font-semibold mt-2 transition-colors"
          >Ask another question</button>
        </div>
      </div>
    } @else if (isOpen()) {
      <div class="card p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <lucide-icon [img]="icons.HelpCircle" [size]="16" class="text-teal-600"></lucide-icon>
            Ask an Expert
          </h4>
          <button type="button" (click)="onToggle()" class="text-slate-400 hover:text-slate-600 transition-colors">
            <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
          </button>
        </div>
        @if (lecturers().length > 0) {
          <div class="flex items-center gap-2 mb-3">
            <div class="flex -space-x-1.5">
              @for (l of lecturers().slice(0, 3); track l.user_id) {
                @if (l.avatar_url) {
                  <img [src]="l.avatar_url" [alt]="l.full_name ?? l.email"
                       class="w-6 h-6 rounded-full object-cover border-2 border-white" />
                } @else {
                  <div class="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    {{ getInitials(l.full_name ?? l.email) }}
                  </div>
                }
              }
            </div>
            <p class="text-xs text-slate-500">Your question goes to {{ expertNames() }}</p>
          </div>
        } @else {
          <p class="text-xs text-slate-500 mb-3">Your question will be sent to the course expert(s).</p>
        }
        <textarea
          [value]="questionText()"
          (input)="onInput($event)"
          placeholder="Type your question..."
          rows="3"
          class="input-field resize-none"
        ></textarea>

        <div class="flex justify-end mt-3">
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!questionText().trim() || submitting()"
            class="btn-primary"
          >
            @if (submitting()) {
              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
            } @else {
              <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
            }
            Send Question
          </button>
        </div>
      </div>
    } @else {
      <div>
        <button
          type="button"
          (click)="onToggle()"
          class="inline-flex items-center gap-1.5 bg-white border border-teal-300 text-teal-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-50 active:scale-95 transition-[background-color,transform] duration-200"
        >
          <lucide-icon [img]="icons.HelpCircle" [size]="16"></lucide-icon>
          Ask an Expert
        </button>
        @if (lecturers().length > 0) {
          <div class="flex items-center gap-2 mt-2">
            <div class="flex -space-x-1.5">
              @for (l of lecturers().slice(0, 3); track l.user_id) {
                @if (l.avatar_url) {
                  <img [src]="l.avatar_url" [alt]="l.full_name ?? l.email"
                       class="w-6 h-6 rounded-full object-cover border-2 border-white" />
                } @else {
                  <div class="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    {{ getInitials(l.full_name ?? l.email) }}
                  </div>
                }
              }
            </div>
            <span class="text-xs text-slate-400">{{ expertNames() }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class AskExpertComponent {
  readonly courseId = input.required<string>();
  readonly moduleId = input.required<string>();
  readonly lecturers = input<CourseLecturer[]>([]);

  #expertQuestionService = inject(ExpertQuestionService);
  #toast = inject(ToastService);

  readonly isOpen = signal(false);
  readonly questionText = signal('');
  readonly submitting = signal(false);
  readonly submitted = signal(false);

  readonly icons = { HelpCircle, Send, Loader2, X, CheckCircle2 };

  readonly expertNames = computed(() => {
    const lecturers = this.lecturers();
    if (lecturers.length === 0) return '';
    const names = lecturers.map(l => l.full_name ?? l.email.split('@')[0]);
    if (names.length <= 2) return names.join(', ');
    return `${names[0]} +${names.length - 1} more`;
  });

  getInitials(name: string): string {
    return name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  onToggle() {
    this.isOpen.update(v => !v);
  }

  onInput(event: Event) {
    this.questionText.set((event.target as HTMLTextAreaElement).value);
  }

  async onSubmit() {
    const text = this.questionText().trim();
    if (!text) return;

    this.submitting.set(true);

    try {
      await this.#expertQuestionService.askQuestion(
        this.courseId(), this.moduleId(), text,
      );
      this.questionText.set('');
      this.isOpen.set(false);
      this.submitted.set(true);
    } catch (err) {
      this.#toast.error(
        err instanceof Error ? err.message : 'Failed to send question',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  onReset() {
    this.submitted.set(false);
    this.isOpen.set(false);
    this.questionText.set('');
  }
}
