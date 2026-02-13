import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule, Check, X } from 'lucide-angular';
import { QuizQuestionResult } from '../../../core/models/course.model';

@Component({
  selector: 'app-quiz-result-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="rounded-xl border bg-white p-5" [class.border-emerald-200]="isCorrect()" [class.border-rose-200]="!isCorrect()">
      <div class="flex items-start gap-3 mb-3">
        <span class="flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
              [class.bg-emerald-100]="isCorrect()" [class.text-emerald-700]="isCorrect()"
              [class.bg-rose-100]="!isCorrect()" [class.text-rose-700]="!isCorrect()">
          {{ questionNumber() }}
        </span>
        <div class="flex-1">
          <p class="text-sm font-semibold text-slate-900">{{ result().question_text }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ result().points }} {{ result().points === 1 ? 'point' : 'points' }}</p>
        </div>
        <div class="flex-shrink-0">
          @if (isCorrect()) {
            <lucide-icon [img]="icons.Check" [size]="20" class="text-emerald-600"></lucide-icon>
          } @else {
            <lucide-icon [img]="icons.X" [size]="20" class="text-rose-600"></lucide-icon>
          }
        </div>
      </div>

      <!-- User answer -->
      <div class="ml-10 space-y-2">
        <div class="text-sm">
          <span class="text-slate-500">Your answer: </span>
          @if (result().user_answer) {
            <span class="font-medium" [class.text-emerald-700]="isCorrect()" [class.text-rose-700]="!isCorrect()">
              {{ displayUserAnswer() }}
            </span>
          } @else {
            <span class="text-slate-400 italic">No answer</span>
          }
        </div>

        <!-- Correct answer (if show_correct_answers enabled) -->
        @if (result().correct_answer !== null && !isCorrect()) {
          <div class="text-sm">
            <span class="text-slate-500">Correct answer: </span>
            <span class="font-medium text-emerald-700">{{ displayCorrectAnswer() }}</span>
          </div>
        }

        <!-- Option list for choice-based questions -->
        @if (showOptionList()) {
          <div class="space-y-1 mt-2">
            @for (opt of result().options ?? []; track opt.id) {
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                   [class.bg-emerald-50]="opt.is_correct === true"
                   [class.bg-rose-50]="isUserSelectedOption(opt.id) && opt.is_correct === false"
                   [class.bg-slate-50]="!isUserSelectedOption(opt.id) && opt.is_correct !== true">
                @if (opt.is_correct === true) {
                  <lucide-icon [img]="icons.Check" [size]="14" class="text-emerald-600 flex-shrink-0"></lucide-icon>
                } @else if (isUserSelectedOption(opt.id)) {
                  <lucide-icon [img]="icons.X" [size]="14" class="text-rose-600 flex-shrink-0"></lucide-icon>
                } @else {
                  <span class="w-3.5"></span>
                }
                <span [class.text-emerald-700]="opt.is_correct === true"
                      [class.text-rose-700]="isUserSelectedOption(opt.id) && opt.is_correct === false"
                      [class.text-slate-600]="!isUserSelectedOption(opt.id) && opt.is_correct !== true">
                  {{ opt.option_text }}
                </span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class QuizResultItemComponent {
  readonly result = input.required<QuizQuestionResult>();
  readonly questionNumber = input.required<number>();

  readonly icons = { Check, X };

  readonly isCorrect = computed(() => {
    const r = this.result();
    if (!r.user_answer) return false;
    const type = r.question_type;
    // Option-based: check options directly, don't need correct_answer text
    if (type === 'single_choice' || type === 'true_false') {
      return r.options?.some(o => o.id === r.user_answer && o.is_correct === true) ?? false;
    }
    if (type === 'multiple_choice') {
      const userIds = new Set((r.user_answer ?? '').split(',').filter(Boolean).sort());
      const correctIds = new Set((r.options ?? []).filter(o => o.is_correct === true).map(o => o.id).sort());
      return userIds.size === correctIds.size && [...userIds].every(id => correctIds.has(id));
    }
    // Text-based types need correct_answer
    if (r.correct_answer === null) return false;
    if (type === 'fill_blank' || type === 'short_answer') {
      return (r.user_answer ?? '').trim().toLowerCase() === (r.correct_answer ?? '').trim().toLowerCase();
    }
    if (type === 'matching') {
      try {
        const userPairs = JSON.parse(r.user_answer ?? '[]');
        const correctPairs = JSON.parse(r.correct_answer ?? '[]');
        return JSON.stringify(userPairs) === JSON.stringify(correctPairs);
      } catch { return false; }
    }
    return false;
  });

  readonly showOptionList = computed(() => {
    const type = this.result().question_type;
    const hasOptions = (this.result().options ?? []).length > 0;
    const hasCorrectInfo = this.result().options?.some(o => o.is_correct !== null) ?? false;
    return hasOptions && hasCorrectInfo && (type === 'single_choice' || type === 'multiple_choice' || type === 'true_false');
  });

  readonly #userSelectedIds = computed(() => {
    const r = this.result();
    if (!r.user_answer) return new Set<string>();
    if (r.question_type === 'multiple_choice') {
      return new Set(r.user_answer.split(',').filter(Boolean));
    }
    return new Set([r.user_answer]);
  });

  displayUserAnswer(): string {
    const r = this.result();
    if (!r.user_answer) return '';
    const type = r.question_type;
    if (type === 'single_choice' || type === 'true_false') {
      return r.options?.find(o => o.id === r.user_answer)?.option_text ?? r.user_answer;
    }
    if (type === 'multiple_choice') {
      const ids = r.user_answer.split(',').filter(Boolean);
      return ids.map(id => r.options?.find(o => o.id === id)?.option_text ?? id).join(', ');
    }
    if (type === 'matching') {
      try {
        const pairs = JSON.parse(r.user_answer) as { left: string; right: string }[];
        return pairs.map(p => `${p.left} → ${p.right}`).join(', ');
      } catch { return r.user_answer; }
    }
    return r.user_answer;
  }

  displayCorrectAnswer(): string {
    const r = this.result();
    if (!r.correct_answer) return '';
    const type = r.question_type;
    if (type === 'matching') {
      try {
        const pairs = JSON.parse(r.correct_answer) as { left: string; right: string }[];
        return pairs.map(p => `${p.left} → ${p.right}`).join(', ');
      } catch { return r.correct_answer; }
    }
    if (type === 'single_choice' || type === 'true_false') {
      return r.options?.find(o => o.is_correct === true)?.option_text ?? r.correct_answer;
    }
    if (type === 'multiple_choice') {
      return (r.options ?? []).filter(o => o.is_correct === true).map(o => o.option_text).join(', ');
    }
    return r.correct_answer;
  }

  isUserSelectedOption(optionId: string): boolean {
    return this.#userSelectedIds().has(optionId);
  }
}
