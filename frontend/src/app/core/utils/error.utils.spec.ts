import { describe, it, expect } from 'vitest';
import { extractErrorMessage } from './error.utils';

describe('extractErrorMessage', () => {
  it('should extract message from Error instance', () => {
    expect(extractErrorMessage(new Error('Something broke'), 'fallback')).toBe(
      'Something broke',
    );
  });

  it('should extract message from Supabase-style error object', () => {
    const supabaseError = { message: 'RLS policy violation', code: '42501' };
    expect(extractErrorMessage(supabaseError, 'fallback')).toBe(
      'RLS policy violation',
    );
  });

  it('should extract message from object with non-string message', () => {
    expect(extractErrorMessage({ message: 42 }, 'fallback')).toBe('42');
  });

  it('should return fallback for null', () => {
    expect(extractErrorMessage(null, 'default error')).toBe('default error');
  });

  it('should return fallback for undefined', () => {
    expect(extractErrorMessage(undefined, 'default error')).toBe(
      'default error',
    );
  });

  it('should return fallback for plain string', () => {
    expect(extractErrorMessage('not an object', 'default error')).toBe(
      'default error',
    );
  });

  it('should return fallback for object without message property', () => {
    expect(extractErrorMessage({ code: 500 }, 'default error')).toBe(
      'default error',
    );
  });
});
