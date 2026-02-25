import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { FormsModule } from '@angular/forms';
import { AudioViewerComponent } from './audio-viewer.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { CustomSelectComponent } from '../../../shared/components/custom-select.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { ModuleAudio } from '../../../core/models/course.model';

vi.mock('wavesurfer.js', () => {
  const mockWs = {
    play: vi.fn(),
    pause: vi.fn(),
    playPause: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    getDuration: vi.fn(() => 300),
    getCurrentTime: vi.fn(() => 0),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    seekTo: vi.fn(),
  };
  return { default: { create: vi.fn(() => mockWs) } };
});

function createMockAudio(overrides: Partial<ModuleAudio> = {}): ModuleAudio {
  return {
    file_url: 'https://example.com/audio.mp3',
    file_name: 'lecture-recording.mp3',
    file_size: 5242880,
    duration_seconds: 300,
    mime_type: 'audio/mpeg',
    ...overrides,
  };
}

async function renderAudioViewer(audio: ModuleAudio) {
  const result = await render(AudioViewerComponent, {
    componentInputs: { audio },
    componentImports: [MockLucideIconComponent, FormsModule, LoadingSpinnerComponent, ErrorAlertComponent, CustomSelectComponent],
  });

  // Allow effect to run
  await new Promise((r) => setTimeout(r));
  result.fixture.detectChanges();

  return result;
}

async function triggerWaveSurferReady(fixture: any) {
  const mockCreate = (await import('wavesurfer.js')).default.create;
  const mockWs = (mockCreate as any).mock.results[0]?.value;
  const readyCall = mockWs.on.mock.calls.find((c: any) => c[0] === 'ready');
  readyCall?.[1]();
  fixture.detectChanges();
  return mockWs;
}

describe('AudioViewerComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display file name', async () => {
    const audio = createMockAudio({ file_name: 'my-podcast.mp3' });
    await renderAudioViewer(audio);

    expect(screen.getByText('my-podcast.mp3')).toBeTruthy();
  });

  it('should display file size', async () => {
    const audio = createMockAudio({ file_size: 5242880 });
    await renderAudioViewer(audio);

    expect(screen.getByText('5.0 MB')).toBeTruthy();
  });

  it('should show loading spinner initially', async () => {
    const audio = createMockAudio();
    await renderAudioViewer(audio);

    expect(screen.getByText('Loading audio...')).toBeTruthy();
  });

  it('should show controls after WaveSurfer ready', async () => {
    const audio = createMockAudio();
    const { fixture } = await renderAudioViewer(audio);

    await triggerWaveSurferReady(fixture);

    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeTruthy();
    expect(screen.queryByText('Loading audio...')).toBeNull();
  });

  it('should display time in mm:ss format', async () => {
    const audio = createMockAudio();
    const { fixture } = await renderAudioViewer(audio);

    await triggerWaveSurferReady(fixture);

    // Duration is 300s = 05:00, currentTime starts at 0 = 00:00
    expect(screen.getByText('00:00 / 05:00')).toBeTruthy();
  });

  it('should initialize WaveSurfer with correct config', async () => {
    const audio = createMockAudio({ file_url: 'https://cdn.example.com/track.mp3' });
    const { fixture } = await renderAudioViewer(audio);

    const mockCreate = (await import('wavesurfer.js')).default.create;
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        waveColor: '#99f6e4',
        progressColor: '#0d9488',
        cursorColor: '#14b8a6',
        height: 80,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        media: expect.any(HTMLAudioElement),
        peaks: expect.any(Array),
      }),
    );
  });

  it('should render speed selector and change playback rate', async () => {
    const audio = createMockAudio();
    const { fixture } = await renderAudioViewer(audio);
    const mockWs = await triggerWaveSurferReady(fixture);

    const speedSelect = screen.getByRole('combobox', { name: 'Playback speed' });
    expect(speedSelect).toBeTruthy();
    // Default shows 1x
    expect(speedSelect.textContent).toContain('1x');

    // Open dropdown and select 1.5x
    fireEvent.click(speedSelect);
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: '1.5x' }));
    fixture.detectChanges();

    expect(mockWs.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });
});
