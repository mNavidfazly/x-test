import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { LucideAngularModule, HelpCircle, Send, Loader2, X, CheckCircle2 } from 'lucide-angular';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';

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
          <p class="text-xs text-emerald-600 mt-1">The course expert(s) will be notified. You can track your questions on the My Questions page.</p>
          <button
            type="button"
            (click)="onReset()"
            class="text-xs text-teal-600 hover:text-teal-800 font-semibold mt-2 transition-colors"
          >Ask another question</button>
        </div>
      </div>
    } @else if (isOpen()) {
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <lucide-icon [img]="icons.HelpCircle" [size]="16" class="text-teal-600"></lucide-icon>
            Ask an Expert
          </h4>
          <button type="button" (click)="onToggle()" class="text-slate-400 hover:text-slate-600 transition-colors">
            <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-3">Your question will be sent to the course expert(s).</p>
        <textarea
          [value]="questionText()"
          (input)="onInput($event)"
          placeholder="Type your question..."
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
        ></textarea>

        @if (actionError()) {
          <div class="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            {{ actionError() }}
          </div>
        }

        <div class="flex justify-end mt-3">
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!questionText().trim() || submitting()"
            class="inline-flex items-center gap-1.5 bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
      <button
        type="button"
        (click)="onToggle()"
        class="inline-flex items-center gap-1.5 bg-white border border-teal-300 text-teal-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-50 active:scale-95 transition-all duration-200"
      >
        <lucide-icon [img]="icons.HelpCircle" [size]="16"></lucide-icon>
        Ask an Expert
      </button>
    }
  `,
})
export class AskExpertComponent {
  readonly courseId = input.required<string>();
  readonly moduleId = input.required<string>();

  #expertQuestionService = inject(ExpertQuestionService);

  readonly isOpen = signal(false);
  readonly questionText = signal('');
  readonly submitting = signal(false);
  readonly actionError = signal('');
  readonly submitted = signal(false);

  readonly icons = { HelpCircle, Send, Loader2, X, CheckCircle2 };

  onToggle() {
    this.isOpen.update(v => !v);
    this.actionError.set('');
  }

  onInput(event: Event) {
    this.questionText.set((event.target as HTMLTextAreaElement).value);
  }

  async onSubmit() {
    const text = this.questionText().trim();
    if (!text) return;

    this.submitting.set(true);
    this.actionError.set('');

    try {
      await this.#expertQuestionService.askQuestion(
        this.courseId(), this.moduleId(), text,
      );
      this.questionText.set('');
      this.isOpen.set(false);
      this.submitted.set(true);
    } catch (err) {
      this.actionError.set(
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
    this.actionError.set('');
  }
}
