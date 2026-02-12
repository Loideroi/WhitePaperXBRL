import { describe, it, expect } from 'vitest';
import {
  isValidLEIFormat,
  validateLEIChecksum,
  validateLEI,
  validateAllLEIs,
} from '@/lib/xbrl/validator/lei-validator';

describe('LEI Validator', () => {
  describe('isValidLEIFormat', () => {
    it('should accept valid LEI format', () => {
      // Standard 20-character LEI
      expect(isValidLEIFormat('529900T8BM49AURSDO55')).toBe(true);
      expect(isValidLEIFormat('549300GFKD7HZKX1ZD98')).toBe(true);
      expect(isValidLEIFormat('254900OPPU84GM83MG36')).toBe(true);
    });

    it('should reject invalid length', () => {
      expect(isValidLEIFormat('529900T8BM49AURSD')).toBe(false); // Too short
      expect(isValidLEIFormat('529900T8BM49AURSDO5512')).toBe(false); // Too long
    });

    it('should reject invalid characters', () => {
      expect(isValidLEIFormat('529900T8BM49AURSDO5!')).toBe(false); // Special char
      // Note: lowercase is normalized to uppercase, so it passes
      expect(isValidLEIFormat('529900t8bm49aursdo55')).toBe(true); // Normalized
    });

    it('should reject empty or null', () => {
      expect(isValidLEIFormat('')).toBe(false);
      expect(isValidLEIFormat(null as unknown as string)).toBe(false);
      expect(isValidLEIFormat(undefined as unknown as string)).toBe(false);
    });

    it('should require last 2 characters to be digits', () => {
      expect(isValidLEIFormat('529900T8BM49AURSDOAB')).toBe(false); // Letters at end
    });
  });

  describe('validateLEIChecksum', () => {
    it('should validate correct checksums', () => {
      // These are real LEIs with valid checksums
      expect(validateLEIChecksum('529900T8BM49AURSDO55')).toBe(true);
    });

    it('should reject invalid checksums', () => {
      // Modified last digits to make checksum invalid
      expect(validateLEIChecksum('529900T8BM49AURSDO00')).toBe(false);
      expect(validateLEIChecksum('529900T8BM49AURSDO99')).toBe(false);
    });

    it('should reject invalid format before checking checksum', () => {
      expect(validateLEIChecksum('INVALID')).toBe(false);
      expect(validateLEIChecksum('')).toBe(false);
    });
  });

  describe('validateLEI', () => {
    it('should return error for missing LEI', () => {
      const result = validateLEI(undefined);

      expect('errors' in result).toBe(true);
      if ('errors' in result) {
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.ruleId).toBe('LEI-000');
      }
    });

    it('should return error for empty LEI', () => {
      const result = validateLEI('');

      expect('errors' in result).toBe(true);
      if ('errors' in result) {
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.ruleId).toBe('LEI-000');
      }
    });

    it('should return error for invalid format', () => {
      const result = validateLEI('INVALID123');

      expect('errors' in result).toBe(true);
      if ('errors' in result) {
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.ruleId).toBe('LEI-001');
      }
    });

    it('should pass valid LEI', () => {
      const result = validateLEI('529900T8BM49AURSDO55');

      expect('errors' in result).toBe(true);
      if ('errors' in result) {
        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
      }
    });

    it('should normalize LEI to uppercase and validate', () => {
      const result = validateLEI('529900t8bm49aursdo55');

      // Should pass since it normalizes to uppercase
      expect('errors' in result).toBe(true);
      if ('errors' in result) {
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateAllLEIs', () => {
    it('should validate offeror LEI as required', () => {
      const errors = validateAllLEIs(undefined);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.fieldPath).toBe('partA.lei');
    });

    it('should pass with valid offeror LEI only', () => {
      const errors = validateAllLEIs('529900T8BM49AURSDO55');

      expect(errors.length).toBe(0);
    });

    it('should validate issuer LEI if different from offeror', () => {
      const errors = validateAllLEIs('529900T8BM49AURSDO55', 'INVALID');

      expect(errors.some((e) => e.fieldPath === 'partB.lei')).toBe(true);
    });

    it('should skip issuer validation if same as offeror', () => {
      const errors = validateAllLEIs(
        '529900T8BM49AURSDO55',
        '529900T8BM49AURSDO55' // Same as offeror
      );

      expect(errors.length).toBe(0);
    });

    it('should skip issuer/operator LEI validation for "not applicable" values', () => {
      const errors = validateAllLEIs(
        '529900T8BM49AURSDO55',
        'Not applicable - Issuer is same as Offeror',
        'Not applicable - Issuer is same as Offeror'
      );

      // Only offeror is validated; issuer/operator are skipped
      expect(errors.length).toBe(0);
      expect(errors.some((e) => e.fieldPath === 'partB.lei')).toBe(false);
      expect(errors.some((e) => e.fieldPath === 'partC.lei')).toBe(false);
    });

    it('should skip LEI validation for case-insensitive "not applicable" variants', () => {
      const errors = validateAllLEIs(
        '529900T8BM49AURSDO55',
        'NOT APPLICABLE',
        'notapplicable'
      );

      expect(errors.length).toBe(0);
    });
  });
});
