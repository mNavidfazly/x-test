import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, formatDuration, formatRelativeTime } from './date.utils';

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

describe('formatDuration', () => {
  it('should return "0 min" for 0', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('should return minutes for values under 60', () => {
    expect(formatDuration(1)).toBe('1 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(59)).toBe('59 min');
  });

  it('should return hours only when evenly divisible', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(180)).toBe('3h');
  });

  it('should return hours and minutes for mixed values', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(75)).toBe('1h 15m');
    expect(formatDuration(150)).toBe('2h 30m');
  });

  it('should handle large values', () => {
    expect(formatDuration(600)).toBe('10h');
    expect(formatDuration(601)).toBe('10h 1m');
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
