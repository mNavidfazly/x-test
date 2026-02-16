import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-tiptap-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<textarea
    [value]="content()"
    (input)="onInput($event)"
    data-testid="mock-tiptap-editor"
    class="w-full min-h-[200px] border border-slate-300 rounded-lg p-4"
  ></textarea>`,
})
export class MockTiptapEditorComponent {
  readonly content = input('');
  readonly placeholder = input('Start writing...');
  readonly editable = input(true);
  readonly uploadHandler = input<((file: File) => Promise<string>) | null>(null);
  readonly contentChange = output<string>();

  onInput(event: Event) {
    this.contentChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
