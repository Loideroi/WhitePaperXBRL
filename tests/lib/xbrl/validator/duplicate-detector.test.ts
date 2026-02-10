import { describe, it, expect } from 'vitest';
import {
  detectDuplicateFacts,
  duplicateResultToValidationErrors,
  type FactInput,
} from '@/lib/xbrl/validator/duplicate-detector';

describe('Duplicate Fact Detector', () => {
  describe('detectDuplicateFacts', () => {
    it('should return no duplicates for an empty facts array', () => {
      const result = detectDuplicateFacts([]);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalFacts).toBe(0);
    });

    it('should return no duplicates when all facts are unique', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'TestCoin' },
        { name: 'mica:TotalSupply', contextRef: 'ctx_instant', value: '1000000', unitRef: 'unit_pure' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalFacts).toBe(3);
    });

    it('should detect duplicate facts with same element, context, and unit', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'TestCoin' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]?.elementName).toBe('mica:OfferorLegalName');
      expect(result.duplicates[0]?.contextRef).toBe('ctx_duration');
      expect(result.duplicates[0]?.count).toBe(2);
      expect(result.duplicates[0]?.values).toEqual(['Acme Corp', 'Acme Corp']);
      expect(result.totalFacts).toBe(3);
    });

    it('should detect duplicate facts with different values but same key', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Beta LLC' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]?.count).toBe(2);
      expect(result.duplicates[0]?.values).toEqual(['Acme Corp', 'Beta LLC']);
    });

    it('should not flag same element with different contexts as duplicate', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_instant', value: 'Acme Corp' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalFacts).toBe(2);
    });

    it('should not flag same element with different units as duplicate', () => {
      const facts: FactInput[] = [
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '100', unitRef: 'unit_EUR' },
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '120', unitRef: 'unit_USD' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalFacts).toBe(2);
    });

    it('should detect duplicates for numeric facts with same unit', () => {
      const facts: FactInput[] = [
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '100', unitRef: 'unit_EUR' },
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '200', unitRef: 'unit_EUR' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]?.elementName).toBe('mica:IssuePrice');
      expect(result.duplicates[0]?.unitRef).toBe('unit_EUR');
      expect(result.duplicates[0]?.count).toBe(2);
    });

    it('should detect multiple duplicate groups independently', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'TestCoin' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'AnotherCoin' },
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '50', unitRef: 'unit_EUR' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(2);
      expect(result.totalFacts).toBe(5);

      const elementNames = result.duplicates.map((d) => d.elementName).sort();
      expect(elementNames).toEqual(['mica:CryptoAssetName', 'mica:OfferorLegalName']);
    });

    it('should handle facts with undefined unitRef consistently', () => {
      // Two facts with no unitRef (both undefined) sharing same name+context = duplicate
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'A' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'B' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates[0]?.unitRef).toBeUndefined();
    });

    it('should treat fact with unitRef as different from fact without unitRef', () => {
      const facts: FactInput[] = [
        { name: 'mica:SomeElement', contextRef: 'ctx_duration', value: '100' },
        { name: 'mica:SomeElement', contextRef: 'ctx_duration', value: '100', unitRef: 'unit_pure' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle a single fact with no duplicates', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Solo Corp' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
      expect(result.totalFacts).toBe(1);
    });

    it('should detect triplicate facts (count = 3)', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'A' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'B' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'C' },
      ];

      const result = detectDuplicateFacts(facts);

      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]?.count).toBe(3);
      expect(result.duplicates[0]?.values).toEqual(['A', 'B', 'C']);
    });
  });

  describe('duplicateResultToValidationErrors', () => {
    it('should return empty array when no duplicates exist', () => {
      const result = detectDuplicateFacts([]);
      const errors = duplicateResultToValidationErrors(result);

      expect(errors).toHaveLength(0);
    });

    it('should convert duplicate groups to validation errors', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Acme Corp' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'Beta LLC' },
      ];

      const result = detectDuplicateFacts(facts);
      const errors = duplicateResultToValidationErrors(result);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.ruleId).toBe('DUP-001');
      expect(errors[0]?.severity).toBe('ERROR');
      expect(errors[0]?.element).toBe('mica:OfferorLegalName');
      expect(errors[0]?.message).toContain('Duplicate fact');
      expect(errors[0]?.message).toContain('mica:OfferorLegalName');
      expect(errors[0]?.message).toContain('ctx_duration');
      expect(errors[0]?.message).toContain('2 times');
    });

    it('should include unit reference in error message when present', () => {
      const facts: FactInput[] = [
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '100', unitRef: 'unit_EUR' },
        { name: 'mica:IssuePrice', contextRef: 'ctx_duration', value: '200', unitRef: 'unit_EUR' },
      ];

      const result = detectDuplicateFacts(facts);
      const errors = duplicateResultToValidationErrors(result);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toContain('unit_EUR');
    });

    it('should generate one error per duplicate group', () => {
      const facts: FactInput[] = [
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'A' },
        { name: 'mica:OfferorLegalName', contextRef: 'ctx_duration', value: 'B' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'X' },
        { name: 'mica:CryptoAssetName', contextRef: 'ctx_duration', value: 'Y' },
      ];

      const result = detectDuplicateFacts(facts);
      const errors = duplicateResultToValidationErrors(result);

      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.ruleId === 'DUP-001')).toBe(true);
      expect(errors.every((e) => e.severity === 'ERROR')).toBe(true);
    });

    it('should truncate long values in error message', () => {
      const longValue = 'A'.repeat(100);
      const facts: FactInput[] = [
        { name: 'mica:Description', contextRef: 'ctx_duration', value: longValue },
        { name: 'mica:Description', contextRef: 'ctx_duration', value: longValue },
      ];

      const result = detectDuplicateFacts(facts);
      const errors = duplicateResultToValidationErrors(result);

      expect(errors).toHaveLength(1);
      // The message should contain a truncated version (50 chars max per value)
      expect(errors[0]?.message).toContain('A'.repeat(50));
      expect(errors[0]?.message).not.toContain('A'.repeat(100));
    });
  });
});
