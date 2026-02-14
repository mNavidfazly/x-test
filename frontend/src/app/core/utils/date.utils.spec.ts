import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, formatRelativeTime } from './date.utils';

describe('formatDate', () => {
  it('should format a valid ISO date string', () => {
    const result = formatDate('2025-06-15T10:30:00Z');
    // Just verify it contains the year and doesn't crash — locale-specific output
    expect(result).toContain('2025');
  });

  it('should return — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('should return — for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('should return — for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for times less than 1 minute ago', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);
    expect(formatRelativeTime('2025-06-15T11:59:30Z')).toBe('just now');
  });

  it('should return minutes ago for times less than 1 hour ago', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);
    expect(formatRelativeTime('2025-06-15T11:45:00Z')).toBe('15m ago');
  });

  it('should return hours ago for times less than 24 hours ago', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);
    expect(formatRelativeTime('2025-06-15T09:00:00Z')).toBe('3h ago');
  });

  it('should return days ago for times less than 7 days ago', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);
    expect(formatRelativeTime('2025-06-13T12:00:00Z')).toBe('2d ago');
  });

  it('should return short date for times older than 7 days', () => {
    const now = new Date('2025-06-15T12:00:00Z');
    vi.setSystemTime(now);
    const result = formatRelativeTime('2025-06-01T12:00:00Z');
    expect(result).toContain('Jun');
  });
});
