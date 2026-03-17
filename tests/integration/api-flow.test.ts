import { describe, it, expect } from 'vitest';
import {
  generateIXBRLDocument,
  createIXBRLDocument,
} from '@/lib/xbrl/generator/document-generator';
import {
  validateWhitepaper,
  quickValidate,
  validateExistenceAssertions,
  validateValueAssertions,
} from '@/lib/xbrl/validator';
import type { WhitepaperData } from '@/types/whitepaper';
import type { TokenType } from '@/types/taxonomy';

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal valid OTHR whitepaper data for integration testing.
 */
function makeOTHRData(overrides?: Partial<WhitepaperData>): Partial<WhitepaperData> {
  return {
    tokenType: 'OTHR',
    documentDate: '2025-06-15',
    language: 'en',
    partA: {
      legalName: 'Integration Test Corp',
      lei: '529900T8BM49AURSDO55',
      registeredAddress: '123 Test Street, Berlin',
      country: 'DE',
    },
    partD: {
      cryptoAssetName: 'IntegrationToken',
      cryptoAssetSymbol: 'ITK',
      totalSupply: 5000000,
      projectDescription: 'A utility token for integration testing purposes.',
    },
    partE: {
      isPublicOffering: true,
    },
    partF: {
      classification: 'Utility Token',
      rightsDescription: 'Token holders can access platform services.',
    },
    partG: {},
    partH: {
      blockchainDescription: 'Built on Ethereum mainnet using ERC-20.',
    },
    partI: {
      offerRisks: ['Market volatility risk'],
      issuerRisks: ['Credit risk'],
      marketRisks: ['Liquidity risk'],
      technologyRisks: ['Smart contract vulnerability'],
      regulatoryRisks: ['Regulatory change risk'],
    },
    ...overrides,
  };
}

/**
 * Minimal valid ART (asset-referenced token) data.
 */
function makeARTData(overrides?: Partial<WhitepaperData>): Partial<WhitepaperData> {
  return {
    ...makeOTHRData(),
    tokenType: 'ART',
    partD: {
      cryptoAssetName: 'StableCoinART',
      cryptoAssetSymbol: 'SCART',
      totalSupply: 10000000,
      projectDescription: 'An asset-referenced stablecoin for integration testing.',
    },
    ...overrides,
  };
}

/**
 * Minimal valid EMT (e-money token) data.
 */
