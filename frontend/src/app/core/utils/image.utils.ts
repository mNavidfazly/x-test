/**
 * Compress and resize an image file using browser-native APIs.
 * Returns a WebP file at the target max dimension.
 * Skips compression if the file is already small enough.
 */
export async function compressImage(
  file: File,
  maxDimension = 256,
  quality = 0.8,
): Promise<File> {
  if (file.size <= 50 * 1024) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
}
