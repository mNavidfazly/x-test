import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { MiniPlayerComponent } from './mini-player.component';
import { AudioPlayerService } from '../../core/services/audio-player.service';
import {
  createMockAudioPlayerService,
  MockAudioPlayerService,
} from '../../__mocks__/audio-player.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';
import { ActiveTrack } from '../../core/services/audio-player.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

const mockTrack: ActiveTrack = {
  moduleId: 'mod-1',
  courseId: 'course-1',
  title: 'Introduction to Trading',
  fileName: 'intro-trading.mp3',
  fileUrl: 'https://example.com/intro.mp3',
  durationSeconds: 300,
};

async function renderMiniPlayer(options?: {
  activeTrack?: ActiveTrack | null;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
}) {
  const audioPlayer = createMockAudioPlayerService({
    activeTrack: options?.activeTrack ?? null,
    isPlaying: options?.isPlaying ?? false,
    currentTime: options?.currentTime ?? 0,
    duration: options?.duration ?? 0,
  });

  const { fixture } = await render(MiniPlayerComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      provideRouter([{ path: '**', component: DummyComponent }]),
      { provide: AudioPlayerService, useValue: audioPlayer },
    ],
  });

  return { fixture, audioPlayer };
}

describe('MiniPlayerComponent', () => {
  describe('when no active track', () => {
    it('renders nothing', async () => {
      await renderMiniPlayer({ activeTrack: null });

      expect(screen.queryByText('Introduction to Trading')).toBeNull();
      expect(screen.queryByLabelText('Play')).toBeNull();
      expect(screen.queryByLabelText('Close player')).toBeNull();
    });
  });

  describe('when active track is set', () => {
    it('shows track title and filename', async () => {
      await renderMiniPlayer({ activeTrack: mockTrack });

      expect(screen.getByText('Introduction to Trading')).toBeTruthy();
      expect(screen.getByText('intro-trading.mp3')).toBeTruthy();
    });

    it('shows play button when paused', async () => {
      await renderMiniPlayer({ activeTrack: mockTrack, isPlaying: false });

      expect(screen.getByLabelText('Play')).toBeTruthy();
      expect(screen.queryByLabelText('Pause')).toBeNull();
    });

    it('shows pause button when playing', async () => {
      await renderMiniPlayer({ activeTrack: mockTrack, isPlaying: true });

      expect(screen.getByLabelText('Pause')).toBeTruthy();
      expect(screen.queryByLabelText('Play')).toBeNull();
    });

    it('shows close player button', async () => {
      await renderMiniPlayer({ activeTrack: mockTrack });

      expect(screen.getByLabelText('Close player')).toBeTruthy();
    });

    it('shows time display', async () => {
      await renderMiniPlayer({
        activeTrack: mockTrack,
        currentTime: 65,
        duration: 300,
      });

      expect(screen.getByText('01:05 / 05:00')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls togglePlay when play/pause button is clicked', async () => {
      const user = userEvent.setup();
      const { audioPlayer } = await renderMiniPlayer({
        activeTrack: mockTrack,
        isPlaying: false,
      });

      await user.click(screen.getByLabelText('Play'));

      expect(audioPlayer.togglePlay).toHaveBeenCalledOnce();
    });

    it('calls close when close button is clicked', async () => {
      const user = userEvent.setup();
      const { audioPlayer } = await renderMiniPlayer({
        activeTrack: mockTrack,
      });

      await user.click(screen.getByLabelText('Close player'));

      expect(audioPlayer.close).toHaveBeenCalledOnce();
    });

    it('navigates to module route when track info is clicked', async () => {
      const user = userEvent.setup();
      await renderMiniPlayer({ activeTrack: mockTrack });

      const trackButton = screen.getByText('Introduction to Trading')
        .closest('button')!;
      await user.click(trackButton);

      const router = TestBed.inject(Router);
      expect(router.url).toBe('/courses/course-1/modules/mod-1');
    });
  });

  describe('progressPercent', () => {
    it('returns 0 when duration is 0', async () => {
      const { fixture } = await renderMiniPlayer({
        activeTrack: mockTrack,
        currentTime: 50,
        duration: 0,
      });

      expect(fixture.componentInstance.progressPercent()).toBe(0);
    });

    it('calculates correct percentage', async () => {
      const { fixture } = await renderMiniPlayer({
        activeTrack: mockTrack,
        currentTime: 150,
        duration: 300,
      });

      expect(fixture.componentInstance.progressPercent()).toBe(50);
    });

    it('returns 100 when at end', async () => {
      const { fixture } = await renderMiniPlayer({
        activeTrack: mockTrack,
        currentTime: 300,
        duration: 300,
      });

      expect(fixture.componentInstance.progressPercent()).toBe(100);
    });
  });

  describe('formatTime', () => {
    it('formats 0 seconds as 00:00', async () => {
      const { fixture } = await renderMiniPlayer({ activeTrack: mockTrack });

      expect(fixture.componentInstance.formatTime(0)).toBe('00:00');
    });

    it('formats seconds with zero-padded minutes and seconds', async () => {
      const { fixture } = await renderMiniPlayer({ activeTrack: mockTrack });

      expect(fixture.componentInstance.formatTime(5)).toBe('00:05');
      expect(fixture.componentInstance.formatTime(65)).toBe('01:05');
      expect(fixture.componentInstance.formatTime(3661)).toBe('61:01');
    });

    it('floors fractional seconds', async () => {
      const { fixture } = await renderMiniPlayer({ activeTrack: mockTrack });

      expect(fixture.componentInstance.formatTime(65.7)).toBe('01:05');
    });
  });
});
