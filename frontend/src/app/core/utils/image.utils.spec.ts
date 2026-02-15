import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressImage } from './image.utils';

describe('compressImage', () => {
  const mockBlob = new Blob(['compressed'], { type: 'image/webp' });
  let mockConvertToBlob: ReturnType<typeof vi.fn>;
  let mockGetContext: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClose = vi.fn();
    mockConvertToBlob = vi.fn().mockResolvedValue(mockBlob);
    mockGetContext = vi.fn().mockReturnValue({ drawImage: vi.fn() });

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({
      width: 2000,
      height: 1500,
      close: mockClose,
    }));

    vi.stubGlobal('OffscreenCanvas', vi.fn().mockImplementation(() => ({
      getContext: mockGetContext,
      convertToBlob: mockConvertToBlob,
    })));
  });

  it('should skip compression for files under 50KB', async () => {
    const small = new File(['tiny'], 'avatar.png', { type: 'image/png' });
    const result = await compressImage(small);
    expect(result).toBe(small);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('should compress large files to WebP', async () => {
    const big = new File([new ArrayBuffer(100 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressImage(big);

    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('photo.webp');
    expect(createImageBitmap).toHaveBeenCalledWith(big);
    expect(mockClose).toHaveBeenCalled();
  });

  it('should scale down to max dimension preserving aspect ratio', async () => {
    const big = new File([new ArrayBuffer(100 * 1024)], 'wide.png', { type: 'image/png' });
    await compressImage(big, 256);

    // 2000x1500 → scale = 256/2000 = 0.128 → 256x192
    expect(OffscreenCanvas).toHaveBeenCalledWith(256, 192);
  });

  it('should not upscale small images', async () => {
    (createImageBitmap as ReturnType<typeof vi.fn>).mockResolvedValue({
      width: 100,
      height: 80,
      close: mockClose,
    });

    const big = new File([new ArrayBuffer(100 * 1024)], 'small-dims.png', { type: 'image/png' });
    await compressImage(big, 256);

    // 100x80 is already under 256 → scale=1 → no change
    expect(OffscreenCanvas).toHaveBeenCalledWith(100, 80);
  });

  it('should use provided quality parameter', async () => {
    const big = new File([new ArrayBuffer(100 * 1024)], 'photo.jpg', { type: 'image/jpeg' });
    await compressImage(big, 256, 0.6);

    expect(mockConvertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.6 });
  });
});
