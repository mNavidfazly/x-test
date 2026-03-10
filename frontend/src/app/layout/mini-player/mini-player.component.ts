import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, Headphones, Play, Pause, X } from 'lucide-angular';
import { AudioPlayerService } from '../../core/services/audio-player.service';

@Component({
  selector: 'app-mini-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (audioPlayer.activeTrack(); as track) {
      <div class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div class="h-1 bg-slate-100">
          <div
            class="h-full bg-teal-600 transition-[width] duration-300"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
        <div class="flex items-center gap-3 px-4 py-2 max-w-screen-2xl mx-auto">
          <button
            type="button"
            class="flex items-center gap-3 min-w-0 flex-1 text-left"
            (click)="navigateToModule(track)"
          >
            <lucide-icon [img]="icons.Headphones" [size]="20" class="text-teal-600 shrink-0"></lucide-icon>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-900 truncate">{{ track.title }}</p>
              <p class="text-xs text-slate-500 truncate">{{ track.fileName }}</p>
            </div>
          </button>

          <span class="text-xs text-slate-500 tabular-nums hidden sm:block whitespace-nowrap">
            {{ formatTime(audioPlayer.currentTime()) }} / {{ formatTime(audioPlayer.duration()) }}
          </span>

          <button
            type="button"
            (click)="audioPlayer.togglePlay()"
            class="btn-icon w-9 h-9 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors duration-200 shrink-0"
            [attr.aria-label]="audioPlayer.isPlaying() ? 'Pause' : 'Play'"
          >
            <lucide-icon [img]="audioPlayer.isPlaying() ? icons.Pause : icons.Play" [size]="16"></lucide-icon>
          </button>

          <button
            type="button"
            (click)="audioPlayer.close()"
            class="btn-icon shrink-0"
            aria-label="Close player"
          >
            <lucide-icon [img]="icons.X" [size]="16"></lucide-icon>
          </button>
        </div>
      </div>
    }
  `,
})
export class MiniPlayerComponent {
  readonly audioPlayer = inject(AudioPlayerService);
  #router = inject(Router);

  readonly icons = { Headphones, Play, Pause, X };

  readonly progressPercent = computed(() => {
    const dur = this.audioPlayer.duration();
    return dur > 0 ? (this.audioPlayer.currentTime() / dur) * 100 : 0;
  });

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  navigateToModule(track: { courseId: string; moduleId: string }): void {
    this.#router.navigate(['/courses', track.courseId, 'modules', track.moduleId]);
  }
}
