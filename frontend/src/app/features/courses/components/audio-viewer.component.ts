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
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-audio-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormsModule, LoadingSpinnerComponent, ErrorAlertComponent, CustomSelectComponent],
  host: { class: 'block' },
  template: `
    <div class="card p-6 space-y-4">
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
          <div class="relative">
            <app-custom-select
              [options]="speedOptions"
              [value]="playbackRate().toString()"
              (valueChange)="onSpeedChange($any($event))"
              ariaLabel="Playback speed"
            />
          </div>

          <div class="flex-1"></div>

          <!-- Download button -->
          <a
            [href]="audio().file_url"
            [download]="audio().file_name"
            class="text-slate-400 hover:text-teal-600 transition-colors duration-200"
            aria-label="Download audio"
          >
            <lucide-icon [img]="icons.Download" [size]="18"></lucide-icon>
          </a>
        </div>
      }
    </div>
  `,
})
export class AudioViewerComponent {
  readonly audio = input.required<ModuleAudio>();

  readonly waveformContainer = viewChild<ElementRef>('waveformContainer');

  readonly icons = { Headphones, Play, Pause, Volume2, VolumeX, Download };
  readonly speedOptions: SelectOption[] = [
    { value: '0.5', label: '0.5x' },
    { value: '0.75', label: '0.75x' },
    { value: '1', label: '1x' },
    { value: '1.25', label: '1.25x' },
    { value: '1.5', label: '1.5x' },
    { value: '2', label: '2x' },
  ];
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

      // Use HTML5 Audio element for streaming playback instead of Web Audio API.
      // Web Audio's decodeAudioData loads the entire file into memory (~10x decoded size),
      // which fails for large MP3s (30-50 MB -> 300-500 MB PCM in memory).
      // Provide generated peaks so WaveSurfer doesn't fetch the file for waveform rendering.
      const audioElement = new Audio(audioData.file_url);
      audioElement.preload = 'metadata';

      const ws = WaveSurfer.create({
        container: containerRef.nativeElement,
        waveColor: '#99f6e4',
        progressColor: '#0d9488',
        cursorColor: '#14b8a6',
        height: 80,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        media: audioElement,
        peaks: [this.#generatePeaks(200)],
        duration: audioData.duration_seconds || undefined,
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

  #generatePeaks(length: number): Float32Array {
    const peaks = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      // Generate a natural-looking waveform pattern using sine waves
      const base = 0.3 + 0.2 * Math.sin(i * 0.05) + 0.15 * Math.sin(i * 0.13);
      const variation = 0.1 * Math.sin(i * 0.37) + 0.05 * Math.sin(i * 0.71);
      peaks[i] = Math.min(1, Math.max(0.1, base + variation));
    }
    return peaks;
  }

  #destroyWaveSurfer() {
    if (this.#wavesurfer) {
      this.#wavesurfer.destroy();
      this.#wavesurfer = null;
    }
  }
}
