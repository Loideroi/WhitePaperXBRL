import { describe, it, expect } from 'vitest';
import {
  generateIXBRLDocument,
  createIXBRLDocument,
} from '@/lib/xbrl/generator/document-generator';
import type { WhitepaperData } from '@/types/whitepaper';

/**
 * Minimal valid whitepaper data for testing
 */
function makeMinimalData(overrides?: Partial<WhitepaperData>): Partial<WhitepaperData> {
  return {
    tokenType: 'OTHR',
    documentDate: '2025-01-15',
    language: 'en',
    partA: {
      legalName: 'Test Corp',
      lei: '529900T8BM49AURSDO55',
      registeredAddress: '123 Main St',
      country: 'DE',
    },
    partD: {
      cryptoAssetName: 'TestToken',
      cryptoAssetSymbol: 'TT',
      totalSupply: 1000000,
      projectDescription: 'A test project.',
    },
    partE: {
      isPublicOffering: true,
    },
    partF: {
      classification: 'Utility Token',
      rightsDescription: 'Holders can use services.',
    },
    partG: {},
    partH: {
      blockchainDescription: 'Ethereum-based.',
    },
    partI: {
      offerRisks: ['Market risk'],
      issuerRisks: ['Credit risk'],
      marketRisks: ['Volatility risk'],
      technologyRisks: ['Smart contract risk'],
      regulatoryRisks: ['Regulatory risk'],
    },
    ...overrides,
  };
}

describe('document-generator xml:lang support', () => {
  it('should set xml:lang on root html element with default "en"', () => {
    const data = makeMinimalData({ language: undefined });
    const html = generateIXBRLDocument(data);

    expect(html).toMatch(/xml:lang="en"/);
  });

  it('should set xml:lang on root html element with specified language', () => {
    const data = makeMinimalData({ language: 'de' });
    const html = generateIXBRLDocument(data);

    expect(html).toMatch(/<html[^>]*xml:lang="de"/);
  });

  it('should set xml:lang on ix:references element with default "en"', () => {
    const data = makeMinimalData({ language: undefined });
    const html = generateIXBRLDocument(data);

    expect(html).toMatch(/<ix:references\s+xml:lang="en">/);
  });

  it('should set xml:lang on ix:references element with specified language', () => {
    const data = makeMinimalData({ language: 'fr' });
    const html = generateIXBRLDocument(data);

    expect(html).toMatch(/<ix:references\s+xml:lang="fr">/);
  });

  it('should have matching xml:lang on both root html and ix:references', () => {
    const data = makeMinimalData({ language: 'nl' });
    const html = generateIXBRLDocument(data);

    expect(html).toMatch(/<html[^>]*xml:lang="nl"/);
    expect(html).toMatch(/<ix:references\s+xml:lang="nl">/);
  });

  it('should set language property on IXBRLDocument object', () => {
    const data = makeMinimalData({ language: 'es' });
    const doc = createIXBRLDocument(data);

    expect(doc.language).toBe('es');
  });

  it('should default language to "en" on IXBRLDocument object', () => {
    const data = makeMinimalData({ language: undefined });
    const doc = createIXBRLDocument(data);

    expect(doc.language).toBe('en');
  });
});

describe('document-generator tryExtractNumericValue hardening', () => {
  it('should return empty for "Not applicable" text in numeric fields', () => {
    const data = makeMinimalData({
      rawFields: {
        'E.10': 'Not applicable — no subscription fee charged.',
      },
    });

    const doc = createIXBRLDocument(data);
    const fact = doc.facts.find(
      f => f.name === 'mica:SubscriptionFeeExpressedInCurrency'
    );

    // "Not applicable" in a monetary field → empty value (no fact or empty)
    if (fact) {
      expect(fact.value).toBe('');
    }
  });

  it('should skip year-like numbers in date text for numeric fields', () => {
    const data = makeMinimalData({
      rawFields: {
        'E.10': '2023-10-04 at 11:00 CET',
      },
    });

    const doc = createIXBRLDocument(data);
    const fact = doc.facts.find(
      f => f.name === 'mica:SubscriptionFeeExpressedInCurrency'
    );

    // All numbers are date/time/year — should return empty (skip year 2023, date parts)
    if (fact) {
      expect(fact.value).toBe('');
    }
  });

  it('should extract number adjacent to currency symbol', () => {
    const data = makeMinimalData({
      rawFields: {
        'E.10': 'EUR 1,500.00 subscription fee',
      },
    });

    const doc = createIXBRLDocument(data);
    const fact = doc.facts.find(
      f => f.name === 'mica:SubscriptionFeeExpressedInCurrency'
    );

    expect(fact).toBeDefined();
    expect(fact!.value).toBe('1500.00');
  });

  it('should extract number with commas stripped from narrative text', () => {
    const data = makeMinimalData({
      rawFields: {
        'A.10': '600,000 tokens issued',
      },
    });

    const doc = createIXBRLDocument(data);
    const fact = doc.facts.find(
      f => f.name === 'mica:OfferorsResponseTimeDays'
    );

    expect(fact).toBeDefined();
    expect(fact!.value).toBe('600000');
  });

  it('should trim whitespace from values in setValueIfPresent', () => {
    const data = makeMinimalData({
      partA: {
        legalName: '  Test Corp  ',
        lei: '529900T8BM49AURSDO55',
        registeredAddress: '123 Main St',
        country: 'DE',
      },
    });

    const doc = createIXBRLDocument(data);
    const fact = doc.facts.find(
      f => f.name === 'mica:NameOfOtherTokenOfferor'
    );

    expect(fact).toBeDefined();
    expect(fact!.value).toBe('Test Corp');
  });
});

