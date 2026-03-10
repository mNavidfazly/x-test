import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ActiveTrack } from '../core/services/audio-player.service';

export function createMockAudioPlayerService(options?: {
  activeTrack?: ActiveTrack | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  playbackRate?: number;
}) {
  return {
    activeTrack: signal<ActiveTrack | null>(options?.activeTrack ?? null),
    isPlaying: signal(options?.isPlaying ?? false),
    currentTime: signal(options?.currentTime ?? 0),
    duration: signal(options?.duration ?? 0),
    volume: signal(options?.volume ?? 1),
    isMuted: signal(options?.isMuted ?? false),
    playbackRate: signal(options?.playbackRate ?? 1),
    play: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setPlaybackRate: vi.fn(),
    close: vi.fn(),
    resumeIfWasPlaying: vi.fn(),
    getAudioElement: vi.fn().mockReturnValue(null),
  };
}

export type MockAudioPlayerService = ReturnType<
  typeof createMockAudioPlayerService
>;
