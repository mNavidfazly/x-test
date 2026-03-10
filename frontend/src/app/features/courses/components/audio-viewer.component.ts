import {
  ChangeDetectionStrategy,
  Component,
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
import { AudioPlayerService } from '../../../core/services/audio-player.service';
import { CourseService } from '../../../core/services/course.service';
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
        @if (audio().file_size) {
          <span class="text-sm text-slate-500">{{ formatFileSize(audio().file_size) }}</span>
        }
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
            [attr.aria-label]="audioPlayer.isPlaying() ? 'Pause' : 'Play'"
          >
            <lucide-icon [img]="audioPlayer.isPlaying() ? icons.Pause : icons.Play" [size]="18"></lucide-icon>
          </button>

          <!-- Time display -->
          <span class="text-sm font-medium text-slate-700 tabular-nums min-w-[100px]">
            {{ formatTime(audioPlayer.currentTime()) }} / {{ formatTime(audioPlayer.duration()) }}
          </span>

          <!-- Volume control -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="toggleMute()"
              class="text-slate-500 hover:text-slate-700 transition-colors"
              [attr.aria-label]="audioPlayer.isMuted() ? 'Unmute' : 'Mute'"
            >
              <lucide-icon [img]="audioPlayer.isMuted() ? icons.VolumeX : icons.Volume2" [size]="18"></lucide-icon>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              [ngModel]="audioPlayer.volume()"
              (ngModelChange)="onVolumeChange($event)"
              class="w-20 h-1.5 accent-teal-600 cursor-pointer"
              aria-label="Volume"
            />
          </div>

          <!-- Speed selector -->
          <div class="relative">
            <app-custom-select
              [options]="speedOptions"
              [value]="audioPlayer.playbackRate().toString()"
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
  readonly moduleId = input.required<string>();
  readonly courseId = input.required<string>();
  readonly moduleTitle = input.required<string>();

  readonly waveformContainer = viewChild<ElementRef>('waveformContainer');

  readonly audioPlayer = inject(AudioPlayerService);
  readonly #courseService = inject(CourseService);

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

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  #wavesurfer: WaveSurfer | null = null;
  #wasPlaying = false;
  readonly #destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const audioData = this.audio();
      const containerRef = this.waveformContainer();
      const modId = this.moduleId();
      if (!audioData?.file_url || !containerRef || !modId) return;

      this.#destroyWaveSurferOnly();
      this.isLoading.set(true);
      this.loadError.set(null);

      // Get or create audio element via AudioPlayerService
      const audioNeighbors = this.#courseService.findAudioNeighbors(modId);
      const audioElement = this.audioPlayer.play({
        moduleId: modId,
        courseId: this.courseId(),
        title: this.moduleTitle(),
        fileUrl: audioData.file_url,
        durationSeconds: audioData.duration_seconds,
        nextModuleId: audioNeighbors.next ?? undefined,
        prevModuleId: audioNeighbors.prev ?? undefined,
      });

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
      });

      ws.on('error', (err) => {
        this.isLoading.set(false);
        this.loadError.set(typeof err === 'string' ? err : 'Failed to load audio');
      });

      this.#wavesurfer = ws;
    });

    this.#destroyRef.onDestroy(() => {
      // Only destroy WaveSurfer visualization — keep audio playing in service
      this.#wasPlaying = this.audioPlayer.isPlaying();
      this.#destroyWaveSurferOnly();
      // WaveSurfer.destroy() may pause the media element — resume if was playing
      if (this.#wasPlaying) {
        this.audioPlayer.resumeIfWasPlaying();
      }
    });
  }

  togglePlay() {
    this.#wavesurfer?.playPause();
  }

  toggleMute() {
    this.audioPlayer.toggleMute();
    if (this.#wavesurfer) {
      this.#wavesurfer.setVolume(this.audioPlayer.isMuted() ? 0 : this.audioPlayer.volume());
    }
  }

  onVolumeChange(value: number) {
    this.audioPlayer.setVolume(value);
    this.#wavesurfer?.setVolume(value);
  }

  onSpeedChange(rate: number) {
    this.audioPlayer.setPlaybackRate(Number(rate));
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
      const base = 0.3 + 0.2 * Math.sin(i * 0.05) + 0.15 * Math.sin(i * 0.13);
      const variation = 0.1 * Math.sin(i * 0.37) + 0.05 * Math.sin(i * 0.71);
      peaks[i] = Math.min(1, Math.max(0.1, base + variation));
    }
    return peaks;
  }

  /** Destroy WaveSurfer visualization only — does NOT stop audio playback */
  #destroyWaveSurferOnly() {
    if (this.#wavesurfer) {
      this.#wavesurfer.destroy();
      this.#wavesurfer = null;
    }
  }
}
