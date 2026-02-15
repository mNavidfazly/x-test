import { describe, it, expect } from 'vitest';
import { formatFileSize } from './file.utils';

describe('formatFileSize', () => {
  it('should return empty string for null', () => {
    expect(formatFileSize(null)).toBe('');
  });

  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatFileSize(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('should handle zero', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});
