import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { LucideAngularModule, Flag, Send, Loader2, X, CheckCircle2 } from 'lucide-angular';
import { IssueService } from '../../../core/services/issue.service';
import { ToastService } from '../../../core/services/toast.service';
import { IssueType } from '../../../core/models/issue.model';

@Component({
  selector: 'app-report-issue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (submitted()) {
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <lucide-icon [img]="icons.CheckCircle2" [size]="20" class="text-emerald-600 shrink-0 mt-0.5"></lucide-icon>
        <div>
          <p class="text-sm font-semibold text-emerald-800">Your issue has been reported!</p>
          <p class="text-xs text-emerald-600 mt-1">The course team will be notified. You can track your issues on the My Issues page.</p>
          <button
            type="button"
            (click)="onReset()"
            class="text-xs text-teal-600 hover:text-teal-800 font-semibold mt-2 transition-colors"
          >Report another issue</button>
        </div>
      </div>
    } @else if (isOpen()) {
      <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <lucide-icon [img]="icons.Flag" [size]="16" class="text-rose-600"></lucide-icon>
            Report an Issue
          </h4>
          <button type="button" (click)="onToggle()" class="text-slate-400 hover:text-slate-600 transition-colors">
            <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-3">Describe the issue and we'll notify the course team.</p>

        <select
          [value]="issueType() ?? ''"
          (change)="onTypeChange($event)"
          class="select-field w-full focus:outline-none mb-3"
        >
          <option value="" disabled>Select issue type...</option>
          <option value="content_error">Content Error</option>
          <option value="technical">Technical Problem</option>
          <option value="accessibility">Accessibility Issue</option>
          <option value="other">Other</option>
        </select>

        <textarea
          [value]="description()"
          (input)="onInput($event)"
          placeholder="Describe the issue..."
          rows="3"
          class="input-field focus:outline-none resize-none"
        ></textarea>

        <div class="flex justify-end mt-3">
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!description().trim() || !issueType() || submitting()"
            class="btn-primary"
          >
            @if (submitting()) {
              <lucide-icon [img]="icons.Loader2" [size]="14" class="animate-spin"></lucide-icon>
            } @else {
              <lucide-icon [img]="icons.Send" [size]="14"></lucide-icon>
            }
            Submit Report
          </button>
        </div>
      </div>
    } @else {
      <button
        type="button"
        (click)="onToggle()"
        class="inline-flex items-center gap-1.5 bg-white border border-rose-300 text-rose-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-rose-50 active:scale-95 transition-all duration-200"
      >
        <lucide-icon [img]="icons.Flag" [size]="16"></lucide-icon>
        Report Issue
      </button>
    }
  `,
})
export class ReportIssueComponent {
  readonly courseId = input.required<string>();
  readonly moduleId = input.required<string>();

  #issueService = inject(IssueService);
  #toast = inject(ToastService);

  readonly isOpen = signal(false);
  readonly issueType = signal<IssueType | null>(null);
  readonly description = signal('');
  readonly submitting = signal(false);
  readonly submitted = signal(false);

  readonly icons = { Flag, Send, Loader2, X, CheckCircle2 };

  onToggle() {
    this.isOpen.update(v => !v);
  }

  onTypeChange(event: Event) {
    this.issueType.set((event.target as HTMLSelectElement).value as IssueType);
  }

  onInput(event: Event) {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  async onSubmit() {
    const type = this.issueType();
    const desc = this.description().trim();
    if (!type || !desc) return;

    this.submitting.set(true);

    try {
      await this.#issueService.reportIssue(
        this.courseId(), this.moduleId(), type, desc,
      );
      this.description.set('');
      this.issueType.set(null);
      this.isOpen.set(false);
      this.submitted.set(true);
    } catch (err) {
      this.#toast.error(
        err instanceof Error ? err.message : 'Failed to report issue',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  onReset() {
    this.submitted.set(false);
    this.isOpen.set(false);
    this.issueType.set(null);
    this.description.set('');
  }
}
