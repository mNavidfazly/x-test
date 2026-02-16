import { describe, it, expect } from 'vitest';
import { getModuleTypeMeta, getModuleTypeIcon, getModuleTypeLabel } from './module-type.utils';

const ALL_TYPES = ['video', 'pdf', 'markdown', 'quiz', 'exam', 'external_quiz', 'audio', 'download'];

describe('module-type.utils', () => {
  describe('getModuleTypeMeta', () => {
    it.each(ALL_TYPES)('should return meta for %s', (type) => {
      const meta = getModuleTypeMeta(type);
      expect(meta.icon).toBeTruthy();
      expect(meta.colorClass).toBeTruthy();
      expect(meta.label.length).toBeGreaterThan(0);
    });

    it('should return default meta for unknown type', () => {
      const meta = getModuleTypeMeta('nonexistent');
      expect(meta.label).toBe('Unknown');
      expect(meta.icon).toBeTruthy();
      expect(meta.colorClass).toBe('text-slate-600 bg-slate-100');
    });

    it('should have unique color classes for each type', () => {
      const colors = ALL_TYPES.map(t => getModuleTypeMeta(t).colorClass);
      const unique = new Set(colors);
      expect(unique.size).toBe(ALL_TYPES.length);
    });
  });

  describe('getModuleTypeIcon', () => {
    it('should return icon for known type', () => {
      expect(getModuleTypeIcon('video')).toBeTruthy();
    });

    it('should return default icon for unknown type', () => {
      expect(getModuleTypeIcon('unknown')).toBeTruthy();
    });
  });

  describe('getModuleTypeLabel', () => {
    it('should return label for known type', () => {
      expect(getModuleTypeLabel('video')).toBe('Video');
      expect(getModuleTypeLabel('markdown')).toBe('Rich Text');
      expect(getModuleTypeLabel('download')).toBe('Downloadable Files');
    });

    it('should return "Unknown" for unknown type', () => {
      expect(getModuleTypeLabel('unknown')).toBe('Unknown');
    });
  });
});
