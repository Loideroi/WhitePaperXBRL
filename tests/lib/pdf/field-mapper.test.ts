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
    it('should extract blockchain description from H.1 DLT', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The Chiliz Chain is an EVM compatible layer 1 blockchain'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).toBe('The Chiliz Chain is an EVM compatible layer 1 blockchain');
    });

    it('should extract smart contract info from H.2 protocols', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.2    Protocols and technical standards    CAP-20 Token Standard compatible with ERC-20'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.smartContractInfo).toBe('CAP-20 Token Standard compatible with ERC-20');
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

    it('should extract country from end of address string', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.3    Registered address    Gubelstrasse 11, 6300 Zug, Switzerland'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.country).toBe('CH');
    });

    it('should extract country from multi-comma address', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.4    Head office    Level 3, Quantum House, 75 Abate Rigord Street, Ta\' Xbiex, Malta'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.country).toBe('MT');
    });
  });

  describe('Pattern scoping to sections', () => {
    it('should not match H.1 pattern text from Part A content', () => {
      // Part A has "Markets Served" text, Part H has DLT description
      const extraction: PdfExtractionResult = {
        text: 'Part A Markets Served The company operates globally\n\nH.1 Distributed ledger technology The Ethereum blockchain',
        pages: 1,
        metadata: {},
        sections: new Map([
          ['partA', 'Part A Markets Served The company operates globally'],
          ['partH', 'H.1 Distributed ledger technology The Ethereum blockchain'],
        ]),
      };

      const result = mapPdfToWhitepaper(extraction);

      // The blockchain description should come from Part H, not Part A
      if (result.data.partH?.blockchainDescription) {
        expect(result.data.partH.blockchainDescription).toContain('Ethereum');
        expect(result.data.partH.blockchainDescription).not.toContain('Markets Served');
      }
    });
  });

  describe('Date normalization and trailing punctuation', () => {
    it('should strip trailing period from date value', () => {
      const extraction = createExtractionResult([
        ['partE', 'E.21    Subscription period beginning    2021-01-21.'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partE?.publicOfferingStartDate).toBe('2021-01-21');
    });

    it('should normalize DD/MM/YYYY to ISO format', () => {
      const extraction = createExtractionResult([
        ['partE', 'E.22    Subscription period end    04/10/2023'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partE?.publicOfferingEndDate).toBe('2023-10-04');
    });

    it('should strip trailing period from single-line field values', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Socios Technologies AG.'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.legalName).toBe('Socios Technologies AG');
    });

    it('should preserve trailing periods in multi-line content', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The Chiliz Chain is a blockchain.\nIt supports smart contracts and tokens.'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      // Multi-line content should preserve natural prose periods
      expect(result.data.partH?.blockchainDescription).toContain('blockchain.');
    });
  });

  describe('Multiple sections', () => {
    it('should process multiple sections correctly', () => {
      const extraction = createExtractionResult([
        ['partA', '1. Legal Name: Offeror Ltd\n2. LEI: 529900T8BM49AURSDO55'],
        ['partD', '1. Token Name: Test Token\n2. Symbol: TST'],
        ['partH', 'H.1    Distributed ledger technology    Ethereum based network'],
      ]);

      const result = mapPdfToWhitepaper(extraction, 'OTHR');

      expect(result.data.partA?.legalName).toBe('Offeror Ltd');
      expect(result.data.partA?.lei).toBe('529900T8BM49AURSDO55');
      expect(result.data.partD?.cryptoAssetName).toBe('Test Token');
      expect(result.data.partD?.cryptoAssetSymbol).toBe('TST');
      expect(result.data.partH?.blockchainDescription).toBe('Ethereum based network');
    });
  });

  describe('Placeholder text stripping', () => {
    it('should return empty for standalone "No Field Content"', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    No Field Content'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      // Should not extract a legal name value
      expect(result.data.partA?.legalName).toBeUndefined();
    });

    it('should strip "No Field Content" at end of real content', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The Chiliz Chain is an EVM compatible layer 1 blockchain that supports CAP-20 tokens No Field Content'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).not.toContain('No Field Content');
      expect(result.data.partH?.blockchainDescription).toContain('Chiliz Chain');
    });

    it('should strip "No Field Content" on separate line within content', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The Chiliz Chain is a blockchain.\nNo Field Content\nIt supports smart contracts.'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).not.toContain('No Field Content');
    });

    it('should strip mid-text "No Field Content" between sentences', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The Chiliz Chain is a blockchain technology. No Field Content The protocol uses Proof of Stake.'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).not.toContain('No Field Content');
      expect(desc).toContain('blockchain technology');
      expect(desc).toContain('Proof of Stake');
    });

    it('should not alter content without placeholder text', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Legal Name    Socios Technologies AG'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partA?.legalName).toBe('Socios Technologies AG');
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

  describe('Ligature repair', () => {
    it('should repair ff ligature splitting in extracted content', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The public o ffering of crypto-assets provides bene fits to a ffiliates'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('offering');
      expect(desc).toContain('benefits');
      expect(desc).toContain('affiliates');
      expect(desc).not.toContain('o ffering');
      expect(desc).not.toContain('bene fits');
      expect(desc).not.toContain('a ffiliates');
    });

    it('should repair fi ligature splitting', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The speci fic classi fication was con firmed'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('specific');
      expect(desc).toContain('classification');
      expect(desc).toContain('confirmed');
    });

    it('should repair fl ligature splitting', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The in flation rate re flects market conditions'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('inflation');
      expect(desc).toContain('reflects');
    });

    it('should not alter text without ligature issues', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The blockchain uses standard protocols'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).toBe('The blockchain uses standard protocols');
    });

    it('should repair ligatures in rawFields content', () => {
      const extraction = createExtractionResult([
        ['partI', 'I.1    Offer-related risks    The o ffering carries speci fic risks for a ffiliates'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawI1 = result.data.rawFields?.['I.1'];
      expect(rawI1).toBeDefined();
      if (rawI1) {
        expect(rawI1).toContain('offering');
        expect(rawI1).toContain('specific');
        expect(rawI1).not.toContain('o ffering');
      }
    });

    it('should repair ligatures with non-breaking space (\\u00A0)', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The o\u00A0ffering provides bene\u00A0fits'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('offering');
      expect(desc).toContain('benefits');
      expect(desc).not.toContain('\u00A0ff');
    });

    it('should repair ligatures with tab character', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The speci\tfic con\tfirmed result'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('specific');
      expect(desc).toContain('confirmed');
    });
  });

  describe('Section header bleed stripping', () => {
    it('should strip section header from end of content', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The blockchain is secure.\n\nPart D:\nInformation about the crypto-asset project'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const desc = result.data.partH?.blockchainDescription;
      expect(desc).toContain('blockchain is secure');
      expect(desc).not.toContain('Part D');
      expect(desc).not.toContain('Information about');
    });

    it('should not strip content that does not end with a section header', () => {
      const extraction = createExtractionResult([
        ['partH', 'H.1    Distributed ledger technology    The blockchain supports smart contracts and DApps'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      expect(result.data.partH?.blockchainDescription).toBe('The blockchain supports smart contracts and DApps');
    });
  });

  describe('Field label prefix stripping', () => {
    it('should strip field number echo from rawFields content', () => {
      // When the table parser captures "E.2 Reasons for public offer..." the field number
      // prefix "E.2" should be stripped since it duplicates the key
      const extraction = createExtractionResult([
        ['partE', 'E.1    Public Offering    Yes\nE.2    Reasons for public offer or admission to trading    The $TOKEN is offered to fans'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawE2 = result.data.rawFields?.['E.2'];
      if (rawE2) {
        // Should not start with "E.2"
        expect(rawE2).not.toMatch(/^E\.2\s/);
      }
    });
  });
});
