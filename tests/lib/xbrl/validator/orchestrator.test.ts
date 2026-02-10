import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ValidationError } from '@/types/xbrl';

// Mock all dependency modules
vi.mock('@/lib/xbrl/validator/lei-validator', () => ({
  validateLEI: vi.fn(),
  validateAllLEIs: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/xbrl/validator/existence-engine', () => ({
  validateExistenceAssertions: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
  getAssertionSummary: vi.fn().mockReturnValue({
    total: 10,
    required: 8,
    recommended: 2,
    byPart: { partA: 5, partD: 5 },
  }),
}));

vi.mock('@/lib/xbrl/validator/value-engine', () => ({
  validateValueAssertions: vi.fn().mockReturnValue({ errors: [], warnings: [] }),
  getValueAssertionSummary: vi.fn().mockReturnValue({
    total: 5,
    required: 3,
    recommended: 2,
  }),
}));

vi.mock('@/lib/xbrl/validator/duplicate-detector', () => ({
  detectDuplicateFacts: vi.fn().mockReturnValue({
    hasDuplicates: false,
    duplicates: [],
    totalFacts: 0,
  }),
  duplicateResultToValidationErrors: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/xbrl/generator/document-generator', () => ({
  createIXBRLDocument: vi.fn().mockReturnValue({
    contexts: [],
    units: [],
    facts: [],
    language: 'en',
    taxonomyRef: 'test',
  }),
}));

import {
  validateWhitepaper,
  quickValidate,
  validateField,
  getValidationRequirements,
} from '@/lib/xbrl/validator/orchestrator';
import { validateLEI, validateAllLEIs } from '@/lib/xbrl/validator/lei-validator';
import { validateExistenceAssertions, getAssertionSummary } from '@/lib/xbrl/validator/existence-engine';
import { validateValueAssertions, getValueAssertionSummary } from '@/lib/xbrl/validator/value-engine';
import { detectDuplicateFacts, duplicateResultToValidationErrors } from '@/lib/xbrl/validator/duplicate-detector';
import { createIXBRLDocument } from '@/lib/xbrl/generator/document-generator';

const VALID_LEI = '529900T8BM49AURSDO55';

function makeError(overrides?: Partial<ValidationError>): ValidationError {
  return {
    ruleId: 'TEST-001',
    severity: 'ERROR',
    message: 'Test error',
    fieldPath: 'partA.lei',
    ...overrides,
  };
}

