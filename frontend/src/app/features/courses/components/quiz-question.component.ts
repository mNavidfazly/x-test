import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuizTakingQuestion } from '../../../core/models/course.model';

@Component({
  selector: 'app-quiz-question',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <div class="flex items-start gap-3 mb-4">
        <span class="flex-shrink-0 w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center">
          {{ questionNumber() }}
        </span>
        <div class="flex-1">
          <p class="text-sm font-semibold text-slate-900">{{ question().question_text }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ question().points }} {{ question().points === 1 ? 'point' : 'points' }}</p>
        </div>
      </div>

      @switch (question().question_type) {
        @case ('single_choice') {
          <div class="space-y-2 ml-10">
            @for (opt of question().options; track opt.id) {
              <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-all duration-200"
                     [class.border-teal-500]="answer() === opt.id"
                     [class.bg-teal-50]="answer() === opt.id">
                <input type="radio"
                       [name]="'q-' + question().id"
                       [value]="opt.id"
                       [checked]="answer() === opt.id"
                       [disabled]="disabled()"
                       (change)="answerChange.emit(opt.id)"
                       class="text-teal-600 focus:ring-teal-500" />
                <span class="text-sm text-slate-700">{{ opt.option_text }}</span>
              </label>
            }
          </div>
        }
        @case ('true_false') {
          <div class="space-y-2 ml-10">
            @for (opt of question().options; track opt.id) {
              <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-all duration-200"
                     [class.border-teal-500]="answer() === opt.id"
                     [class.bg-teal-50]="answer() === opt.id">
                <input type="radio"
                       [name]="'q-' + question().id"
                       [value]="opt.id"
                       [checked]="answer() === opt.id"
                       [disabled]="disabled()"
                       (change)="answerChange.emit(opt.id)"
                       class="text-teal-600 focus:ring-teal-500" />
                <span class="text-sm text-slate-700 font-medium">{{ opt.option_text }}</span>
              </label>
            }
          </div>
        }
        @case ('multiple_choice') {
          <div class="space-y-2 ml-10">
            @for (opt of question().options; track opt.id) {
              <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-all duration-200"
                     [class.border-teal-500]="isOptionSelected(opt.id)"
                     [class.bg-teal-50]="isOptionSelected(opt.id)">
                <input type="checkbox"
                       [checked]="isOptionSelected(opt.id)"
                       [disabled]="disabled()"
                       (change)="toggleMultipleChoice(opt.id)"
                       class="text-teal-600 focus:ring-teal-500 rounded" />
                <span class="text-sm text-slate-700">{{ opt.option_text }}</span>
              </label>
            }
          </div>
        }
        @case ('fill_blank') {
          <div class="ml-10">
            <input type="text"
                   [value]="answer()"
                   [disabled]="disabled()"
                   (input)="answerChange.emit($any($event.target).value)"
                   placeholder="Type your answer..."
                   class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-200" />
          </div>
        }
        @case ('short_answer') {
          <div class="ml-10">
            <textarea
              [value]="answer()"
              [disabled]="disabled()"
              (input)="answerChange.emit($any($event.target).value)"
              placeholder="Type your answer..."
              rows="3"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-200 resize-y"></textarea>
          </div>
        }
        @case ('matching') {
          <div class="ml-10 space-y-3">
            @for (left of question().matchingLeft ?? []; track left; let i = $index) {
              <div class="flex items-center gap-3">
                <span class="text-sm font-medium text-slate-700 min-w-[120px]">{{ left }}</span>
                <span class="text-slate-400">→</span>
                <select
                  [disabled]="disabled()"
                  [value]="getMatchingValue(i)"
                  (change)="onMatchingChange(i, $any($event.target).value)"
                  class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 transition-all duration-200">
                  <option value="">Select a match...</option>
                  @for (right of question().matchingRight ?? []; track right) {
                    <option [value]="right">{{ right }}</option>
                  }
                </select>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class QuizQuestionComponent {
  readonly question = input.required<QuizTakingQuestion>();
  readonly questionNumber = input.required<number>();
  readonly answer = input('');
  readonly disabled = input(false);

  readonly answerChange = output<string>();

  readonly #selectedIds = computed(() => {
    const a = this.answer();
    return a ? new Set(a.split(',')) : new Set<string>();
  });

  isOptionSelected(optionId: string): boolean {
    return this.#selectedIds().has(optionId);
  }

  toggleMultipleChoice(optionId: string) {
    const current = this.#selectedIds();
    const next = new Set(current);
    if (next.has(optionId)) {
      next.delete(optionId);
    } else {
      next.add(optionId);
    }
    this.answerChange.emit([...next].join(','));
  }

  getMatchingValue(index: number): string {
    try {
      const pairs = JSON.parse(this.answer() || '[]') as { left: string; right: string }[];
      return pairs[index]?.right ?? '';
    } catch {
      return '';
    }
  }

  onMatchingChange(index: number, value: string) {
    const left = this.question().matchingLeft ?? [];
    let pairs: { left: string; right: string }[];
    try {
      pairs = JSON.parse(this.answer() || '[]');
    } catch {
      pairs = left.map(l => ({ left: l, right: '' }));
    }
    // Ensure array has the right length
    while (pairs.length < left.length) {
      pairs.push({ left: left[pairs.length], right: '' });
    }
    pairs[index] = { left: left[index], right: value };
    this.answerChange.emit(JSON.stringify(pairs));
  }
}
