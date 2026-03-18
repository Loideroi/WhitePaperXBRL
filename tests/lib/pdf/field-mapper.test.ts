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

    it('should strip field label when it exactly matches the definition', () => {
      // S.3 label is "Name of crypto-asset" — content starts with label text
      const extraction = createExtractionResult([
        ['partS', 'S.3    Name of crypto-asset$SPURS'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawS3 = result.data.rawFields?.['S.3'];
      expect(rawS3).toBeDefined();
      if (rawS3) {
        expect(rawS3).not.toContain('Name of crypto-asset');
        expect(rawS3).toContain('$SPURS');
      }
    });

    it('should strip field label with newlines inside the label text', () => {
      // A.7 label is "Another identifier required pursuant to applicable national law"
      // pdf-parse may break it across lines
      const extraction = createExtractionResult([
        ['partA', 'A.7    Another identifier required\npursuant to applicable national lawBusiness ID: CHE-219.335.797'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawA7 = result.data.rawFields?.['A.7'];
      expect(rawA7).toBeDefined();
      if (rawA7) {
        expect(rawA7).not.toContain('Another identifier');
        expect(rawA7).toContain('CHE-219.335.797');
      }
    });

    it('should strip field label with extra spaces from PDF extraction', () => {
      // F.12 label is "Language or languages of white paper"
      // pdf-parse may insert extra spaces
      const extraction = createExtractionResult([
        ['partF', 'F.12    Language  or  languages  of  white  paperEnglish'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawF12 = result.data.rawFields?.['F.12'];
      expect(rawF12).toBeDefined();
      if (rawF12) {
        expect(rawF12).not.toContain('Language');
        expect(rawF12).toContain('English');
      }
    });

    it('should not alter content when label is not present', () => {
      const extraction = createExtractionResult([
        ['partS', 'S.3    $SPURS'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawS3 = result.data.rawFields?.['S.3'];
      expect(rawS3).toBeDefined();
      if (rawS3) {
        expect(rawS3).toContain('$SPURS');
      }
    });

    it('should strip label using "crypto-asset" variant of "other token" label', () => {
      // E.30 OTHR label is "Other token service provider (CASP) name"
      // but PDF says "Crypto-asset service provider (CASP) name"
      const extraction = createExtractionResult([
        ['partE', 'E.30    Crypto-asset service provider (CASP) name Socios Europe Services Limited'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawE30 = result.data.rawFields?.['E.30'];
      expect(rawE30).toBeDefined();
      if (rawE30) {
        expect(rawE30).not.toMatch(/service provider/i);
        expect(rawE30).toContain('Socios Europe Services Limited');
      }
    });

    it('should strip label with "of the" variant', () => {
      // S.3 OTHR label is "Name of crypto-asset"
      // but PDF says "Name of the crypto-asset"
      const extraction = createExtractionResult([
        ['partS', 'S.3    Name of the crypto-asset$PERSIJA'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawS3 = result.data.rawFields?.['S.3'];
      expect(rawS3).toBeDefined();
      if (rawS3) {
        expect(rawS3).not.toContain('Name of');
        expect(rawS3).toContain('$PERSIJA');
      }
    });

    it('should strip label with "offered/traded" variant of "offered or traded"', () => {
      // E.12 OTHR label is "Total number of offered or traded other tokens"
      // but PDF says "Total number of offered/traded crypto-assets"
      const extraction = createExtractionResult([
        ['partE', 'E.12    Total number of offered/traded crypto-assets50,000'],
      ]);

      const result = mapPdfToWhitepaper(extraction);

      const rawE12 = result.data.rawFields?.['E.12'];
      expect(rawE12).toBeDefined();
      if (rawE12) {
        expect(rawE12).not.toMatch(/Total number/i);
        expect(rawE12).toContain('50,000');
      }
    });
  });

  describe('Section header bleed — broad pattern matching', () => {
    it('should strip headers with hyphens and complex titles (Part F, Part G)', () => {
      // E.40 content ending with "Part F: Information about the crypto-assets"
      const extraction = createExtractionResult([
        ['partE', 'E.39    Applicable law    Laws of Switzerland.\nE.40    Competent court    Swiss Rules of Arbitration.\nPart F: Information about the crypto-assets'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      const rawE40 = result.data.rawFields?.['E.40'];
      expect(rawE40).toBeDefined();
      expect(rawE40).not.toContain('Part F');
      expect(rawE40).toContain('Swiss Rules');
    });

    it('should strip headers with long titles containing hyphens', () => {
      // F.19 content ending with "Part G: Information on the rights and obligations attached to the crypto-assets"
      const extraction = createExtractionResult([
        ['partF', 'F.19    Host member states    Austria, Belgium, Sweden.\nPart G: Information on the rights and obligations attached to the crypto-assets'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      const rawF19 = result.data.rawFields?.['F.19'];
      expect(rawF19).toBeDefined();
      expect(rawF19).not.toContain('Part G');
      expect(rawF19).toContain('Austria');
    });

    it('should strip sub-section markers like J.2.', () => {
      // S.9 content ending with "J.2. Supplementary information..."
      const extraction = createExtractionResult([
        ['partS', 'S.9    Description of energy sources    Bottom-up approach methodology.\nJ.2. Supplementary information on principal adverse impacts'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      const rawS9 = result.data.rawFields?.['S.9'];
      expect(rawS9).toBeDefined();
      expect(rawS9).not.toContain('J.2');
      expect(rawS9).toContain('Bottom-up');
    });
  });

  describe('Part B non-applicability detection', () => {
    it('should detect "Non-applicability of Part B" phrasing', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.1    Name    Example Corp\nA.6    LEI    529900T8BM49AURSDO55'],
        ['partB', 'B.1\nIssuer different from offeror\nNon-applicability of Part B. Example Corp is the Issuer and the Offeror.'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      // partB should be marked as not applicable
      expect((result.data.partB as Record<string, unknown>)?.notApplicable).toBe(true);
    });
  });

  describe('Boolean indicator field cleanup', () => {
    it('should extract boolean from F.15 with label bleed', () => {
      const extraction = createExtractionResult([
        ['partF', 'F.15    Voluntary data flag    Voluntary dataflag False - mandatory\nF.16    Personal data flag    Personal dataflag False - no'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      expect(result.data.rawFields?.['F.15']).toBe('False');
      expect(result.data.rawFields?.['F.16']).toBe('False');
    });

    it('should extract boolean from fields with label prefix', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.15    Newly established    False'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      expect(result.data.rawFields?.['A.15']).toBe('False');
    });
  });

  describe('Part D field number remapping', () => {
    it('should remap whitepaper D.9 (Resource allocation) to taxonomy D.14', () => {
      const extraction = createExtractionResult([
        ['partD', 'D.9    Resource allocation    The resources allocated to the project primarily consist of non-financial contributions.'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      expect(result.data.rawFields?.['D.14']).toContain('resources allocated');
    });

    it('should remap whitepaper D.10 (Planned use of funds) to taxonomy D.13', () => {
      const extraction = createExtractionResult([
        ['partD', 'D.10    Planned use of Collected funds or crypto-Assets    Part of the proceeds will be distributed to the Team.'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      expect(result.data.rawFields?.['D.13']).toContain('proceeds');
    });
  });

  describe('A.16b duplication prevention', () => {
    it('should not duplicate A.16a financial condition into A.16b governance', () => {
      const extraction = createExtractionResult([
        ['partA', 'A.16    Financial condition for the past three years    Revenue grew 70% year over year.'],
      ]);
      const result = mapPdfToWhitepaper(extraction);
      expect(result.data.rawFields?.['A.16a']).toContain('Revenue grew');
      // A.16b should be empty (not duplicated from A.16)
      expect(result.data.rawFields?.['A.16b']).toBe('');
    });
  });
});
