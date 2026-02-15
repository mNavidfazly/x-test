import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, ExternalLink } from 'lucide-angular';
import { ExternalQuizContent } from '../../../core/models/course.model';

@Component({
  selector: 'app-external-quiz-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="card p-6 space-y-4">
      <div class="flex items-center gap-3">
        <lucide-icon [img]="icons.ExternalLink" [size]="24" class="text-teal-600"></lucide-icon>
        <h3 class="text-lg font-semibold text-slate-900">External Quiz</h3>
      </div>

      <div class="space-y-2 text-sm text-slate-600">
        <p><span class="font-medium text-slate-700">Quiz ID:</span> {{ content().external_quiz_id }}</p>
        @if (content().passing_score !== null) {
          <p><span class="font-medium text-slate-700">Passing score:</span> {{ content().passing_score }}%</p>
        }
      </div>

      <a
        [href]="content().external_quiz_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200"
      >
        <lucide-icon [img]="icons.ExternalLink" [size]="16"></lucide-icon>
        Take External Quiz
      </a>

      <p class="text-xs text-slate-400">Results will be recorded automatically when you complete the quiz on the external platform.</p>
    </div>
  `,
})
export class ExternalQuizViewerComponent {
  readonly content = input.required<ExternalQuizContent>();
  readonly icons = { ExternalLink };
}
