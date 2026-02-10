import { describe, it, expect } from 'vitest';
import {
  isValueNumeric,
  wrapInlineTag,
  getUnitRefForType,
  wrapContinuationTag,
  wrapExclude,
  splitTextIntoFragments,
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

describe('wrapContinuationTag', () => {
  const baseOptions = {
    id: 'fact_42',
    name: 'mica:ProjectDescription',
    contextRef: 'ctx_duration',
  };

  it('should return a single ix:nonNumeric with no continuations for 1 fragment', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: ['Short text content.'],
      isTextBlock: true,
    });
    expect(result.primary).toContain('<ix:nonNumeric');
    expect(result.primary).toContain('id="fact_42"');
    expect(result.primary).toContain('name="mica:ProjectDescription"');
    expect(result.primary).toContain('contextRef="ctx_duration"');
    expect(result.primary).toContain('escape="true"');
    expect(result.primary).toContain('format="ixt4:fixed-true"');
    expect(result.primary).toContain('>Short text content.</ix:nonNumeric>');
    expect(result.primary).not.toContain('continuedAt');
    expect(result.continuations).toHaveLength(0);
  });

  it('should produce primary + 2 continuations for 3 fragments', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: ['Fragment one.', 'Fragment two.', 'Fragment three.'],
      isTextBlock: true,
    });

    // Primary tag
    expect(result.primary).toContain('id="fact_42"');
    expect(result.primary).toContain('continuedAt="cont_fact_42_1"');
    expect(result.primary).toContain('escape="true"');
    expect(result.primary).toContain('>Fragment one.</ix:nonNumeric>');

    // Continuations
    expect(result.continuations).toHaveLength(2);

    // First continuation: links to second
    expect(result.continuations[0]).toContain('id="cont_fact_42_1"');
    expect(result.continuations[0]).toContain('continuedAt="cont_fact_42_2"');
    expect(result.continuations[0]).toContain('>Fragment two.</ix:continuation>');

    // Second (last) continuation: no continuedAt
    expect(result.continuations[1]).toContain('id="cont_fact_42_2"');
    expect(result.continuations[1]).not.toContain('continuedAt');
    expect(result.continuations[1]).toContain('>Fragment three.</ix:continuation>');
  });

  it('should use escape="false" for non-text-block types', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: ['Part A', 'Part B'],
      isTextBlock: false,
    });
    expect(result.primary).toContain('escape="false"');
    expect(result.primary).not.toContain('format="ixt4:fixed-true"');
  });

  it('should properly chain continuedAt IDs in sequence', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: ['A', 'B', 'C', 'D'],
      isTextBlock: true,
    });
    // Primary -> cont_fact_42_1
    expect(result.primary).toContain('continuedAt="cont_fact_42_1"');
    // cont_1 -> cont_2
    expect(result.continuations[0]).toContain('id="cont_fact_42_1"');
    expect(result.continuations[0]).toContain('continuedAt="cont_fact_42_2"');
    // cont_2 -> cont_3
    expect(result.continuations[1]).toContain('id="cont_fact_42_2"');
    expect(result.continuations[1]).toContain('continuedAt="cont_fact_42_3"');
    // cont_3: last, no continuedAt
    expect(result.continuations[2]).toContain('id="cont_fact_42_3"');
    expect(result.continuations[2]).not.toContain('continuedAt');
  });

  it('should handle empty fragments array', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: [],
      isTextBlock: true,
    });
    expect(result.primary).toContain('<ix:nonNumeric');
    expect(result.primary).toContain('></ix:nonNumeric>');
    expect(result.continuations).toHaveLength(0);
  });

  it('should escape HTML in fragment content', () => {
    const result = wrapContinuationTag({
      ...baseOptions,
      fragments: ['<b>bold</b>', 'a & b'],
      isTextBlock: true,
    });
    expect(result.primary).toContain('&lt;b&gt;bold&lt;/b&gt;');
    expect(result.continuations[0]).toContain('a &amp; b');
  });
});

describe('wrapExclude', () => {
  it('should wrap content in ix:exclude tags', () => {
    const result = wrapExclude('Page 1');
    expect(result).toBe('<ix:exclude>Page 1</ix:exclude>');
  });

  it('should wrap HTML content without escaping', () => {
    const result = wrapExclude('<span class="page-num">42</span>');
    expect(result).toBe('<ix:exclude><span class="page-num">42</span></ix:exclude>');
  });

  it('should handle empty content', () => {
    const result = wrapExclude('');
    expect(result).toBe('<ix:exclude></ix:exclude>');
  });
});

describe('splitTextIntoFragments', () => {
  it('should return a single fragment for short text', () => {
    const text = 'Short text.';
    const result = splitTextIntoFragments(text, 5000);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it('should split at paragraph boundaries when possible', () => {
    const paragraph1 = 'A'.repeat(3000);
    const paragraph2 = 'B'.repeat(3000);
    const text = `${paragraph1}\n\n${paragraph2}`;
    const result = splitTextIntoFragments(text, 5000);
    expect(result.length).toBeGreaterThanOrEqual(2);
    // First fragment should contain the first paragraph
    expect(result[0]).toContain(paragraph1);
  });

  it('should split at newline boundaries when no paragraph break is available', () => {
    const line1 = 'A'.repeat(3000);
    const line2 = 'B'.repeat(3000);
    const text = `${line1}\n${line2}`;
    const result = splitTextIntoFragments(text, 5000);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should split at space boundaries as fallback', () => {
    // Text with spaces but no newlines
    const words = Array(1000).fill('word').join(' ');
    const result = splitTextIntoFragments(words, 100);
    expect(result.length).toBeGreaterThan(1);
    // Each fragment should be at or under threshold (with some variance for word boundaries)
    for (const fragment of result) {
      expect(fragment.length).toBeLessThanOrEqual(110); // small tolerance for space splitting
    }
  });

  it('should hard-split when no break points exist', () => {
    const text = 'A'.repeat(12000);
    const result = splitTextIntoFragments(text, 5000);
    expect(result.length).toBe(3); // 5000 + 5000 + 2000
    expect(result[0]!.length).toBe(5000);
    expect(result[1]!.length).toBe(5000);
    expect(result[2]!.length).toBe(2000);
  });

  it('should use the default threshold when not specified', () => {
    const shortText = 'A'.repeat(4999);
    const result = splitTextIntoFragments(shortText);
    expect(result).toHaveLength(1);
  });
});
