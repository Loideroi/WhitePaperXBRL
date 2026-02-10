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
    it('should preserve "Not applicable" text when no number is found', () => {
      const data = makeMinimalData({
        rawFields: {
          'C.10': 'Non-applicability of Part C — this section does not apply.',
        },
      });

      const doc = createIXBRLDocument(data);
      const fact = doc.facts.find(f => f.name === 'mica:NumberOfUnits');

      expect(fact).toBeDefined();
      // No number found, original text passes through
      expect(fact!.value).toBe(
        'Non-applicability of Part C — this section does not apply.'
      );
      // unitRef and decimals are still set, but inline-tagger will handle fallback
      expect(fact!.unitRef).toBe('unit_pure');
      expect(fact!.decimals).toBe(0);
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
