import { describe, it, expect } from 'vitest';
import {
  cn,
  deepMerge,
  formatFileSize,
  isValidLEIFormat,
  validateLEIChecksum,
} from '@/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects', () => {
      const target = { a: { b: 1, c: 2 } };
      const source = { a: { b: 3, c: 2 } };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: { b: 3, c: 2 } });
    });

    it('should not mutate original objects', () => {
      const target = { a: 1, b: 0 };
      const source = { b: 2 };
      deepMerge(target, source);

      expect(target).toEqual({ a: 1, b: 0 });
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('isValidLEIFormat', () => {
    it('should accept valid LEI format', () => {
      expect(isValidLEIFormat('5493001KJTIIGC8Y1R12')).toBe(true);
    });

    it('should reject invalid LEI format', () => {
      expect(isValidLEIFormat('INVALID')).toBe(false);
      expect(isValidLEIFormat('5493001kjtiigc8y1r12')).toBe(false); // lowercase
      expect(isValidLEIFormat('549300')).toBe(false); // too short
      expect(isValidLEIFormat('5493001KJTIIGC8Y1R123')).toBe(false); // too long
    });
  });

  describe('validateLEIChecksum', () => {
    it('should validate correct LEI checksum', () => {
      // This is a real LEI with valid checksum
      expect(validateLEIChecksum('5493001KJTIIGC8Y1R12')).toBe(true);
    });

    it('should reject invalid checksum', () => {
      // Modified last digits to make checksum invalid
      expect(validateLEIChecksum('5493001KJTIIGC8Y1R99')).toBe(false);
    });

    it('should reject invalid format', () => {
      expect(validateLEIChecksum('INVALID')).toBe(false);
    });
  });
});
