import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule, ClipboardCheck, CheckCircle2, Check, X, Lightbulb } from 'lucide-angular';
import { KnowledgeCheckService } from '../../../core/services/knowledge-check.service';
import { XpService } from '../../../core/services/xp.service';
import { KnowledgeCheckQuestion, KnowledgeCheckResponse } from '../../../core/models/knowledge-check.model';

@Component({
  selector: 'app-knowledge-check-section',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (!loading() && questions().length > 0) {
      <div class="card p-5">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <lucide-icon [img]="icons.ClipboardCheck" [size]="20" class="text-teal-600"></lucide-icon>
            <h3 class="text-sm font-semibold text-slate-900">Check Your Understanding</h3>
            <span class="badge-primary">{{ questions().length }}</span>
          </div>
          <span class="text-xs text-slate-500">{{ answeredCount() }} of {{ questions().length }} answered</span>
        </div>

        <!-- Progress bar -->
        <div class="progress-track mb-5">
          <div class="progress-fill" [style.width.%]="progressPercent()"></div>
        </div>

        <!-- Questions -->
        <div class="space-y-4">
          @for (question of questions(); track question.id; let i = $index) {
            @let response = responses().get(question.id);
            <div class="rounded-xl border p-4"
                 [class.border-slate-200]="!response"
                 [class.border-emerald-200]="response?.isCorrect"
                 [class.border-rose-200]="response && !response.isCorrect">
              <!-- Question header -->
              <div class="flex items-start gap-3 mb-3">
                <span class="flex-shrink-0 w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
                      [class.bg-teal-100]="!response"
                      [class.text-teal-700]="!response"
                      [class.bg-emerald-100]="response?.isCorrect"
                      [class.text-emerald-700]="response?.isCorrect"
                      [class.bg-rose-100]="response && !response.isCorrect"
                      [class.text-rose-700]="response && !response.isCorrect">
                  {{ i + 1 }}
                </span>
                <p class="text-sm font-medium text-slate-800 pt-1">{{ question.questionText }}</p>
              </div>

              <!-- Options -->
              <div class="space-y-2 ml-10">
                @for (option of question.options; track $index; let optIdx = $index) {
                  @if (response) {
                    <!-- Already answered: show result -->
                    <div class="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                         [class.bg-emerald-50]="optIdx === response.correctIndex"
                         [class.border-emerald-300]="optIdx === response.correctIndex"
                         [class.bg-rose-50]="optIdx === response.selectedOptionIndex && !response.isCorrect && optIdx !== response.correctIndex"
                         [class.border-rose-300]="optIdx === response.selectedOptionIndex && !response.isCorrect && optIdx !== response.correctIndex"
                         [class.bg-slate-50]="optIdx !== response.correctIndex && !(optIdx === response.selectedOptionIndex && !response.isCorrect)"
                         [class.border-slate-200]="optIdx !== response.correctIndex && !(optIdx === response.selectedOptionIndex && !response.isCorrect)">
                      @if (optIdx === response.correctIndex) {
                        <lucide-icon [img]="icons.Check" [size]="16" class="text-emerald-600 flex-shrink-0"></lucide-icon>
                      } @else if (optIdx === response.selectedOptionIndex && !response.isCorrect) {
                        <lucide-icon [img]="icons.X" [size]="16" class="text-rose-600 flex-shrink-0"></lucide-icon>
                      } @else {
                        <span class="w-4 flex-shrink-0"></span>
                      }
                      <span class="text-sm text-slate-700">{{ option.text }}</span>
                    </div>
                  } @else {
                    <!-- Unanswered: selectable option -->
                    <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-[background-color,border-color] duration-200"
                           [class.border-teal-500]="selectedOptions().get(question.id) === optIdx"
                           [class.bg-teal-50]="selectedOptions().get(question.id) === optIdx">
                      <input type="radio" [name]="'kc-' + question.id" [value]="optIdx"
                             [checked]="selectedOptions().get(question.id) === optIdx"
                             (change)="selectOption(question.id, optIdx)"
                             class="text-teal-600 focus:ring-teal-500" />
                      <span class="text-sm text-slate-700">{{ option.text }}</span>
                    </label>
                  }
                }
              </div>

              <!-- Check button (unanswered) -->
              @if (!response && selectedOptions().has(question.id)) {
                <div class="ml-10 mt-3">
                  <button type="button" class="btn-primary btn-sm"
                          [disabled]="submitting() === question.id"
                          (click)="checkAnswer(question.id)">
                    @if (submitting() === question.id) {
                      <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Check" [size]="14"></lucide-icon></span>
                      Checking...
                    } @else {
                      Check
                    }
                  </button>
                </div>
              }

              <!-- XP gain float -->
              @if (xpGainQuestionId() === question.id) {
                <div class="ml-10 mt-2">
                  <span class="xp-float text-sm font-bold text-teal-600">+5 XP</span>
                </div>
              }

              <!-- Explanation (after answering) -->
              @if (response?.explanation) {
                <div class="flex gap-2 mt-3 ml-10 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <lucide-icon [img]="icons.Lightbulb" [size]="16" class="text-amber-500 flex-shrink-0 mt-0.5"></lucide-icon>
                  <p class="text-slate-700">{{ response!.explanation }}</p>
                </div>
              }
            </div>
          }
        </div>

        <!-- All done message -->
        @if (answeredCount() === questions().length && questions().length > 0) {
          <div class="flex items-center gap-2 mt-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <lucide-icon [img]="icons.CheckCircle2" [size]="20" class="text-emerald-600"></lucide-icon>
            <p class="text-sm font-medium text-emerald-700">Great job! You've completed all knowledge checks for this module.</p>
          </div>
        }
      </div>
    }
  `,
})
export class KnowledgeCheckSectionComponent {
  readonly moduleId = input.required<string>();

  readonly icons = { ClipboardCheck, CheckCircle2, Check, X, Lightbulb };

  #kcService = inject(KnowledgeCheckService);
  #xpService = inject(XpService);

  readonly loading = signal(true);
  readonly questions = signal<KnowledgeCheckQuestion[]>([]);
  readonly responses = signal<Map<string, KnowledgeCheckResponse>>(new Map());
  readonly selectedOptions = signal<Map<string, number>>(new Map());
  readonly submitting = signal<string | null>(null);
  readonly xpGainQuestionId = signal<string | null>(null);

  readonly answeredCount = () => this.responses().size;
  readonly progressPercent = () => {
    const total = this.questions().length;
    return total > 0 ? (this.answeredCount() / total) * 100 : 0;
  };

  constructor() {
    effect(() => {
      const mid = this.moduleId();
      if (mid) this.#loadData(mid);
    });
  }

  selectOption(questionId: string, optionIndex: number) {
    const current = new Map(this.selectedOptions());
    current.set(questionId, optionIndex);
    this.selectedOptions.set(current);
  }

  async checkAnswer(questionId: string) {
    const selectedIndex = this.selectedOptions().get(questionId);
    if (selectedIndex == null) return;

    this.submitting.set(questionId);
    try {
      const response = await this.#kcService.submitAnswer(questionId, selectedIndex);
      const updated = new Map(this.responses());
      updated.set(questionId, response);
      this.responses.set(updated);
      if (response.isCorrect) {
        this.xpGainQuestionId.set(questionId);
        setTimeout(() => this.xpGainQuestionId.set(null), 1600);
        this.#xpService.loadXp(true);
      }
    } catch {
      // Error is non-critical for a comprehension check
    } finally {
      this.submitting.set(null);
    }
  }

  async #loadData(moduleId: string) {
    this.loading.set(true);
    try {
      const [questions, responses] = await Promise.all([
        this.#kcService.loadQuestions(moduleId),
        this.#kcService.loadMyResponses(moduleId),
      ]);
      this.questions.set(questions);
      this.responses.set(responses);
    } catch {
      // Silently fail — knowledge checks are non-critical
    } finally {
      this.loading.set(false);
    }
  }
}
