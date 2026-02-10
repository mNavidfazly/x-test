import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { VideoViewerComponent } from './video-viewer.component';
import { createMockModuleVideo } from '../../../__mocks__/course.mock';

describe('VideoViewerComponent', () => {
  it('should render video element with correct src', async () => {
    const video = createMockModuleVideo();
    await render(VideoViewerComponent, {
      componentInputs: { video },
    });

    const videoEl = document.querySelector('video') as HTMLVideoElement;
    expect(videoEl).toBeTruthy();
    expect(videoEl.src).toContain('test-video.mp4');
    expect(videoEl.poster).toContain('thumb.jpg');
    expect(videoEl.hasAttribute('controls')).toBe(true);
  });

  it('should show formatted duration', async () => {
    const video = createMockModuleVideo({ duration: 125 });
    await render(VideoViewerComponent, {
      componentInputs: { video },
    });

    expect(screen.getByText('Duration: 2:05')).toBeTruthy();
  });

  it('should hide duration when null', async () => {
    const video = createMockModuleVideo({ duration: null });
    await render(VideoViewerComponent, {
      componentInputs: { video },
    });

    expect(screen.queryByText(/Duration/)).toBeNull();
  });
});
