import { describe, it, expect } from 'vitest';
import {
  validateValueAssertions,
  getValueAssertions,
  getValueAssertionSummary,
} from '@/lib/xbrl/validator/value-engine';
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
      isPublicOffering: false,
    },
    partH: {
      blockchainDescription: 'Ethereum-based token',
    },
  };
}

describe('Value Engine', () => {
  describe('getValueAssertions', () => {
    it('should return assertions for OTHR token type', () => {
      const assertions = getValueAssertions('OTHR');

      expect(assertions.length).toBeGreaterThan(0);
      expect(assertions.every((a) => a.tokenTypes.includes('OTHR'))).toBe(true);
    });

    it('should return assertions for ART token type', () => {
      const assertions = getValueAssertions('ART');

      expect(assertions.length).toBeGreaterThan(0);
      expect(assertions.some((a) => a.id.includes('ART'))).toBe(true);
    });

    it('should return assertions for EMT token type', () => {
      const assertions = getValueAssertions('EMT');

      expect(assertions.length).toBeGreaterThan(0);
      expect(assertions.some((a) => a.id.includes('EMT'))).toBe(true);
    });
  });

  describe('getValueAssertionSummary', () => {
    it('should return summary for OTHR', () => {
      const summary = getValueAssertionSummary('OTHR');

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.required).toBeGreaterThan(0);
      expect(summary.required + summary.recommended).toBe(summary.total);
    });
  });

  describe('validateValueAssertions', () => {
    it('should pass with valid data', () => {
      const data = createMinimalData();
      const result = validateValueAssertions(data, 'OTHR');

      // Should have no errors (but may have warnings)
      expect(result.errors.length).toBe(0);
    });

    describe('Date validations', () => {
      it('should report error when end date is before start date', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            publicOfferingStartDate: '2025-06-01',
            publicOfferingEndDate: '2025-05-01', // Before start
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-001')).toBe(true);
        expect(result.errors.some((e) => e.fieldPath === 'partE.publicOfferingEndDate')).toBe(true);
      });

      it('should pass when end date is after start date', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            publicOfferingStartDate: '2025-06-01',
            publicOfferingEndDate: '2025-12-31',
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-001')).toBe(false);
      });
    });

    describe('Numeric validations', () => {
      it('should report error for zero total supply', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partD: {
            ...createMinimalData().partD!,
            totalSupply: 0,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-002')).toBe(true);
      });

      it('should report error for negative total supply', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partD: {
            ...createMinimalData().partD!,
            totalSupply: -100,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-002')).toBe(true);
      });

      it('should report error for negative token price', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            tokenPrice: -10,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-003')).toBe(true);
      });

      it('should report error for negative subscription goal', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            maxSubscriptionGoal: -1000,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-004')).toBe(true);
      });
    });

    describe('Percentage validations', () => {
      it('should report error for percentage over 100', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partJ: {
            renewableEnergyPercentage: 150,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-005')).toBe(true);
      });

      it('should report error for negative percentage', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partJ: {
            renewableEnergyPercentage: -10,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-005')).toBe(true);
      });

      it('should pass for valid percentage', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partJ: {
            renewableEnergyPercentage: 75,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-005')).toBe(false);
      });
    });

    describe('Format validations', () => {
      it('should report error for invalid country code', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partA: {
            ...createMinimalData().partA!,
            country: 'USA', // 3 letters, should be 2
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-006')).toBe(true);
      });

      it('should pass for valid country code', () => {
        const data = createMinimalData();
        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-006')).toBe(false);
      });

      it('should warn for invalid URL', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partA: {
            ...createMinimalData().partA!,
            website: 'not-a-url',
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-007')).toBe(true);
      });

      it('should pass for valid URL', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partA: {
            ...createMinimalData().partA!,
            website: 'https://example.com',
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-007')).toBe(false);
      });

      it('should warn for invalid email', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partA: {
            ...createMinimalData().partA!,
            contactEmail: 'not-an-email',
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-008')).toBe(true);
      });

      it('should pass for valid email', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partA: {
            ...createMinimalData().partA!,
            contactEmail: 'test@example.com',
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-008')).toBe(false);
      });
    });

    describe('Document format validations', () => {
      it('should report error for invalid date format', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          documentDate: '27-01-2025', // Wrong format
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-009')).toBe(true);
      });

      it('should report error for invalid language code', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          language: 'ENG', // Should be 2 letters
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-010')).toBe(true);
      });

      it('should warn for non-EU language code (VAL-014)', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          language: 'zh', // Valid 2-letter code but not an EU language
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-014')).toBe(true);
      });

      it('should not warn for valid EU language code (VAL-014)', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          language: 'de', // German - valid EU language
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-014')).toBe(false);
      });

      it('should not trigger VAL-014 when VAL-010 already fails', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          language: 'ENG', // Fails format check (VAL-010)
        };

        const result = validateValueAssertions(data, 'OTHR');

        // VAL-010 triggers (format error), VAL-014 should NOT trigger
        expect(result.errors.some((e) => e.ruleId === 'VAL-010')).toBe(true);
        expect(result.warnings.some((w) => w.ruleId === 'VAL-014')).toBe(false);
      });
    });

    describe('Cross-field validations', () => {
      it('should warn when public offering lacks details', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            // No tokenPrice or maxSubscriptionGoal
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-011')).toBe(true);
      });

      it('should not warn when public offering has price', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partE: {
            isPublicOffering: true,
            tokenPrice: 1.5,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-011')).toBe(false);
      });

      it('should warn for lowercase token symbol', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partD: {
            ...createMinimalData().partD!,
            cryptoAssetSymbol: 'tst', // Lowercase
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.warnings.some((w) => w.ruleId === 'VAL-012')).toBe(true);
      });
    });

    describe('Energy validations', () => {
      it('should report error for negative energy consumption', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partJ: {
            energyConsumption: -100,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-013')).toBe(true);
      });

      it('should pass for zero energy consumption', () => {
        const data: Partial<WhitepaperData> = {
          ...createMinimalData(),
          partJ: {
            energyConsumption: 0,
          },
        };

        const result = validateValueAssertions(data, 'OTHR');

        expect(result.errors.some((e) => e.ruleId === 'VAL-013')).toBe(false);
      });
    });
  });
});