function makeEMTData(overrides?: Partial<WhitepaperData>): Partial<WhitepaperData> {
  return {
    ...makeOTHRData(),
    tokenType: 'EMT',
    partD: {
      cryptoAssetName: 'EMoneyToken',
      cryptoAssetSymbol: 'EMTK',
      totalSupply: 50000000,
      projectDescription: 'An e-money token for integration testing.',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Validation API Flow
// ---------------------------------------------------------------------------

describe('Integration: Validation flow', () => {
  describe('full validation with valid OTHR data', () => {
    it('should return a validation result with summary', async () => {
      const data = makeOTHRData();
      const result = await validateWhitepaper(data, 'OTHR');

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.byCategory).toBeDefined();
      expect(result.assertionCounts).toBeDefined();
      expect(result.assertionCounts.existence).toHaveProperty('total');
      expect(result.assertionCounts.existence).toHaveProperty('passed');
      expect(result.assertionCounts.existence).toHaveProperty('failed');
    });

    it('should categorize results by lei, existence, value, and duplicate', async () => {
      const data = makeOTHRData();
      const result = await validateWhitepaper(data, 'OTHR');

      expect(result.byCategory).toHaveProperty('lei');
      expect(result.byCategory).toHaveProperty('existence');
      expect(result.byCategory).toHaveProperty('value');
      expect(result.byCategory).toHaveProperty('duplicate');
    });
  });

  describe('validation with missing required fields', () => {
    it('should report existence errors for missing Part A fields', () => {
      const data = makeOTHRData({
        partA: undefined as unknown as WhitepaperData['partA'],
      });

      // Use existence engine directly to avoid context-builder throw (LEI required)
      const result = validateExistenceAssertions(data, 'OTHR');

      // With partA missing, multiple existence assertions should fail
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report existence errors when partD is missing', async () => {
      const data = makeOTHRData({
        partD: undefined as unknown as WhitepaperData['partD'],
      });

      const result = await validateWhitepaper(data, 'OTHR');
      const existenceErrors = result.byCategory.existence.errors;

      expect(existenceErrors.length).toBeGreaterThan(0);
    });
  });

  describe('quick validation mode', () => {
    it('should return quick validation result for valid data', () => {
      const data = makeOTHRData();
      const result = quickValidate(data, 'OTHR');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errorCount');
      expect(result).toHaveProperty('errors');
      expect(typeof result.valid).toBe('boolean');
      expect(typeof result.errorCount).toBe('number');
    });
  });

  describe('invalid token type handling', () => {
    it('should handle an unrecognised token type gracefully in existence engine', () => {
      const data = makeOTHRData();
      // The existence engine uses the tokenType to select assertions.
      // Passing an invalid type should not throw; it returns with 0 assertions.
      const result = validateExistenceAssertions(data, 'INVALID' as TokenType);

      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('VAL-016: B.1=true without Section B content', () => {
    it('should produce VAL-016 error when B.1=true but no Section B data', () => {
      const data = makeOTHRData({
        rawFields: {
          'B.1': 'true',
        },
        partB: undefined,
      });

      const result = validateValueAssertions(data, 'OTHR');
      const val016 = result.errors.find(e => e.ruleId === 'VAL-016');

      expect(val016).toBeDefined();
      expect(val016!.severity).toBe('ERROR');
      expect(val016!.fieldPath).toBe('partB');
    });

    it('should NOT produce VAL-016 when B.1=true and Section B has data', () => {
      const data = makeOTHRData({
        rawFields: {
          'B.1': 'true',
          'B.2': 'Issuer Corp Ltd',
        },
        partB: undefined,
      });

      const result = validateValueAssertions(data, 'OTHR');
      const val016 = result.errors.find(e => e.ruleId === 'VAL-016');

      expect(val016).toBeUndefined();
    });

    it('should NOT produce VAL-016 when B.1 is not present', () => {
      const data = makeOTHRData();

      const result = validateValueAssertions(data, 'OTHR');
      const val016 = result.errors.find(e => e.ruleId === 'VAL-016');

      expect(val016).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Generation API Flow
// ---------------------------------------------------------------------------

describe('Integration: Generation flow', () => {
  describe('OTHR iXBRL generation', () => {
    it('should generate valid iXBRL content from OTHR data', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toBeDefined();
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should contain XML declaration', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toMatch(/^<\?xml\s+version="1\.0"\s+encoding="utf-8"\?>/i);
    });

    it('should reference table_2.xsd taxonomy for OTHR token type', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('table_2.xsd');
      expect(html).toContain('mica_entry_table_2.xsd');
    });

    it('should contain ix:header with contexts and units', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('<ix:header>');
      expect(html).toContain('</ix:header>');
      expect(html).toContain('<xbrli:context');
      expect(html).toContain('<xbrli:unit');
    });

    it('should have xml:lang attribute on root html element', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toMatch(/<html[^>]*xml:lang="en"/);
    });

    it('should contain proper XBRL namespace declarations', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('xmlns:ix=');
      expect(html).toContain('xmlns:xbrli=');
      expect(html).toContain('xmlns:mica=');
    });

    it('should include the legal name as a tagged fact', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('Integration Test Corp');
    });

    it('should include the crypto-asset name as a tagged fact', () => {
      const data = makeOTHRData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('IntegrationToken');
    });
  });

  describe('ART iXBRL generation', () => {
    it('should reference table_3.xsd taxonomy for ART token type', () => {
      const data = makeARTData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('table_3.xsd');
      expect(html).toContain('mica_entry_table_3.xsd');
    });

    it('should still contain ix:header structure', () => {
      const data = makeARTData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('<ix:header>');
      expect(html).toContain('<xbrli:context');
    });
  });

  describe('EMT iXBRL generation', () => {
    it('should reference table_4.xsd taxonomy for EMT token type', () => {
      const data = makeEMTData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('table_4.xsd');
      expect(html).toContain('mica_entry_table_4.xsd');
    });

    it('should still contain ix:header structure', () => {
      const data = makeEMTData();
      const html = generateIXBRLDocument(data);

      expect(html).toContain('<ix:header>');
      expect(html).toContain('<xbrli:context');
    });
  });

  describe('createIXBRLDocument structured output', () => {
    it('should produce facts array from OTHR data', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      expect(doc.facts).toBeDefined();
      expect(Array.isArray(doc.facts)).toBe(true);
      expect(doc.facts.length).toBeGreaterThan(0);
    });

    it('should produce contexts and units', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      expect(doc.contexts).toBeDefined();
      expect(doc.contexts.length).toBeGreaterThan(0);
      expect(doc.units).toBeDefined();
      expect(doc.units.length).toBeGreaterThan(0);
    });

    it('should include duplicate check result', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      expect(doc.duplicateCheck).toBeDefined();
      expect(doc.duplicateCheck).toHaveProperty('hasDuplicates');
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Token Type Field Mapping
// ---------------------------------------------------------------------------

describe('Integration: Token type field mapping', () => {
  describe('OTHR fields use OtherToken XBRL elements', () => {
    it('should map legal name to mica:NameOfOtherTokenOfferor', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      const legalNameFact = doc.facts.find(
        f => f.name === 'mica:NameOfOtherTokenOfferor'
      );

      expect(legalNameFact).toBeDefined();
      expect(legalNameFact!.value).toBe('Integration Test Corp');
    });

    it('should map crypto-asset name to mica:NameOfOtherToken', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      const tokenNameFact = doc.facts.find(
        f => f.name === 'mica:NameOfOtherToken'
      );

      expect(tokenNameFact).toBeDefined();
      expect(tokenNameFact!.value).toBe('IntegrationToken');
    });

    it('should map LEI to mica:OfferorsLegalEntityIdentifier', () => {
      const data = makeOTHRData();
      const doc = createIXBRLDocument(data);

      const leiFact = doc.facts.find(
        f => f.name === 'mica:OfferorsLegalEntityIdentifier'
      );

      expect(leiFact).toBeDefined();
      expect(leiFact!.value).toBe('529900T8BM49AURSDO55');
    });
  });

  describe('ART fields use correct XBRL elements', () => {
    it('should map partA.legalName to mica:NameOfOtherTokenOfferor for ART', () => {
      const data = makeARTData();
      const doc = createIXBRLDocument(data);

      // partA.legalName always maps to mica:NameOfOtherTokenOfferor
      const legalNameFact = doc.facts.find(
        f => f.name === 'mica:NameOfOtherTokenOfferor'
      );

      expect(legalNameFact).toBeDefined();
      expect(legalNameFact!.value).toBe('Integration Test Corp');
    });

    it('should map rawFields B.1 to mica:AssetreferencedTokenName for ART', () => {
      const data = makeARTData({
        rawFields: {
          'B.1': 'StableCoinART',
        },
      });
      const doc = createIXBRLDocument(data);

      const tokenNameFact = doc.facts.find(
        f => f.name === 'mica:AssetreferencedTokenName'
      );

      expect(tokenNameFact).toBeDefined();
      expect(tokenNameFact!.value).toBe('StableCoinART');
    });
  });

  describe('EMT fields use correct XBRL elements', () => {
    it('should map partA.legalName to mica:NameOfOtherTokenOfferor for EMT', () => {
      const data = makeEMTData();
      const doc = createIXBRLDocument(data);

      const legalNameFact = doc.facts.find(
        f => f.name === 'mica:NameOfOtherTokenOfferor'
      );

      expect(legalNameFact).toBeDefined();
      expect(legalNameFact!.value).toBe('Integration Test Corp');
    });

    it('should map rawFields B.1 to mica:EmoneyTokensName for EMT', () => {
      const data = makeEMTData({
        rawFields: {
          'B.1': 'EMoneyToken',
        },
      });
      const doc = createIXBRLDocument(data);

      const tokenNameFact = doc.facts.find(
        f => f.name === 'mica:EmoneyTokensName'
      );

      expect(tokenNameFact).toBeDefined();
      expect(tokenNameFact!.value).toBe('EMoneyToken');
    });
  });

  describe('F.12 language field outputs full language name', () => {
    it('should output "English" for language code "en"', () => {
      const data = makeOTHRData({
        language: 'en',
        rawFields: {
          'F.12': 'en',
        },
      });

      const html = generateIXBRLDocument(data);

      // The language support module converts "en" to "English"
      // Check the generated HTML contains "English" (not raw "en" for F.12)
      expect(html).toContain('English');
    });

    it('should output "German" for language code "de"', () => {
      const data = makeOTHRData({
        language: 'de',
        rawFields: {
          'F.12': 'de',
        },
      });

      const html = generateIXBRLDocument(data);

      expect(html).toContain('German');
    });
  });
});

// ---------------------------------------------------------------------------
// 4. End-to-End: Validate then Generate
// ---------------------------------------------------------------------------

describe('Integration: Validate then Generate pipeline', () => {
  it('should validate OTHR data and then generate iXBRL without errors', async () => {
    const data = makeOTHRData();

    // Step 1: Validate
    const validation = await validateWhitepaper(data, 'OTHR');
    expect(validation).toBeDefined();

    // Step 2: Generate
    const html = generateIXBRLDocument(data);
    expect(html).toBeDefined();
    expect(html).toMatch(/^<\?xml/);
    expect(html).toContain('<ix:header>');
  });

  it('should validate ART data and then generate iXBRL without errors', async () => {
    const data = makeARTData();

    const validation = await validateWhitepaper(data, 'ART');
    expect(validation).toBeDefined();

    const html = generateIXBRLDocument(data);
    expect(html).toContain('table_3.xsd');
  });

  it('should validate EMT data and then generate iXBRL without errors', async () => {
    const data = makeEMTData();

    const validation = await validateWhitepaper(data, 'EMT');
    expect(validation).toBeDefined();

    const html = generateIXBRLDocument(data);
    expect(html).toContain('table_4.xsd');
  });
});
