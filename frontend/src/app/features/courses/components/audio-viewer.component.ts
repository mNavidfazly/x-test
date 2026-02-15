import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Headphones, Play, Pause, Volume2, VolumeX, Download } from 'lucide-angular';
import WaveSurfer from 'wavesurfer.js';
import { ModuleAudio } from '../../../core/models/course.model';
import { formatFileSize } from '../../../core/utils/file.utils';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-audio-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, LoadingSpinnerComponent, ErrorAlertComponent],
  host: { class: 'block' },
  template: `
    <div class="card space-y-4">
      <!-- File info header -->
      <div class="flex items-center gap-3">
        <lucide-icon [img]="icons.Headphones" [size]="24" class="text-teal-600"></lucide-icon>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-slate-900 truncate">{{ audio().file_name }}</h3>
          @if (audio().file_size) {
            <p class="text-sm text-slate-500">{{ formatFileSize(audio().file_size) }}</p>
          }
        </div>
      </div>

      @if (isLoading()) {
        <app-loading-spinner message="Loading audio..." />
      }

      @if (loadError()) {
        <app-error-alert [message]="loadError()!" />
      }

      <!-- Waveform container -->
      <div
        #waveformContainer
        class="rounded-lg overflow-hidden"
        [class.hidden]="isLoading() || loadError()"
        (contextmenu)="$event.preventDefault()"
      ></div>

      <!-- Controls -->
      @if (!isLoading() && !loadError()) {
        <div class="flex items-center gap-4">
          <!-- Play/Pause button -->
          <button
            type="button"
            (click)="togglePlay()"
            class="btn-icon w-10 h-10 flex items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors duration-200"
            [attr.aria-label]="isPlaying() ? 'Pause' : 'Play'"
          >
            <lucide-icon [img]="isPlaying() ? icons.Pause : icons.Play" [size]="18"></lucide-icon>
          </button>

          <!-- Time display -->
          <span class="text-sm font-medium text-slate-700 tabular-nums min-w-[100px]">
            {{ formatTime(currentTime()) }} / {{ formatTime(duration()) }}
          </span>

          <!-- Volume control -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="toggleMute()"
              class="text-slate-500 hover:text-slate-700 transition-colors"
              [attr.aria-label]="isMuted() ? 'Unmute' : 'Mute'"
            >
              <lucide-icon [img]="isMuted() ? icons.VolumeX : icons.Volume2" [size]="18"></lucide-icon>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              [ngModel]="volume()"
              (ngModelChange)="onVolumeChange($event)"
              class="w-20 h-1.5 accent-teal-600 cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <!-- Speed selector -->
          <select
            [ngModel]="playbackRate()"
            (ngModelChange)="onSpeedChange($event)"
            class="text-sm text-slate-600 bg-slate-100 rounded-md px-2 py-1 border border-slate-200 cursor-pointer"
            aria-label="Playback speed"
          >
            @for (speed of speeds; track speed) {
              <option [value]="speed">{{ speed }}x</option>
            }
          </select>
        </div>
      }
    </div>
  `,
})
export class AudioViewerComponent {
  readonly audio = input.required<ModuleAudio>();

  readonly waveformContainer = viewChild<ElementRef>('waveformContainer');

  readonly icons = { Headphones, Play, Pause, Volume2, VolumeX, Download };
  readonly speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
  readonly formatFileSize = formatFileSize;

  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(1);
  readonly isMuted = signal(false);
  readonly playbackRate = signal(1);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  #wavesurfer: WaveSurfer | null = null;
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const audioData = this.audio();
      const containerRef = this.waveformContainer();
      if (!audioData?.file_url || !containerRef) return;

      this.#destroyWaveSurfer();
      this.isLoading.set(true);
      this.loadError.set(null);

      const ws = WaveSurfer.create({
        container: containerRef.nativeElement,
        waveColor: '#99f6e4',
        progressColor: '#0d9488',
        cursorColor: '#14b8a6',
        height: 80,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        url: audioData.file_url,
      });

      ws.on('ready', () => {
        this.isLoading.set(false);
        this.duration.set(ws.getDuration());
      });

      ws.on('error', (err) => {
        this.isLoading.set(false);
        this.loadError.set(typeof err === 'string' ? err : 'Failed to load audio');
      });

      ws.on('timeupdate', (time: number) => {
        this.currentTime.set(time);
      });

      ws.on('play', () => {
        this.isPlaying.set(true);
      });

      ws.on('pause', () => {
        this.isPlaying.set(false);
      });

      this.#wavesurfer = ws;
    });

    this.#destroyRef.onDestroy(() => {
      this.#destroyWaveSurfer();
    });
  }

  togglePlay() {
    this.#wavesurfer?.playPause();
  }

  toggleMute() {
    if (this.#wavesurfer) {
      const newMuted = !this.isMuted();
      this.isMuted.set(newMuted);
      this.#wavesurfer.setVolume(newMuted ? 0 : this.volume());
    }
  }

  onVolumeChange(value: number) {
    this.volume.set(value);
    this.isMuted.set(value === 0);
    this.#wavesurfer?.setVolume(value);
  }

  onSpeedChange(rate: number) {
    this.playbackRate.set(Number(rate));
    this.#wavesurfer?.setPlaybackRate(Number(rate));
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  #destroyWaveSurfer() {
    if (this.#wavesurfer) {
      this.#wavesurfer.destroy();
      this.#wavesurfer = null;
    }
  }
}
