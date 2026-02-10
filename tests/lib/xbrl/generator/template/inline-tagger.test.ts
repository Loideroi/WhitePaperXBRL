import { describe, it, expect } from 'vitest';
import {
  isValueNumeric,
  wrapInlineTag,
  getUnitRefForType,
} from '@/lib/xbrl/generator/template/inline-tagger';

describe('isValueNumeric', () => {
  it('should return true for plain integers', () => {
    expect(isValueNumeric('7')).toBe(true);
    expect(isValueNumeric('42')).toBe(true);
    expect(isValueNumeric('0')).toBe(true);
  });

  it('should return true for decimal numbers', () => {
    expect(isValueNumeric('3.14')).toBe(true);
    expect(isValueNumeric('0.81')).toBe(true);
    expect(isValueNumeric('100.00')).toBe(true);
  });

  it('should return true for negative numbers', () => {
    expect(isValueNumeric('-5')).toBe(true);
    expect(isValueNumeric('-3.14')).toBe(true);
  });

  it('should return true for numbers with commas', () => {
    expect(isValueNumeric('600,000')).toBe(true);
    expect(isValueNumeric('1,000,000')).toBe(true);
  });

  it('should return true for numbers with currency symbols', () => {
    expect(isValueNumeric('$100')).toBe(true);
    expect(isValueNumeric('€50.00')).toBe(true);
    expect(isValueNumeric('£1000')).toBe(true);
  });

  it('should return true for numbers with percent sign', () => {
    expect(isValueNumeric('81%')).toBe(true);
  });

  it('should return true for numbers with trailing period', () => {
    expect(isValueNumeric('7.')).toBe(true);
  });

  it('should return false for empty or whitespace', () => {
    expect(isValueNumeric('')).toBe(false);
    expect(isValueNumeric('   ')).toBe(false);
  });

  it('should return false for narrative text', () => {
    expect(isValueNumeric('Not applicable')).toBe(false);
    expect(isValueNumeric('No minimum goal.')).toBe(false);
    expect(isValueNumeric('Non-applicability of Part C')).toBe(false);
  });

  it('should return false for mixed text with numbers', () => {
    expect(isValueNumeric('(Days) Response time: 7 days.')).toBe(false);
    expect(isValueNumeric('600,000 tokens')).toBe(false);
    expect(isValueNumeric('See S.10 for details')).toBe(false);
  });
});

describe('wrapInlineTag', () => {
  const baseOptions = {
    id: 'fact_1',
    name: 'mica:TestElement',
    contextRef: 'ctx_duration',
  };

  describe('numeric types with numeric values', () => {
    it('should wrap integer value in ix:nonFraction', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: '7',
        dataType: 'integerItemType',
        isTextBlock: false,
        unitRef: 'unit_pure',
        decimals: 0,
      });
      expect(result).toContain('<ix:nonFraction');
      expect(result).toContain('unitRef="unit_pure"');
      expect(result).toContain('decimals="0"');
      expect(result).toContain('format="ixt:num-dot-decimal"');
      expect(result).toContain('>7</ix:nonFraction>');
    });

    it('should wrap monetary value in ix:nonFraction', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: '1000.50',
        dataType: 'monetaryItemType',
        isTextBlock: false,
        unitRef: 'unit_EUR',
        decimals: 2,
      });
      expect(result).toContain('<ix:nonFraction');
      expect(result).toContain('unitRef="unit_EUR"');
      expect(result).toContain('>1000.50</ix:nonFraction>');
    });

    it('should wrap percent value in ix:nonFraction', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: '0.81',
        dataType: 'percentItemType',
        isTextBlock: false,
        unitRef: 'unit_pure',
        decimals: 4,
      });
      expect(result).toContain('<ix:nonFraction');
      expect(result).toContain('unitRef="unit_pure"');
      expect(result).toContain('>0.81</ix:nonFraction>');
    });
  });

  describe('numeric types with non-numeric values (fallback)', () => {
    it('should fall back to ix:nonNumeric for "Not applicable"', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: 'Not applicable',
        dataType: 'integerItemType',
        isTextBlock: false,
        unitRef: 'unit_pure',
        decimals: 0,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).toContain('escape="false"');
      expect(result).toContain('>Not applicable</ix:nonNumeric>');
      expect(result).not.toContain('ix:nonFraction');
      expect(result).not.toContain('unitRef');
    });

    it('should fall back to ix:nonNumeric for "No minimum goal."', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: 'No minimum goal.',
        dataType: 'monetaryItemType',
        isTextBlock: false,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).not.toContain('ix:nonFraction');
    });

    it('should fall back to ix:nonNumeric for narrative text', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: 'Non-applicability of Part C — this section does not apply.',
        dataType: 'integerItemType',
        isTextBlock: false,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).not.toContain('ix:nonFraction');
    });

    it('should fall back to ix:nonNumeric for mixed text with numbers', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: '(Days) Response time: 7 days.',
        dataType: 'integerItemType',
        isTextBlock: false,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).not.toContain('ix:nonFraction');
    });
  });

  describe('non-numeric types (unchanged behavior)', () => {
    it('should wrap string in ix:nonNumeric with escape="false"', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: 'Acme Corporation',
        dataType: 'stringItemType',
        isTextBlock: false,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).toContain('escape="false"');
      expect(result).toContain('>Acme Corporation</ix:nonNumeric>');
    });

    it('should wrap text block in ix:nonNumeric with escape="true"', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: 'A detailed description of the project.',
        dataType: 'textBlockItemType',
        isTextBlock: true,
      });
      expect(result).toContain('<ix:nonNumeric');
      expect(result).toContain('escape="true"');
      expect(result).toContain('format="ixt4:fixed-true"');
    });

    it('should escape HTML in values', () => {
      const result = wrapInlineTag({
        ...baseOptions,
        value: '<script>alert("xss")</script>',
        dataType: 'stringItemType',
        isTextBlock: false,
      });
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
  });
});

describe('getUnitRefForType', () => {
  it('should return unit_EUR for monetaryItemType by default', () => {
    expect(getUnitRefForType('monetaryItemType')).toBe('unit_EUR');
  });

  it('should return unit with specified currency for monetaryItemType', () => {
    expect(getUnitRefForType('monetaryItemType', 'USD')).toBe('unit_USD');
  });

  it('should return unit_pure for integerItemType', () => {
    expect(getUnitRefForType('integerItemType')).toBe('unit_pure');
  });

  it('should return unit_pure for percentItemType', () => {
    expect(getUnitRefForType('percentItemType')).toBe('unit_pure');
  });

  it('should return undefined for stringItemType', () => {
    expect(getUnitRefForType('stringItemType')).toBeUndefined();
  });

  it('should return undefined for textBlockItemType', () => {
    expect(getUnitRefForType('textBlockItemType')).toBeUndefined();
  });
});