describe('Validation Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock return values
    vi.mocked(validateAllLEIs).mockReturnValue([]);
    vi.mocked(validateExistenceAssertions).mockReturnValue({ errors: [], warnings: [] });
    vi.mocked(validateValueAssertions).mockReturnValue({ errors: [], warnings: [] });
    vi.mocked(detectDuplicateFacts).mockReturnValue({
      hasDuplicates: false,
      duplicates: [],
      totalFacts: 0,
    });
    vi.mocked(duplicateResultToValidationErrors).mockReturnValue([]);
    vi.mocked(getAssertionSummary).mockReturnValue({
      total: 10,
      required: 8,
      recommended: 2,
      byPart: { partA: 5, partD: 5 },
    });
    vi.mocked(getValueAssertionSummary).mockReturnValue({
      total: 5,
      required: 3,
      recommended: 2,
    });
    vi.mocked(createIXBRLDocument).mockReturnValue({
      contexts: [],
      units: [],
      facts: [],
      language: 'en',
      taxonomyRef: 'test',
    });
  });

  describe('validateWhitepaper', () => {
    it('should return valid=true when all engines produce no errors', async () => {
      const result = await validateWhitepaper(
        { partA: { lei: VALID_LEI } as never },
        'OTHR'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return valid=false when LEI errors exist', async () => {
      const leiError = makeError({ ruleId: 'LEI-001', severity: 'ERROR' });
      vi.mocked(validateAllLEIs).mockReturnValue([leiError]);

      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(leiError);
      expect(result.byCategory.lei.errors).toContainEqual(leiError);
    });

    it('should return valid=false when existence errors exist', async () => {
      const existError = makeError({ ruleId: 'EX-001' });
      vi.mocked(validateExistenceAssertions).mockReturnValue({
        errors: [existError],
        warnings: [],
      });

      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.valid).toBe(false);
      expect(result.byCategory.existence.errors).toContainEqual(existError);
    });

    it('should return valid=false when value errors exist', async () => {
      const valueError = makeError({ ruleId: 'VAL-001' });
      vi.mocked(validateValueAssertions).mockReturnValue({
        errors: [valueError],
        warnings: [],
      });

      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.valid).toBe(false);
      expect(result.byCategory.value.errors).toContainEqual(valueError);
    });

    it('should return valid=false when duplicate errors exist', async () => {
      const dupError = makeError({ ruleId: 'DUP-001' });
      vi.mocked(duplicateResultToValidationErrors).mockReturnValue([dupError]);

      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.valid).toBe(false);
      expect(result.byCategory.duplicate.errors).toContainEqual(dupError);
    });

    it('should separate warnings from errors', async () => {
      const warning = makeError({ ruleId: 'EX-002', severity: 'WARNING' });
      vi.mocked(validateExistenceAssertions).mockReturnValue({
        errors: [],
        warnings: [warning],
      });

      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(warning);
      expect(result.byCategory.existence.warnings).toContainEqual(warning);
    });

    it('should calculate assertion counts correctly', async () => {
      const result = await validateWhitepaper({}, 'OTHR');

      expect(result.assertionCounts.existence.total).toBe(10);
      expect(result.assertionCounts.value.total).toBe(5);
      expect(result.assertionCounts.lei.total).toBe(6);
      expect(result.assertionCounts.duplicate.total).toBe(1);
      expect(result.summary.totalAssertions).toBe(10 + 5 + 6 + 1);
    });

    it('should filter errors by skipRules', async () => {
      const error1 = makeError({ ruleId: 'EX-SKIP' });
      const error2 = makeError({ ruleId: 'EX-KEEP' });
      vi.mocked(validateExistenceAssertions).mockReturnValue({
        errors: [error1, error2],
        warnings: [],
      });

      const result = await validateWhitepaper({}, 'OTHR', {
        skipRules: ['EX-SKIP'],
      });

      expect(result.byCategory.existence.errors).not.toContainEqual(error1);
      expect(result.byCategory.existence.errors).toContainEqual(error2);
    });

    it('should check GLEIF when checkGLEIF=true and LEI is valid', async () => {
      vi.mocked(validateLEI).mockResolvedValue({
        valid: true,
        errors: [],
      });

      await validateWhitepaper(
        { partA: { lei: VALID_LEI } as never },
        'OTHR',
        { checkGLEIF: true }
      );

      expect(validateLEI).toHaveBeenCalledWith(VALID_LEI, { checkGLEIF: true });
    });

    it('should not check GLEIF when checkGLEIF is false', async () => {
      await validateWhitepaper(
        { partA: { lei: VALID_LEI } as never },
        'OTHR',
        { checkGLEIF: false }
      );

      expect(validateLEI).not.toHaveBeenCalled();
    });
  });

  describe('quickValidate', () => {
    it('should run existence + LEI only (not value or duplicate)', () => {
      quickValidate({ partA: { lei: VALID_LEI } as never }, 'OTHR');

      expect(validateExistenceAssertions).toHaveBeenCalled();
      expect(validateAllLEIs).toHaveBeenCalled();
      expect(validateValueAssertions).not.toHaveBeenCalled();
      expect(detectDuplicateFacts).not.toHaveBeenCalled();
    });

    it('should return valid=true when no errors', () => {
      const result = quickValidate({}, 'OTHR');

      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should return valid=false with error count', () => {
      vi.mocked(validateExistenceAssertions).mockReturnValue({
        errors: [makeError(), makeError({ ruleId: 'EX-002' })],
        warnings: [],
      });

      const result = quickValidate({}, 'OTHR');

      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('validateField', () => {
    it('should filter results to the specified fieldPath', () => {
      const matchError = makeError({ fieldPath: 'partA.lei', ruleId: 'EX-001' });
      const otherError = makeError({ fieldPath: 'partD.cryptoAssetName', ruleId: 'EX-002' });
      vi.mocked(validateExistenceAssertions).mockReturnValue({
        errors: [matchError, otherError],
        warnings: [],
      });
      vi.mocked(validateValueAssertions).mockReturnValue({ errors: [], warnings: [] });

      const errors = validateField({}, 'partA.lei', 'OTHR');

      expect(errors).toContainEqual(matchError);
      expect(errors).not.toContainEqual(otherError);
    });

    it('should run LEI validation when fieldPath is partA.lei', () => {
      vi.mocked(validateExistenceAssertions).mockReturnValue({ errors: [], warnings: [] });
      vi.mocked(validateValueAssertions).mockReturnValue({ errors: [], warnings: [] });

      validateField({ partA: { lei: VALID_LEI } as never }, 'partA.lei', 'OTHR');

      expect(validateAllLEIs).toHaveBeenCalledWith(VALID_LEI);
    });

    it('should not run LEI validation for non-LEI fields', () => {
      vi.mocked(validateExistenceAssertions).mockReturnValue({ errors: [], warnings: [] });
      vi.mocked(validateValueAssertions).mockReturnValue({ errors: [], warnings: [] });

      validateField({}, 'partD.cryptoAssetName', 'OTHR');

      expect(validateAllLEIs).not.toHaveBeenCalled();
    });
  });

  describe('getValidationRequirements', () => {
    it('should return correct totals including LEI and duplicate checks', () => {
      const result = getValidationRequirements('OTHR');

      expect(result.existence.total).toBe(10);
      expect(result.value.total).toBe(5);
      // total = existence + value + 6 LEI + 1 duplicate
      expect(result.total).toBe(10 + 5 + 6 + 1);
    });

    it('should call summary functions with the provided tokenType', () => {
      getValidationRequirements('ART');

      expect(getAssertionSummary).toHaveBeenCalledWith('ART');
      expect(getValueAssertionSummary).toHaveBeenCalledWith('ART');
    });
  });
});
