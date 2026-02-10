import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ModuleVideo } from '../../../core/models/course.model';

@Component({
  selector: 'app-video-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="w-full max-w-4xl mx-auto">
      <video
        class="w-full aspect-video rounded-lg bg-black"
        controls
        preload="metadata"
        [src]="video().video_url"
        [poster]="video().thumbnail_url ?? ''"
      ></video>
      @if (formattedDuration()) {
        <p class="text-xs text-slate-500 mt-2 tabular-nums">Duration: {{ formattedDuration() }}</p>
      }
    </div>
  `,
})
export class VideoViewerComponent {
  readonly video = input.required<ModuleVideo>();

  readonly formattedDuration = computed(() => {
    const seconds = this.video().duration;
    if (seconds == null || seconds <= 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });
}
