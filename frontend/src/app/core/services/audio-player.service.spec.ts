import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioPlayerService, ActiveTrack } from './audio-player.service';

function createMockAudio() {
  const listeners: Record<string, Function[]> = {};
  return {
    play: vi.fn().mockReturnValue(Promise.resolve()),
    pause: vi.fn(),
    addEventListener: vi.fn((event: string, handler: Function) => {
      (listeners[event] ??= []).push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
    }),
    volume: 1,
    playbackRate: 1,
    currentTime: 0,
    duration: 0,
    paused: true,
    src: '',
    preload: '',
    // Helper to fire an event
    _fire(event: string) {
      (listeners[event] ?? []).forEach((h) => h());
    },
    _listeners: listeners,
  };
}

type MockAudio = ReturnType<typeof createMockAudio>;

function createTrack(overrides: Partial<ActiveTrack> = {}): ActiveTrack {
  return {
    moduleId: 'mod-1',
    courseId: 'course-1',
    title: 'Test Track',
    fileUrl: 'https://example.com/audio.mp3',
    durationSeconds: 120,
    ...overrides,
  };
}

describe('AudioPlayerService', () => {
  let service: AudioPlayerService;
  let mockAudio: MockAudio;

  beforeEach(() => {
    mockAudio = createMockAudio();
    vi.spyOn(globalThis, 'Audio').mockImplementation(
      () => mockAudio as any
    );

    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioPlayerService);
  });

  describe('initial state', () => {
    it('should have null active track and default signal values', () => {
      expect(service.activeTrack()).toBeNull();
      expect(service.isPlaying()).toBe(false);
      expect(service.currentTime()).toBe(0);
      expect(service.duration()).toBe(0);
      expect(service.volume()).toBe(1);
      expect(service.isMuted()).toBe(false);
      expect(service.playbackRate()).toBe(1);
      expect(service.getAudioElement()).toBeNull();
    });
  });

  describe('play()', () => {
    it('should create a new Audio element and set track signals', () => {
      const track = createTrack();
      const el = service.play(track);

      expect(globalThis.Audio).toHaveBeenCalledWith(track.fileUrl);
      expect(el).toBe(mockAudio);
      expect(service.activeTrack()).toEqual(track);
      expect(service.currentTime()).toBe(0);
      expect(service.duration()).toBe(120);
      expect(service.isPlaying()).toBe(false);
      expect(mockAudio.preload).toBe('metadata');
      expect(mockAudio.volume).toBe(1);
      expect(mockAudio.playbackRate).toBe(1);
    });

    it('should use null durationSeconds as 0', () => {
      service.play(createTrack({ durationSeconds: null }));
      expect(service.duration()).toBe(0);
    });

    it('should return existing element when same moduleId is played again', () => {
      const track = createTrack();
      const el1 = service.play(track);
      const el2 = service.play(track);

      expect(el1).toBe(el2);
      // Audio constructor should only be called once
      expect(globalThis.Audio).toHaveBeenCalledTimes(1);
    });

    it('should destroy old element and create new when different moduleId', () => {
      const track1 = createTrack({ moduleId: 'mod-1' });
      service.play(track1);

      const mockAudio2 = createMockAudio();
      vi.mocked(globalThis.Audio).mockImplementation(() => mockAudio2 as any);

      const track2 = createTrack({ moduleId: 'mod-2', title: 'Second Track' });
      const el2 = service.play(track2);

      // Old element should be destroyed
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.src).toBe('');
      expect(mockAudio.removeEventListener).toHaveBeenCalled();

      // New element should be active
      expect(el2).toBe(mockAudio2);
      expect(service.activeTrack()?.moduleId).toBe('mod-2');
    });

    it('should apply current volume and playbackRate to new element', () => {
      service.setVolume(0.5);
      service.setPlaybackRate(1.5);

      service.play(createTrack());

      expect(mockAudio.volume).toBe(0.5);
      expect(mockAudio.playbackRate).toBe(1.5);
    });

    it('should attach event listeners', () => {
      service.play(createTrack());

      const events = mockAudio.addEventListener.mock.calls.map(
        (c: any[]) => c[0]
      );
      expect(events).toContain('timeupdate');
      expect(events).toContain('play');
      expect(events).toContain('pause');
      expect(events).toContain('ended');
      expect(events).toContain('loadedmetadata');
    });
  });

  describe('getAudioElement()', () => {
    it('should return null when no track is playing', () => {
      expect(service.getAudioElement()).toBeNull();
    });

    it('should return the audio element after play()', () => {
      service.play(createTrack());
      expect(service.getAudioElement()).toBe(mockAudio);
    });
  });

  describe('togglePlay()', () => {
    it('should do nothing when no element exists', () => {
      service.togglePlay();
      // No error thrown
    });

    it('should call play() when paused', () => {
      service.play(createTrack());
      mockAudio.paused = true;

      service.togglePlay();

      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should call pause() when playing', () => {
      service.play(createTrack());
      mockAudio.paused = false;

      service.togglePlay();

      expect(mockAudio.pause).toHaveBeenCalled();
    });
  });

  describe('seek()', () => {
    it('should do nothing when no element exists', () => {
      service.seek(30);
      // No error thrown
    });

    it('should set currentTime on the audio element', () => {
      service.play(createTrack());
      service.seek(45.5);

      expect(mockAudio.currentTime).toBe(45.5);
    });
  });

  describe('skipForward()', () => {
    it('should do nothing when no element exists', () => {
      service.skipForward();
      // No error thrown
    });

    it('should advance currentTime by 10 seconds by default', () => {
      service.play(createTrack());
      mockAudio.currentTime = 30;
      mockAudio.duration = 120;

      service.skipForward();

      expect(mockAudio.currentTime).toBe(40);
    });

    it('should advance by custom seconds', () => {
      service.play(createTrack());
      mockAudio.currentTime = 30;
      mockAudio.duration = 120;

      service.skipForward(15);

      expect(mockAudio.currentTime).toBe(45);
    });

    it('should not exceed duration', () => {
      service.play(createTrack());
      mockAudio.currentTime = 115;
      mockAudio.duration = 120;

      service.skipForward();

      expect(mockAudio.currentTime).toBe(120);
    });
  });

  describe('skipBack()', () => {
    it('should do nothing when no element exists', () => {
      service.skipBack();
      // No error thrown
    });

    it('should rewind currentTime by 10 seconds by default', () => {
      service.play(createTrack());
      mockAudio.currentTime = 30;

      service.skipBack();

      expect(mockAudio.currentTime).toBe(20);
    });

    it('should rewind by custom seconds', () => {
      service.play(createTrack());
      mockAudio.currentTime = 30;

      service.skipBack(5);

      expect(mockAudio.currentTime).toBe(25);
    });

    it('should not go below 0', () => {
      service.play(createTrack());
      mockAudio.currentTime = 5;

      service.skipBack();

      expect(mockAudio.currentTime).toBe(0);
    });
  });

  describe('setVolume()', () => {
    it('should update volume signal and audio element', () => {
      service.play(createTrack());
      service.setVolume(0.7);

      expect(service.volume()).toBe(0.7);
      expect(mockAudio.volume).toBe(0.7);
      expect(service.isMuted()).toBe(false);
    });

    it('should set isMuted to true when volume is 0', () => {
      service.play(createTrack());
      service.setVolume(0);

      expect(service.volume()).toBe(0);
      expect(service.isMuted()).toBe(true);
    });

    it('should update signal even without an audio element', () => {
      service.setVolume(0.3);
      expect(service.volume()).toBe(0.3);
    });
  });

  describe('toggleMute()', () => {
    it('should mute and set element volume to 0', () => {
      service.play(createTrack());
      service.setVolume(0.8);

      service.toggleMute();

      expect(service.isMuted()).toBe(true);
      expect(mockAudio.volume).toBe(0);
    });

    it('should unmute and restore element volume', () => {
      service.play(createTrack());
      service.setVolume(0.8);
      service.toggleMute(); // mute

      service.toggleMute(); // unmute

      expect(service.isMuted()).toBe(false);
      expect(mockAudio.volume).toBe(0.8);
    });

    it('should do nothing to element when no element exists', () => {
      service.toggleMute();
      expect(service.isMuted()).toBe(true);
    });
  });

  describe('setPlaybackRate()', () => {
    it('should update signal and audio element', () => {
      service.play(createTrack());
      service.setPlaybackRate(2);

      expect(service.playbackRate()).toBe(2);
      expect(mockAudio.playbackRate).toBe(2);
    });

    it('should update signal even without an audio element', () => {
      service.setPlaybackRate(1.5);
      expect(service.playbackRate()).toBe(1.5);
    });
  });

  describe('close()', () => {
    it('should destroy element and reset all signals', () => {
      service.play(createTrack());
      mockAudio._fire('play');

      service.close();

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.src).toBe('');
      expect(mockAudio.removeEventListener).toHaveBeenCalled();
      expect(service.activeTrack()).toBeNull();
      expect(service.isPlaying()).toBe(false);
      expect(service.currentTime()).toBe(0);
      expect(service.duration()).toBe(0);
      expect(service.getAudioElement()).toBeNull();
    });

    it('should be safe to call when nothing is playing', () => {
      service.close();
      expect(service.activeTrack()).toBeNull();
    });
  });

  describe('resumeIfWasPlaying()', () => {
    it('should call play() on element when isPlaying is true', () => {
      service.play(createTrack());
      mockAudio._fire('play'); // sets isPlaying to true
      mockAudio.play.mockClear();

      service.resumeIfWasPlaying();

      expect(mockAudio.play).toHaveBeenCalled();
    });

    it('should not call play() when isPlaying is false', () => {
      service.play(createTrack());
      mockAudio.play.mockClear();

      service.resumeIfWasPlaying();

      expect(mockAudio.play).not.toHaveBeenCalled();
    });

    it('should not call play() when no element exists', () => {
      service.resumeIfWasPlaying();
      // No error thrown
    });
  });

  describe('event listeners update signals', () => {
    beforeEach(() => {
      service.play(createTrack());
    });

    it('timeupdate should update currentTime signal', () => {
      mockAudio.currentTime = 33.7;
      mockAudio._fire('timeupdate');

      expect(service.currentTime()).toBe(33.7);
    });

    it('play event should set isPlaying to true', () => {
      mockAudio._fire('play');
      expect(service.isPlaying()).toBe(true);
    });

    it('pause event should set isPlaying to false', () => {
      mockAudio._fire('play');
      mockAudio._fire('pause');
      expect(service.isPlaying()).toBe(false);
    });

    it('ended event should set isPlaying to false', () => {
      mockAudio._fire('play');
      mockAudio._fire('ended');
      expect(service.isPlaying()).toBe(false);
    });

    it('ended event should set trackEnded to true', () => {
      mockAudio._fire('ended');
      expect(service.trackEnded()).toBe(true);
    });

    it('trackEnded should reset to false on new play()', () => {
      mockAudio._fire('ended');
      expect(service.trackEnded()).toBe(true);

      const mockAudio2 = createMockAudio();
      vi.mocked(globalThis.Audio).mockImplementation(() => mockAudio2 as any);
      service.play(createTrack({ moduleId: 'mod-2' }));

      expect(service.trackEnded()).toBe(false);
    });

    it('loadedmetadata should update duration from element', () => {
      mockAudio.duration = 245.3;
      mockAudio._fire('loadedmetadata');

      expect(service.duration()).toBe(245.3);
    });
  });
});
