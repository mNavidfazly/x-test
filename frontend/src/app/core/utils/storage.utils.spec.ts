import { describe, it, expect } from 'vitest';
import { isStoragePath } from './storage.utils';

describe('isStoragePath', () => {
  it('should return true for storage paths', () => {
    expect(isStoragePath('course-1/thumbnail-123.jpg')).toBe(true);
    expect(isStoragePath('user-1/avatar')).toBe(true);
  });

  it('should return false for full URLs', () => {
    expect(isStoragePath('https://example.com/image.jpg')).toBe(false);
    expect(isStoragePath('http://example.com/image.jpg')).toBe(false);
  });

  it('should return false for null/undefined/empty', () => {
    expect(isStoragePath(null)).toBe(false);
    expect(isStoragePath(undefined)).toBe(false);
    expect(isStoragePath('')).toBe(false);
  });
});
