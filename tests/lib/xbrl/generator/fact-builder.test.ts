import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildStringFact,
  buildBooleanFact,
  buildMonetaryFact,
  buildIntegerFact,
  buildDecimalFact,
  buildDateFact,
  buildTextBlockFact,
  buildAllFacts,
  getRequiredUnits,
  resetFactCounter,
  STANDARD_UNITS,
} from '@/lib/xbrl/generator/fact-builder';

describe('Fact Builder', () => {
  beforeEach(() => {
    resetFactCounter();
  });

  describe('buildStringFact', () => {
    it('should create a string fact with escape defaulting to true', () => {
      const fact = buildStringFact('mica:LegalName', 'Acme Corp', 'ctx_instant');

      expect(fact.id).toBe('f_1');
      expect(fact.name).toBe('mica:LegalName');
      expect(fact.value).toBe('Acme Corp');
      expect(fact.contextRef).toBe('ctx_instant');
      expect(fact.escape).toBe(true);
    });

    it('should allow escape=false', () => {
      const fact = buildStringFact('mica:Symbol', 'ACME', 'ctx_instant', false);

      expect(fact.escape).toBe(false);
    });

    it('should increment fact IDs', () => {
      const f1 = buildStringFact('a', 'v1', 'ctx');
      const f2 = buildStringFact('b', 'v2', 'ctx');

      expect(f1.id).toBe('f_1');
      expect(f2.id).toBe('f_2');
    });
  });

  describe('buildBooleanFact', () => {
    it('should convert true to "true"', () => {
      const fact = buildBooleanFact('mica:IsPublic', true, 'ctx_instant');

      expect(fact.value).toBe('true');
    });

    it('should convert false to "false"', () => {
      const fact = buildBooleanFact('mica:IsPublic', false, 'ctx_instant');

      expect(fact.value).toBe('false');
    });
  });

  describe('buildMonetaryFact', () => {
    it('should map EUR to unit_EUR', () => {
      const fact = buildMonetaryFact('mica:TokenPrice', 1.5, 'EUR', 'ctx_instant');

      expect(fact.unitRef).toBe('unit_EUR');
      expect(fact.value).toBe(1.5);
      expect(fact.decimals).toBe(2);
    });

    it('should map USD to unit_USD', () => {
      const fact = buildMonetaryFact('mica:TokenPrice', 100, 'USD', 'ctx_instant');

      expect(fact.unitRef).toBe('unit_USD');
    });

    it('should default to unit_EUR for unknown currency', () => {
      const fact = buildMonetaryFact('mica:Price', 50, 'JPY', 'ctx_instant');

      expect(fact.unitRef).toBe('unit_EUR');
    });

    it('should respect custom decimals', () => {
      const fact = buildMonetaryFact('mica:Price', 99.999, 'EUR', 'ctx_instant', 4);

      expect(fact.decimals).toBe(4);
    });
  });

  describe('buildIntegerFact', () => {
    it('should use unit_pure and decimals=0', () => {
      const fact = buildIntegerFact('mica:TotalSupply', 1000000, 'ctx_instant');

      expect(fact.unitRef).toBe('unit_pure');
      expect(fact.decimals).toBe(0);
      expect(fact.value).toBe(1000000);
    });

    it('should round non-integer values', () => {
      const fact = buildIntegerFact('mica:TotalSupply', 999.7, 'ctx_instant');

      expect(fact.value).toBe(1000);
    });
  });

  describe('buildDecimalFact', () => {
    it('should use unit_pure with default decimals=2', () => {
      const fact = buildDecimalFact('mica:Energy', 42.5, 'ctx_instant');

      expect(fact.unitRef).toBe('unit_pure');
      expect(fact.decimals).toBe(2);
      expect(fact.value).toBe(42.5);
    });

    it('should respect custom decimals', () => {
      const fact = buildDecimalFact('mica:Percentage', 0.8137, 'ctx_instant', 4);

      expect(fact.decimals).toBe(4);
    });
  });

  describe('buildDateFact', () => {
    it('should create a date fact without unitRef or decimals', () => {
      const fact = buildDateFact('mica:StartDate', '2025-01-15', 'ctx_instant');

      expect(fact.value).toBe('2025-01-15');
      expect(fact.unitRef).toBeUndefined();
      expect(fact.decimals).toBeUndefined();
    });
  });

  describe('buildTextBlockFact', () => {
    it('should set escape=true for text blocks', () => {
      const fact = buildTextBlockFact('mica:Description', '<p>Hello</p>', 'ctx_instant');

      expect(fact.escape).toBe(true);
      expect(fact.value).toBe('<p>Hello</p>');
    });
  });

  describe('STANDARD_UNITS', () => {
    it('should include EUR, USD, GBP, CHF, and pure', () => {
      const ids = STANDARD_UNITS.map((u) => u.id);

      expect(ids).toContain('unit_EUR');
      expect(ids).toContain('unit_USD');
      expect(ids).toContain('unit_GBP');
      expect(ids).toContain('unit_CHF');
      expect(ids).toContain('unit_pure');
    });

    it('should use iso4217 for currencies and xbrli for pure', () => {
      const eur = STANDARD_UNITS.find((u) => u.id === 'unit_EUR');
      const pure = STANDARD_UNITS.find((u) => u.id === 'unit_pure');

      expect(eur?.measure).toBe('iso4217:EUR');
      expect(pure?.measure).toBe('xbrli:pure');
    });
  });

  describe('buildAllFacts', () => {
    it('should include tokenType, documentDate, and language facts', () => {
      const facts = buildAllFacts({
        tokenType: 'OTHR' as never,
        documentDate: '2025-06-15',
        language: 'en',
      });

      expect(facts.some((f) => f.name === 'mica:TokenType' && f.value === 'OTHR')).toBe(true);
      expect(facts.some((f) => f.name === 'mica:DocumentDate' && f.value === '2025-06-15')).toBe(true);
      expect(facts.some((f) => f.name === 'mica:DocumentLanguage' && f.value === 'en')).toBe(true);
    });

    it('should map partA fields to XBRL facts', () => {
      const facts = buildAllFacts({
        partA: {
          lei: '529900T8BM49AURSDO55',
          legalName: 'Test Corp',
          country: 'DE',
        } as never,
      });

      expect(facts.some((f) => f.name === 'mica:OfferorLegalName' && f.value === 'Test Corp')).toBe(true);
      expect(facts.some((f) => f.name === 'mica:OfferorCountry' && f.value === 'DE')).toBe(true);
    });

    it('should map partD fields', () => {
      const facts = buildAllFacts({
        partD: {
          cryptoAssetName: 'TestCoin',
          totalSupply: 21000000,
        } as never,
      });

      const nameFact = facts.find((f) => f.name === 'mica:CryptoAssetName');
      const supplyFact = facts.find((f) => f.name === 'mica:TotalSupply');

      expect(nameFact?.value).toBe('TestCoin');
      expect(supplyFact?.value).toBe(21000000);
      expect(supplyFact?.unitRef).toBe('unit_pure');
      expect(supplyFact?.decimals).toBe(0);
    });

    it('should map boolean fields correctly', () => {
      const facts = buildAllFacts({
        partE: {
          isPublicOffering: true,
          withdrawalRights: false,
        } as never,
      });

      expect(facts.some((f) => f.name === 'mica:IsPublicOffering' && f.value === 'true')).toBe(true);
      expect(facts.some((f) => f.name === 'mica:WithdrawalRights' && f.value === 'false')).toBe(true);
    });

    it('should skip undefined, null, and empty values', () => {
      const facts = buildAllFacts({
        partA: {
          lei: '529900T8BM49AURSDO55',
          legalName: '',
          website: undefined,
        } as never,
      });

      expect(facts.some((f) => f.name === 'mica:OfferorLegalName')).toBe(false);
      expect(facts.some((f) => f.name === 'mica:OfferorWebsite')).toBe(false);
    });

    it('should map textblock fields with escape=true', () => {
      const facts = buildAllFacts({
        partD: {
          projectDescription: 'A great project',
        } as never,
      });

      const descFact = facts.find((f) => f.name === 'mica:ProjectDescription');
      expect(descFact?.escape).toBe(true);
    });

    it('should reset fact counter producing sequential IDs', () => {
      const facts = buildAllFacts({
        tokenType: 'ART' as never,
        documentDate: '2025-01-01',
      });

      expect(facts[0]?.id).toBe('f_1');
      expect(facts[1]?.id).toBe('f_2');
    });
  });

  describe('getRequiredUnits', () => {
    it('should return only units referenced by facts', () => {
      resetFactCounter();
      const facts = [
        buildMonetaryFact('mica:Price', 100, 'EUR', 'ctx'),
        buildIntegerFact('mica:Supply', 1000, 'ctx'),
      ];

      const units = getRequiredUnits(facts);
      const ids = units.map((u) => u.id);

      expect(ids).toContain('unit_EUR');
      expect(ids).toContain('unit_pure');
      expect(ids).not.toContain('unit_USD');
      expect(ids).not.toContain('unit_GBP');
    });

    it('should return empty array when no facts have unitRef', () => {
      resetFactCounter();
      const facts = [
        buildStringFact('mica:Name', 'Test', 'ctx'),
        buildDateFact('mica:Date', '2025-01-01', 'ctx'),
      ];

      const units = getRequiredUnits(facts);

      expect(units).toHaveLength(0);
    });
  });
});
