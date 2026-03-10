import { Injectable, signal } from '@angular/core';

export interface ActiveTrack {
  moduleId: string;
  courseId: string;
  title: string;
  fileUrl: string;
  durationSeconds: number | null;
  nextModuleId?: string;
  prevModuleId?: string;
}

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  readonly #activeTrack = signal<ActiveTrack | null>(null);
  readonly #isPlaying = signal(false);
  readonly #currentTime = signal(0);
  readonly #duration = signal(0);
  readonly #volume = signal(1);
  readonly #isMuted = signal(false);
  readonly #playbackRate = signal(1);
  readonly #trackEnded = signal(false);

  readonly activeTrack = this.#activeTrack.asReadonly();
  readonly isPlaying = this.#isPlaying.asReadonly();
  readonly currentTime = this.#currentTime.asReadonly();
  readonly duration = this.#duration.asReadonly();
  readonly volume = this.#volume.asReadonly();
  readonly isMuted = this.#isMuted.asReadonly();
  readonly playbackRate = this.#playbackRate.asReadonly();
  readonly trackEnded = this.#trackEnded.asReadonly();

  #audioElement: HTMLAudioElement | null = null;

  /**
   * Start playing a track. If the same moduleId is already playing, returns the existing element.
   * If a different track is playing, replaces it.
   */
  play(track: ActiveTrack): HTMLAudioElement {
    const current = this.#activeTrack();

    // Same track already loaded — return existing element
    if (current && current.moduleId === track.moduleId && this.#audioElement) {
      return this.#audioElement;
    }

    // Different track or nothing playing — destroy old and create new
    this.#destroyAudioElement();

    const audio = new Audio(track.fileUrl);
    audio.preload = 'metadata';
    audio.volume = this.#volume();
    audio.playbackRate = this.#playbackRate();

    this.#attachListeners(audio);
    this.#audioElement = audio;
    this.#activeTrack.set(track);
    this.#currentTime.set(0);
    this.#duration.set(track.durationSeconds ?? 0);
    this.#isPlaying.set(false);
    this.#trackEnded.set(false);

    return audio;
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.#audioElement;
  }

  togglePlay(): void {
    if (!this.#audioElement) return;
    if (this.#audioElement.paused) {
      this.#audioElement.play();
    } else {
      this.#audioElement.pause();
    }
  }

  seek(time: number): void {
    if (this.#audioElement) {
      this.#audioElement.currentTime = time;
    }
  }

  skipForward(seconds = 10): void {
    if (!this.#audioElement) return;
    this.#audioElement.currentTime = Math.min(
      this.#audioElement.currentTime + seconds,
      this.#audioElement.duration || Infinity
    );
  }

  skipBack(seconds = 10): void {
    if (!this.#audioElement) return;
    this.#audioElement.currentTime = Math.max(this.#audioElement.currentTime - seconds, 0);
  }

  setVolume(v: number): void {
    this.#volume.set(v);
    this.#isMuted.set(v === 0);
    if (this.#audioElement) {
      this.#audioElement.volume = v;
    }
  }

  toggleMute(): void {
    const newMuted = !this.#isMuted();
    this.#isMuted.set(newMuted);
    if (this.#audioElement) {
      this.#audioElement.volume = newMuted ? 0 : this.#volume();
    }
  }

  setPlaybackRate(rate: number): void {
    this.#playbackRate.set(rate);
    if (this.#audioElement) {
      this.#audioElement.playbackRate = rate;
    }
  }

  close(): void {
    this.#destroyAudioElement();
    this.#activeTrack.set(null);
    this.#isPlaying.set(false);
    this.#currentTime.set(0);
    this.#duration.set(0);
  }

  /**
   * Resume playback after WaveSurfer.destroy() may have paused the element.
   * Call this in AudioViewerComponent's DestroyRef callback.
   */
  resumeIfWasPlaying(): void {
    if (this.#audioElement && this.#isPlaying()) {
      this.#audioElement.play();
    }
  }

  #attachListeners(audio: HTMLAudioElement): void {
    audio.addEventListener('timeupdate', this.#onTimeUpdate);
    audio.addEventListener('play', this.#onPlay);
    audio.addEventListener('pause', this.#onPause);
    audio.addEventListener('ended', this.#onEnded);
    audio.addEventListener('loadedmetadata', this.#onLoadedMetadata);
  }

  #removeListeners(audio: HTMLAudioElement): void {
    audio.removeEventListener('timeupdate', this.#onTimeUpdate);
    audio.removeEventListener('play', this.#onPlay);
    audio.removeEventListener('pause', this.#onPause);
    audio.removeEventListener('ended', this.#onEnded);
    audio.removeEventListener('loadedmetadata', this.#onLoadedMetadata);
  }

  #destroyAudioElement(): void {
    if (this.#audioElement) {
      this.#audioElement.pause();
      this.#removeListeners(this.#audioElement);
      this.#audioElement.src = '';
      this.#audioElement = null;
    }
  }

  // Arrow functions to preserve `this` context in event listeners
  #onTimeUpdate = (): void => {
    if (this.#audioElement) {
      this.#currentTime.set(this.#audioElement.currentTime);
    }
  };

  #onPlay = (): void => {
    this.#isPlaying.set(true);
  };

  #onPause = (): void => {
    this.#isPlaying.set(false);
  };

  #onEnded = (): void => {
    this.#isPlaying.set(false);
    this.#trackEnded.set(true);
  };

  #onLoadedMetadata = (): void => {
    if (this.#audioElement) {
      this.#duration.set(this.#audioElement.duration);
    }
  };
}
