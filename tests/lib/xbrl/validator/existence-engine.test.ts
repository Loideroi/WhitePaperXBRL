import { describe, it, expect } from 'vitest';
import {
  validateExistenceAssertions,
  getExistenceAssertions,
  getAssertionSummary,
} from '@/lib/xbrl/validator/existence-engine';
import type { WhitepaperData } from '@/types/whitepaper';

// Helper to create minimal valid data
function createMinimalData(): Partial<WhitepaperData> {
  return {
    tokenType: 'OTHR',
    documentDate: '2025-01-27',
    language: 'en',
    partA: {
      legalName: 'Test Corp',
      lei: '529900T8BM49AURSDO55',
      registeredAddress: '123 Main St',
      country: 'MT',
    },
    partD: {
      cryptoAssetName: 'Test Token',
      cryptoAssetSymbol: 'TST',
      totalSupply: 1000000,
      projectDescription: 'Test project description',
    },
    partE: {
      isPublicOffering: true,
      publicOfferingStartDate: '2025-06-01',
    },
    partH: {
      blockchainDescription: 'Ethereum-based token',
    },
  };
}

describe('Existence Engine', () => {
  describe('getExistenceAssertions', () => {
    it('should return assertions for OTHR token type', () => {
      const assertions = getExistenceAssertions('OTHR');

      expect(assertions.length).toBeGreaterThan(0);
      expect(assertions.every((a) => a.tokenTypes.includes('OTHR'))).toBe(true);
    });

    it('should return assertions for ART token type', () => {
      const assertions = getExistenceAssertions('ART');

      expect(assertions.length).toBeGreaterThan(0);
      // ART should have issuer-related assertions
      expect(assertions.some((a) => a.id.includes('ART'))).toBe(true);
    });

    it('should return assertions for EMT token type', () => {
      const assertions = getExistenceAssertions('EMT');

      expect(assertions.length).toBeGreaterThan(0);
      expect(assertions.some((a) => a.id.includes('EMT'))).toBe(true);
    });
  });

  describe('getAssertionSummary', () => {
    it('should return summary for OTHR', () => {
      const summary = getAssertionSummary('OTHR');

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.required).toBeGreaterThan(0);
      expect(summary.required + summary.recommended).toBe(summary.total);
      expect(summary.byPart).toBeDefined();
    });
  });

  describe('validateExistenceAssertions', () => {
    it('should pass with complete data', () => {
      const data = createMinimalData();
      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors.length).toBe(0);
    });

    it('should report missing required fields', () => {
      const data: Partial<WhitepaperData> = {
        tokenType: 'OTHR',
        // Missing most required fields
      };

      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.fieldPath === 'partA.legalName')).toBe(true);
      expect(result.errors.some((e) => e.fieldPath === 'partA.lei')).toBe(true);
    });

    it('should report missing crypto-asset name', () => {
      const data: Partial<WhitepaperData> = {
        tokenType: 'OTHR',
        partA: {
          legalName: 'Test Corp',
          lei: '529900T8BM49AURSDO55',
          registeredAddress: '123 Main St',
          country: 'MT',
        },
        // Missing partD
      };

      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors.some((e) => e.fieldPath === 'partD.cryptoAssetName')).toBe(true);
    });

    it('should evaluate conditional assertions', () => {
      // If public offering is true, start date is required
      const dataWithPublicOffering: Partial<WhitepaperData> = {
        ...createMinimalData(),
        partE: {
          isPublicOffering: true,
          // Missing publicOfferingStartDate
        },
      };

      const result = validateExistenceAssertions(dataWithPublicOffering, 'OTHR');

      expect(result.errors.some((e) => e.fieldPath === 'partE.publicOfferingStartDate')).toBe(true);
    });

    it('should skip conditional assertion when condition not met', () => {
      // If public offering is false, start date is not required
      const dataWithoutPublicOffering: Partial<WhitepaperData> = {
        ...createMinimalData(),
        partE: {
          isPublicOffering: false,
          // publicOfferingStartDate not needed
        },
      };

      const result = validateExistenceAssertions(dataWithoutPublicOffering, 'OTHR');

      expect(result.errors.some((e) => e.fieldPath === 'partE.publicOfferingStartDate')).toBe(false);
    });

    it('should categorize warnings vs errors', () => {
      const data: Partial<WhitepaperData> = {
        ...createMinimalData(),
        partA: {
          ...createMinimalData().partA!,
          website: undefined, // This is a warning, not error
        },
      };

      const result = validateExistenceAssertions(data, 'OTHR');

      // Website should be in warnings, not errors
      expect(result.warnings.some((w) => w.fieldPath === 'partA.website')).toBe(true);
      expect(result.errors.some((e) => e.fieldPath === 'partA.website')).toBe(false);
    });
  });
});
