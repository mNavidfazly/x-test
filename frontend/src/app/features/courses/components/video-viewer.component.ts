import { ChangeDetectionStrategy, Component, computed, effect, inject, input, OnDestroy, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule, Loader2, AlertCircle } from 'lucide-angular';
import { ModuleVideo } from '../../../core/models/course.model';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';

const POLL_INTERVAL_MS = 10_000;

@Component({
  selector: 'app-video-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="w-full max-w-4xl mx-auto">
      @switch (viewState()) {
        @case ('processing') {
          <div class="flex flex-col items-center justify-center gap-4 aspect-video rounded-lg bg-slate-100 border border-slate-200">
            <span class="inline-flex animate-spin"><lucide-icon [img]="Loader2" class="w-8 h-8 text-slate-400"></lucide-icon></span>
            <div class="text-center">
              <p class="text-sm font-medium text-slate-600">Video is being processed</p>
              <p class="text-xs text-slate-500 mt-1">This may take a few minutes.</p>
            </div>
            @if (encodeProgress() > 0) {
              <div class="w-48">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-slate-600">Encoding</span>
                  <span class="text-xs font-semibold text-slate-700 tabular-nums">{{ encodeProgress() }}%</span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    [style.width.%]="encodeProgress()"
                  ></div>
                </div>
              </div>
            }
          </div>
        }
        @case ('failed') {
          <div class="flex flex-col items-center justify-center gap-3 aspect-video rounded-lg bg-rose-50 border border-rose-200">
            <lucide-icon [img]="AlertCircle" class="w-8 h-8 text-rose-400"></lucide-icon>
            <p class="text-sm font-medium text-rose-700">Video encoding failed</p>
            <p class="text-xs text-rose-500">Please try re-uploading the video.</p>
          </div>
        }
        @case ('ready') {
          @if (trustedEmbedUrl()) {
            <div class="relative w-full" style="padding-top: 56.25%">
              <iframe
                [src]="trustedEmbedUrl()"
                class="absolute inset-0 w-full h-full rounded-lg"
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
              ></iframe>
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center gap-3 aspect-video rounded-lg bg-slate-100 border border-slate-200">
              <span class="inline-flex animate-spin"><lucide-icon [img]="Loader2" class="w-8 h-8 text-slate-400"></lucide-icon></span>
              <p class="text-sm text-slate-600">Loading video...</p>
            </div>
          }
        }
      }
      @if (formattedDuration()) {
        <p class="text-xs text-slate-500 mt-2 tabular-nums">Duration: {{ formattedDuration() }}</p>
      }
    </div>
  `,
})
export class VideoViewerComponent implements OnDestroy {
  readonly video = input.required<ModuleVideo>();

  readonly #sanitizer = inject(DomSanitizer);
  readonly #bunnyUpload = inject(BunnyUploadService);

  protected readonly Loader2 = Loader2;
  protected readonly AlertCircle = AlertCircle;

  readonly #embedUrl = signal<string | null>(null);
  readonly #polledStatus = signal<number | null>(null);
  readonly encodeProgress = signal(0);
  #pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly trustedEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.#embedUrl();
    return url ? this.#sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  readonly viewState = computed(() => {
    const polled = this.#polledStatus();
    const status = polled ?? this.video().encoding_status;
    if (status === 5) return 'failed';
    if (status >= 4) return 'ready';
    return 'processing';
  });

  readonly formattedDuration = computed(() => {
    const seconds = this.video().duration;
    if (seconds == null || seconds <= 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  constructor() {
    effect(() => {
      const v = this.video();
      this.#stopPolling();
      this.#polledStatus.set(null);
      this.encodeProgress.set(0);

      if (v.encoding_status >= 4 && v.encoding_status !== 5) {
        this.#fetchEmbedUrl(v.bunny_video_id);
      } else if (v.encoding_status < 4) {
        this.#pollEncodingProgress(v.bunny_video_id);
      }
    });
  }

  ngOnDestroy() {
    this.#stopPolling();
  }

  #fetchEmbedUrl(videoId: string) {
    this.#bunnyUpload.pollStatus(videoId).subscribe({
      next: (status) => {
        if (status.embed_url) {
          this.#embedUrl.set(status.embed_url);
        }
      },
      error: () => {
        // Silently fail — viewer shows loading state
      },
    });
  }

  #pollEncodingProgress(videoId: string) {
    this.#fetchProgress(videoId);

    this.#pollTimer = setInterval(() => {
      this.#fetchProgress(videoId);
    }, POLL_INTERVAL_MS);
  }

  #fetchProgress(videoId: string) {
    this.#bunnyUpload.pollStatus(videoId).subscribe({
      next: (status) => {
        this.encodeProgress.set(status.encode_progress);
        this.#polledStatus.set(status.status);

        if (status.status >= 4) {
          this.#stopPolling();
          if (status.embed_url) {
            this.#embedUrl.set(status.embed_url);
          }
        }
      },
      error: () => {
        // Silently fail — will retry on next interval
      },
    });
  }

  #stopPolling() {
    if (this.#pollTimer) {
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
    }
  }
}