describe('document-generator rawFields numeric handling', () => {
  describe('rawFields with numeric values', () => {
    it('should attach unitRef and decimals for integer rawFields', () => {
      const data = makeMinimalData({
        rawFields: {
          'A.10': '7',
        },
      });

      const doc = createIXBRLDocument(data);
      const responseDaysFact = doc.facts.find(
        f => f.name === 'mica:OfferorsResponseTimeDays'
      );

      expect(responseDaysFact).toBeDefined();
      expect(responseDaysFact!.value).toBe('7');
      expect(responseDaysFact!.unitRef).toBe('unit_pure');
      expect(responseDaysFact!.decimals).toBe(0);
    });

    it('should extract numeric value from "7 days" style text', () => {
      const data = makeMinimalData({
        rawFields: {
          'A.10': '(Days) Response time: 7 days.',
        },
      });

      const doc = createIXBRLDocument(data);
      const fact = doc.facts.find(
        f => f.name === 'mica:OfferorsResponseTimeDays'
      );

      expect(fact).toBeDefined();
      // Should extract "7" from the narrative
      expect(fact!.value).toBe('7');
      expect(fact!.unitRef).toBe('unit_pure');
      expect(fact!.decimals).toBe(0);
    });

    it('should pass non-numeric text through for non-numeric fields', () => {
      const data = makeMinimalData({
        rawFields: {
          'A.2': 'Limited Liability Company',
        },
      });

      const doc = createIXBRLDocument(data);
      const fact = doc.facts.find(
        f => f.name === 'mica:OfferorsLegalForm'
      );

      expect(fact).toBeDefined();
      expect(fact!.value).toBe('Limited Liability Company');
      expect(fact!.unitRef).toBeUndefined();
      expect(fact!.decimals).toBeUndefined();
    });

    it('should not add unitRef/decimals for text fields from rawFields', () => {
      const data = makeMinimalData({
        rawFields: {
          'A.13': 'Our business is focused on blockchain development.',
        },
      });

      const doc = createIXBRLDocument(data);
      const fact = doc.facts.find(
        f => f.name === 'mica:OfferorsBusinessActivityExplanatory'
      );

      expect(fact).toBeDefined();
      expect(fact!.unitRef).toBeUndefined();
    });
  });

  describe('rawFields with non-numeric content in numeric fields', () => {
    it('should return empty for non-numeric text in numeric fields', () => {
      const data = makeMinimalData({
        rawFields: {
          'C.10': 'Non-applicability of Part C — this section does not apply.',
        },
      });

      const doc = createIXBRLDocument(data);
      const fact = doc.facts.find(f => f.name === 'mica:NumberOfUnits');

      // No number found — returns empty string (better no value than wrong value)
      // Fact may still exist with empty value, or may not be generated
      if (fact) {
        expect(fact.value).toBe('');
      }
    });
  });

  describe('iXBRL output for numeric field fallback', () => {
    it('should generate ix:nonNumeric for numeric field with narrative text', () => {
      const data = makeMinimalData({
        rawFields: {
          'C.10': 'Not applicable',
        },
      });

      const html = generateIXBRLDocument(data);
      // Should NOT contain ix:nonFraction with "Not applicable"
      expect(html).not.toMatch(
        /<ix:nonFraction[^>]*>Not applicable<\/ix:nonFraction>/
      );
    });

    it('should generate ix:nonFraction for numeric field with extracted number', () => {
      const data = makeMinimalData({
        rawFields: {
          'A.10': '14',
        },
      });

      const html = generateIXBRLDocument(data);
      // Should contain ix:nonFraction with the number
      expect(html).toMatch(
        /<ix:nonFraction[^>]*unitRef="unit_pure"[^>]*>14<\/ix:nonFraction>/
      );
    });

    it('should generate ix:nonFraction with unitRef for typed numeric fields', () => {
      const data = makeMinimalData();
      // partD.totalSupply = 1000000 is mapped via typed extraction (not rawFields)
      const html = generateIXBRLDocument(data);
      // The total supply should have unitRef
      expect(html).toMatch(
        /<ix:nonFraction[^>]*unitRef="unit_pure"[^>]*>1000000<\/ix:nonFraction>/
      );
    });
  });
});
