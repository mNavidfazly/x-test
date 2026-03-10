import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, Headphones, Play, Pause, X, RotateCcw, RotateCw, SkipBack, SkipForward, Loader2 } from 'lucide-angular';
import { AudioPlayerService, ActiveTrack } from '../../core/services/audio-player.service';
import { CourseService } from '../../core/services/course.service';

@Component({
  selector: 'app-mini-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (audioPlayer.activeTrack(); as track) {
      <div class="bg-white border-t border-slate-200 shadow-lg">
        <div class="h-1 bg-slate-100">
          <div
            class="h-full bg-teal-600 transition-[width] duration-300"
            [style.width.%]="progressPercent()"
          ></div>
        </div>
        <div class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 max-w-screen-2xl mx-auto">
          <!-- Track info (clickable) -->
          <button
            type="button"
            class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 text-left"
            (click)="navigateToModule(track)"
          >
            <lucide-icon [img]="icons.Headphones" [size]="20" class="text-teal-600 shrink-0"></lucide-icon>
            <p class="text-sm font-medium text-slate-900 truncate">{{ track.title }}</p>
          </button>

          <!-- Time display -->
          <span class="text-xs text-slate-500 tabular-nums hidden sm:block whitespace-nowrap">
            {{ formatTime(audioPlayer.currentTime()) }} / {{ formatTime(audioPlayer.duration()) }}
          </span>

          <!-- Prev audio -->
          @if (track.prevModuleId) {
            <button
              type="button"
              (click)="goToPrev(track)"
              class="btn-icon shrink-0 hidden sm:flex"
              aria-label="Previous audio"
              [disabled]="isLoadingTrack()"
            >
              @if (isLoadingTrack()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
              } @else {
                <lucide-icon [img]="icons.SkipBack" [size]="16"></lucide-icon>
              }
            </button>
          }

          <!-- Skip back 10s -->
          <button
            type="button"
            (click)="audioPlayer.skipBack()"
            class="btn-icon shrink-0"
            aria-label="Skip back 10 seconds"
          >
            <lucide-icon [img]="icons.RotateCcw" [size]="16"></lucide-icon>
          </button>

          <!-- Play/Pause -->
          <button
            type="button"
            (click)="audioPlayer.togglePlay()"
            class="btn-icon w-9 h-9 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors duration-200 shrink-0"
            [attr.aria-label]="audioPlayer.isPlaying() ? 'Pause' : 'Play'"
          >
            <lucide-icon [img]="audioPlayer.isPlaying() ? icons.Pause : icons.Play" [size]="16"></lucide-icon>
          </button>

          <!-- Skip forward 10s -->
          <button
            type="button"
            (click)="audioPlayer.skipForward()"
            class="btn-icon shrink-0"
            aria-label="Skip forward 10 seconds"
          >
            <lucide-icon [img]="icons.RotateCw" [size]="16"></lucide-icon>
          </button>

          <!-- Next audio -->
          @if (track.nextModuleId) {
            <button
              type="button"
              (click)="goToNext(track)"
              class="btn-icon shrink-0 hidden sm:flex"
              aria-label="Next audio"
              [disabled]="isLoadingTrack()"
            >
              @if (isLoadingTrack()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
              } @else {
                <lucide-icon [img]="icons.SkipForward" [size]="16"></lucide-icon>
              }
            </button>
          }

          <!-- Close -->
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
  readonly #router = inject(Router);
  readonly #courseService = inject(CourseService);

  readonly icons = { Headphones, Play, Pause, X, RotateCcw, RotateCw, SkipBack, SkipForward, Loader2 };

  readonly isLoadingTrack = signal(false);

  readonly progressPercent = computed(() => {
    const dur = this.audioPlayer.duration();
    return dur > 0 ? (this.audioPlayer.currentTime() / dur) * 100 : 0;
  });

  constructor() {
    // Auto-advance to next audio when current track ends
    effect(() => {
      if (this.audioPlayer.trackEnded()) {
        const track = this.audioPlayer.activeTrack();
        if (track?.nextModuleId) {
          this.goToNext(track);
        }
      }
    });
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  navigateToModule(track: { courseId: string; moduleId: string }): void {
    this.#router.navigate(['/courses', track.courseId, 'modules', track.moduleId]);
  }

  async goToNext(track: ActiveTrack): Promise<void> {
    if (!track.nextModuleId || this.isLoadingTrack()) return;
    this.isLoadingTrack.set(true);
    try {
      const next = await this.#courseService.fetchAudioTrack(track.courseId, track.nextModuleId);
      if (next) {
        this.audioPlayer.play(next);
        this.audioPlayer.getAudioElement()?.play();
      }
    } finally {
      this.isLoadingTrack.set(false);
    }
  }

  async goToPrev(track: ActiveTrack): Promise<void> {
    if (!track.prevModuleId || this.isLoadingTrack()) return;
    this.isLoadingTrack.set(true);
    try {
      const prev = await this.#courseService.fetchAudioTrack(track.courseId, track.prevModuleId);
      if (prev) {
        this.audioPlayer.play(prev);
        this.audioPlayer.getAudioElement()?.play();
      }
    } finally {
      this.isLoadingTrack.set(false);
    }
  }
}
