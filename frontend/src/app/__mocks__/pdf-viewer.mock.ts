import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ModulePdf } from '../core/models/course.model';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div data-testid="mock-pdf-viewer">{{ pdf().file_name }}</div>`,
})
export class MockPdfViewerComponent {
  readonly pdf = input.required<ModulePdf>();
}
