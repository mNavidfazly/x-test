import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ModuleAudio } from '../core/models/course.model';

@Component({
  selector: 'app-audio-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div data-testid="mock-audio-viewer">{{ audio().file_name }}</div>`,
})
export class MockAudioViewerComponent {
  readonly audio = input.required<ModuleAudio>();
  readonly moduleId = input.required<string>();
  readonly courseId = input.required<string>();
  readonly moduleTitle = input.required<string>();
}
