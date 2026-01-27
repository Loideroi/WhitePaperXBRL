import { describe, it, expect } from 'vitest';
import { mapPdfToWhitepaper } from '@/lib/pdf/field-mapper';
import type { PdfExtractionResult } from '@/lib/pdf/extractor';

function createExtractionResult(sections: [string, string][]): PdfExtractionResult {
  return {
    text: sections.map(([, content]) => content).join('\n\n'),
    pages: 1,
    metadata: {},
    sections: new Map(sections),
  };
}

describe('mapPdfToWhitepaper', () => {
  describe('Part A - Offeror Information', () => {
    it('should extract legal name', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Example Corporation Ltd'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.legalName).toBe('Example Corporation Ltd');
      expect(result.mappings).toContainEqual(
        expect.objectContaining({
          path: 'partA.legalName',
          confidence: 'high',
        })
      );
    });

    it('should extract LEI', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.2    LEI    529900T8BM49AURSDO55'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.lei).toBe('529900T8BM49AURSDO55');
    });

    it('should extract country code', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.4    Country    Malta'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.country).toBe('MT');
    });

    it('should extract website URL', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.5    Website    https://example.com'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.website).toBe('https://example.com');
    });

    it('should extract contact email', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.6    Email    contact@example.com'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.contactEmail).toBe('contact@example.com');
    });
  });

  describe('Part D - Project Information', () => {
    it('should extract crypto-asset name', () => {
      const extraction = createExtractionResult([
        ['partD', 'D.1    Crypto-asset Name    PERSIJA Fan Token'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partD?.cryptoAssetName).toBe('PERSIJA Fan Token');
    });

    it('should extract ticker symbol', () => {
      const extraction = createExtractionResult([
        ['partD', 'D.2    Ticker    $PERSIJA'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partD?.cryptoAssetSymbol).toBe('PERSIJA');
    });

    it('should extract total supply', () => {
      const extraction = createExtractionResult([
        ['partD', 'D.5    Total Supply    100,000,000'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partD?.totalSupply).toBe(100000000);
    });

    it('should extract blockchain network from F.1', () => {
      const extraction = createExtractionResult([
        ['partF', 'F.1    Crypto-asset type    The $SPURS operates on the Chiliz Chain'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partD?.blockchainNetwork).toBe('Chiliz Chain');
    });

    it('should extract consensus mechanism', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Consensus Mechanism    Proof of Stake Authority'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partD?.consensusMechanism).toBe('Proof of Stake Authority');
    });
  });

  describe('Part E - Offering Details', () => {
    it('should extract public offering flag', () => {
      const extraction = createExtractionResult([
        ['partE', 'E.1    Public Offering    Yes'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partE?.isPublicOffering).toBe(true);
    });

    it('should extract token price', () => {
      const extraction = createExtractionResult([
        ['partE', 'E.3    Token Price    EUR 0.10'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partE?.tokenPrice).toBe(0.1);
    });

    it('should extract withdrawal rights', () => {
      const extraction = createExtractionResult([
        ['partE', 'E.5    Withdrawal Rights    Yes, entitled to withdraw'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partE?.withdrawalRights).toBe(true);
    });
  });

  describe('Part H - Technology', () => {
    it('should extract blockchain description', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Blockchain Description    Ethereum-based EVM compatible chain'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).toBe('Ethereum-based EVM compatible chain');
    });

    it('should extract smart contract info', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.2    Smart Contract    0x1234567890abcdef'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.smartContractInfo).toBe('0x1234567890abcdef');
    });

    it('should extract security audit info', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.3    Security Audit    Audited by CertiK'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.securityAudits).toContain('Audited by CertiK');
    });
  });

  describe('Part J - Sustainability', () => {
    it('should extract energy consumption', () => {
      const extraction = createExtractionResult([
        ['partJ', 'J.1    Energy Consumption    500 kWh'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partJ?.energyConsumption).toBe(500);
    });
  });

  describe('Confidence scoring', () => {
    it('should provide overall confidence score', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Test Corp'],
        ['partD', 'D.1    Token Name    Test Token'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.confidence.overall).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThanOrEqual(100);
    });

    it('should track confidence by section', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Test Corp'],
        ['partD', 'D.1    Token Name    Test Token'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.confidence.bySection).toBeDefined();
    });

    it('should track low confidence fields', () => {
      const extraction = createExtractionResult([
        ['content', 'Some unstructured text mentioning legal name Test Corp'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      // Low confidence fields from pattern matching (not table extraction)
      expect(Array.isArray(result.confidence.lowConfidenceFields)).toBe(true);
    });
  });

  describe('Token type handling', () => {
    it('should set token type when provided', () => {
      const extraction = createExtractionResult([['content', 'Some content']]);

      const result = mapPdfToWhitepaper(extraction, 'OTHR');

      expect(result.data.tokenType).toBe('OTHR');
    });

    it('should set default language and document date', () => {
      const extraction = createExtractionResult([['content', 'Some content']]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.language).toBe('en');
      expect(result.data.documentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Country code extraction', () => {
    it('should convert country names to ISO codes', () => {
      const countries = [
        ['Switzerland', 'CH'],
        ['Malta', 'MT'],
        ['Germany', 'DE'],
        ['France', 'FR'],
        ['Netherlands', 'NL'],
        ['Luxembourg', 'LU'],
        ['Ireland', 'IE'],
        ['United Kingdom', 'GB'],
      ];

      for (const [name, code] of countries) {
        const extraction = createExtractionResult([['partA', `A.4    Country    ${name}`]]);

        const result = mapPdfToWhitepaper(extraction);
        expect(result.data.partA?.country).toBe(code);
      }
    });
  });

  describe('Multiple sections', () => {
    it('should process multiple sections correctly', () => {
      const extraction = createExtractionResult([
        ['partA', '1. Legal Name: Offeror Ltd\n2. LEI: 529900T8BM49AURSDO55'],
        ['partD', '1. Token Name: Test Token\n2. Symbol: TST'],
        ['partH', '1. Blockchain Description: Ethereum based network'],
      ]);

      const result = mapPdfToWhitepaper(extraction, 'OTHR');

      expect(result.data.partA?.legalName).toBe('Offeror Ltd');
      expect(result.data.partA?.lei).toBe('529900T8BM49AURSDO55');
      expect(result.data.partD?.cryptoAssetName).toBe('Test Token');
      expect(result.data.partD?.cryptoAssetSymbol).toBe('TST');
      expect(result.data.partH?.blockchainDescription).toBe('Ethereum based network');
    });
  });

  describe('Mappings tracking', () => {
    it('should track all extracted mappings', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Test Corp\nA.2    LEI    529900T8BM49AURSDO55'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.mappings.length).toBeGreaterThan(0);
      expect(result.mappings[0]).toHaveProperty('path');
      expect(result.mappings[0]).toHaveProperty('value');
      expect(result.mappings[0]).toHaveProperty('source');
      expect(result.mappings[0]).toHaveProperty('confidence');
    });
  });
});
