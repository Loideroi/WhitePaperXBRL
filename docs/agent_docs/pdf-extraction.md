# Document Extraction Guide - WhitePaper XBRL

## Overview

This document describes the document extraction strategy for converting whitepaper documents into structured data that can be transformed into iXBRL format. The system supports multiple document formats and uses a three-pass field mapping approach optimized for the ESMA MiCA whitepaper table structure.

---

## Supported Formats

The extraction pipeline supports four document formats via two libraries:

| Format | Library | MIME Type |
|--------|---------|-----------|
| PDF (.pdf) | `pdf-parse` | `application/pdf` |
| DOCX (.docx) | `officeparser` (toText()) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| ODT (.odt) | `officeparser` (toText()) | `application/vnd.oasis.opendocument.text` |
| RTF (.rtf) | `officeparser` (toText()) | `application/rtf`, `text/rtf` |

### Format Detection

Format detection uses a two-step strategy:

1. **MIME type lookup** -- `MIME_TO_FORMAT` mapping (primary)
2. **Filename extension fallback** -- `EXTENSION_TO_FORMAT` mapping (secondary)

### Magic Byte Validation

The system validates file integrity using magic bytes at the start of file buffers:

| Format | Magic Bytes | Hex |
|--------|-------------|-----|
| PDF | `%PDF` | `0x25504446` |
| DOCX / ODT (ZIP-based) | `PK..` | `0x504B0304` |
| RTF | `{\rtf` | `0x7B5C727466` |

---

## Extraction Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload     │───>│   Extract   │───>│   Map        │───>│  Validate   │
│   Document   │    │   Text      │    │   Fields     │    │  Data       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Step 1: Unified Document Extraction

The entry point is `extractDocument()` in `src/lib/document/extractor.ts`. It dispatches based on detected format:

- **PDF**: Delegates to `extractPdfText()` in `src/lib/pdf/extractor.ts`, which uses `pdf-parse` to extract text, page count, metadata, and detected sections.
- **DOCX / ODT / RTF**: Uses `officeparser`'s `parseOffice()` function, then calls `toText()` on the result for proper text extraction. Falls back to manually walking content nodes if `toText()` is unavailable.

```typescript
export async function extractDocument(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<DocumentExtractionResult>
```

Returns a `DocumentExtractionResult` containing:
- `text` -- Full extracted text
- `format` -- Detected `SupportedFormat`
- `pages` -- Page count (PDF only)
- `metadata` -- Title, author, subject, creator, dates
- `sections` -- `Map<string, string>` of detected MiCA sections

### Step 2: PDF Section Detection

For PDF documents, `detectSections()` in `src/lib/pdf/extractor.ts` identifies MiCA whitepaper structure using regex patterns:

```typescript
const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /^summary$/im,
  disclaimer: /^(disclaimer|important\s*notice)/im,
  partA: /^part\s*a[:\s]|^a\.\s*information/im,
  partB: /^part\s*b[:\s]|^b\.\s*information/im,
  // ... through partJ
};
```

Detection works in two passes:
1. Find all section start positions by scanning lines
2. Extract content between consecutive section markers

### Step 3: Field Mapping (Three-Pass Strategy)

The field mapping engine in `src/lib/pdf/field-mapper.ts` (1487 lines) uses three passes to maximize extraction coverage.

---

## Three-Pass Field Mapping

### Pass 1: MiCA Table Format (Section Number + Field Name)

Scans the full document text for MiCA field numbers (e.g., `A.1`, `E.21`, `S.8`) paired with known field names. This is the highest-confidence extraction method.

The `extractAllRawFields()` function performs a comprehensive scan:

1. Builds a regex matching all MiCA field patterns: `[A-JS].digit`, ranges like `B.2-B12`, and simple numbers `01`-`10`
2. Finds all field markers and their positions in the document
3. Extracts content between consecutive field markers (content of field N ends where field N+1 begins)
4. Expands range fields (e.g., `B.2-B12` populates `B.2` through `B.12`)
5. Removes field labels from the start of content using `OTHR_FIELD_DEFINITIONS`
6. Applies `smartJoinLines()` and `cleanFieldContent()` for proper formatting

For typed fields, `mapPdfToWhitepaper()` iterates over `MICA_SECTION_MAPPINGS` and uses:
- `extractTableContent()` -- For single-line fields
- `extractMultiLineTableContent()` -- For fields with paragraph content

### Pass 2: Pattern-Based Fallback

For fields not found in Pass 1, the engine searches the full text using regex patterns defined in `MICA_SECTION_MAPPINGS` (60+ mapping rules). Each mapping rule specifies:

```typescript
interface MiCASectionMapping {
  sectionNumbers: string[];      // e.g., ['A.1']
  fieldNames: string[];          // e.g., ['Name', 'Legal Name', 'Company Name']
  patterns: RegExp[];            // Fallback regex patterns
  targetPath: string;            // e.g., 'partA.legalName'
  transform?: (value: string, fullText: string) => unknown;
  confidence: ConfidenceLevel;
  multiLine?: boolean;
}
```

When a pattern matches, the engine:
1. Extracts content after the match point
2. For single-line: captures until next numbered item or newline
3. For multi-line: captures until next section marker or 2000 character limit
4. Applies the confidence multiplier of 0.7 (see Confidence Scoring below)

### Pass 3: Label Matching from OTHR_FIELD_DEFINITIONS

The `extractFieldsByLabelPattern()` function iterates over all `OTHR_FIELD_DEFINITIONS` entries and attempts to match by field number + label combination for any fields not yet extracted. This populates the `rawFields` record that provides fallback content for iXBRL generation.

---

## Text Processing Algorithms

### smartJoinLines

PDF text extraction often introduces artificial line breaks from page layout. The `smartJoinLines()` function intelligently rejoins wrapped text:

1. Preserves intentional paragraph breaks (double newlines)
2. Normalizes whitespace around single newlines
3. Joins hyphenated words split across lines (e.g., `tech-\nnology` becomes `technology`)
4. Joins lines where a lowercase letter follows a break (mid-sentence continuation)
5. Joins lines where content ends without terminal punctuation and next line starts with a capital letter
6. Handles lines ending with common connectors (`the`, `a`, `of`, `in`, `to`, `for`, `and`, `or`, `with`, `by`, `as`, `is`, `are`, etc.)

### Not Applicable Section Detection

The `populateNotApplicableSections()` function detects patterns like "Part B does not apply" or "Issuer is the same as Offeror" and fills in all fields in the affected range with the explanation text. Currently handles:

- **Part B** (B.2 through B.13): Triggered by "Part B does not apply" or "Issuer is same as Offeror"
- **Part C** (C.2 through C.15): Triggered by "Part C does not apply" or "Non-applicability of Part C"

### Field Number Normalization

Field numbers are normalized to a standard format:
- Simple numbers `1`-`10` become zero-padded `01`-`10`
- Letters without dots (`S8`) become dotted (`S.8`)
- Ranges (`B.2-B12`) are parsed and expanded into individual field numbers

---

## Transform Functions

The field mapper applies specialized transform functions to extract structured values from raw text.

### Text Cleaning

| Function | Purpose |
|----------|---------|
| `cleanLegalName` | Removes "Name" prefix, normalizes whitespace |
| `cleanCryptoAssetName` | Strips "Crypto-asset name" prefix and "project" suffix |
| `cleanTickerSymbol` | Extracts `$SYMBOL` pattern or first uppercase token, removes `$` prefix |
| `cleanTextContent` | Joins broken lines, collapses whitespace |

### Value Extraction

| Function | Purpose | Example Input | Example Output |
|----------|---------|---------------|----------------|
| `extractTokenPrice` | Parses price from USD/EUR patterns | `"0.50 $USD"` | `0.50` |
| `extractCurrency` | Detects USD or EUR | `"0.50 $USD"` | `"USD"` |
| `extractTokenStandard` | Finds CAP-20, ERC-20, BEP-20 | `"CAP-20 Token Standard"` | `"CAP-20"` |
| `extractTotalSupply` | Parses numbers with million/billion | `"10 million"` | `10000000` |
| `extractMaxSubscriptionGoal` | Parses monetary amounts | `"25,000 USD"` | `25000` |
| `extractEnergyConsumption` | Extracts kWh values | `"86.68 kWh"` | `86.68` |
| `extractRenewableEnergy` | Extracts percentage or detects N/A | `"45.2%"` | `45.2` |
| `extractDateValue` | Parses dates to ISO format | `"December 17, 2025"` | `"2025-12-17"` |

### Entity Extraction

| Function | Purpose |
|----------|---------|
| `extractLEIValue` | Handles standard LEI (20 chars), Swiss UID (`CHE-XXX.XXX.XXX`), and "Not applicable" |
| `extractCountryCode` | Maps country names/cities to ISO 2-letter codes (25+ countries) |
| `extractUrl` | Extracts `https://` URLs or constructs from domain patterns |
| `extractEmail` | Extracts email addresses via standard regex |

### Domain-Specific Extraction

| Function | Purpose |
|----------|---------|
| `extractBlockchainNetwork` | Scans for known blockchains using pattern matching and `KNOWN_BLOCKCHAINS` list |
| `extractConsensusMechanism` | Matches against `KNOWN_CONSENSUS_MECHANISMS` pattern list |
| `extractConsensusMechanismFromDLT` | Specialized extraction from H.1 DLT description section |

### Known Blockchain Networks (25 entries)

The `KNOWN_BLOCKCHAINS` array includes: Chiliz Chain, Ethereum, Polygon, Binance Smart Chain, BSC, Solana, Avalanche, Arbitrum, Optimism, Base, Fantom, Cronos, Cardano, Tezos, Algorand, Hedera, NEAR, Aptos, Sui, TON, Tron, Flow, Cosmos, Polkadot, Kusama.

### Known Consensus Mechanisms (17 patterns)

The `KNOWN_CONSENSUS_MECHANISMS` array matches patterns for: Proof of Staked Authority (PoSA), Proof of Authority (PoA), Proof of Stake (PoS), Proof of Work (PoW), Delegated Proof of Stake (DPoS), Proof of History, Byzantine Fault Tolerance (BFT), Practical Byzantine Fault Tolerance (PBFT), and Tendermint BFT. Each mechanism has multiple pattern variants (full name, abbreviation, with/without parenthetical).

---

## Confidence Scoring

### Score Assignment

| Level | Numeric Value | Criteria |
|-------|---------------|----------|
| High | 0.9 | Section number + field name match (Pass 1) |
| Medium | 0.7 | Pattern-based extraction with reasonable match |
| Low | 0.5 | Generic fallback or uncertain extraction |

### Pattern Match Adjustment

When a field is extracted via Pass 2 (pattern-based), the confidence is multiplied by 0.7:
- High (0.9) becomes 0.63 -- remains reported as the original confidence level
- Medium (0.7) becomes 0.49 -- reported as `low` if below 0.6 threshold
- Low (0.5) becomes 0.35 -- reported as `low`

### Overall Confidence Calculation

```typescript
{
  overall: number;      // Weighted average of all field scores (0-100)
  bySection: Record<string, number>;  // Average per section (partA, partD, etc.)
  lowConfidenceFields: string[];      // Paths of fields with 'low' confidence
}
```

---

## Post-Processing

After field mapping, `mapPdfToWhitepaper()` applies additional logic:

1. **Public offering detection**: If `partE.isPublicOffering` was not extracted, scans the full text for "public offer" or "OTPC" keywords.
2. **Consensus mechanism reuse**: Copies `partD.consensusMechanism` to `partJ.consensusMechanismType` if the latter was not independently extracted.
3. **Default values**: Sets `language` to `"en"` and `documentDate` to the current date.
4. **Raw fields population**: Calls `extractAllRawFields()` to populate `rawFields` with all numbered field content for use by the iXBRL generator as fallback content.

---

## Testing Extraction

### Test Fixtures

Store sample documents in `tests/fixtures/pdfs/`:

```
tests/fixtures/pdfs/
├── persija-whitepaper.pdf       # Full example (PDF)
├── minimal-othr.pdf             # Minimal valid OTHR
├── minimal-art.pdf              # Minimal valid ART
├── minimal-emt.pdf              # Minimal valid EMT
├── multi-language.pdf           # Multi-language content
├── complex-tables.pdf           # Complex table layouts
└── edge-cases.pdf               # Edge cases
```

### Test Cases

```typescript
describe('PDF Extraction', () => {
  it('should extract all required fields from PERSIJA whitepaper', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/persija-whitepaper.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.partA.legalName).toBe('Socios Technologies AG');
    expect(result.data.partA.lei).toMatch(/^[A-Z0-9]{20}$/);
    expect(result.data.partD.cryptoAssetName).toBe('$PERSIJA');
    expect(result.data.partD.totalSupply).toBe(10000000);
    expect(result.confidence.overall).toBeGreaterThan(70);
  });

  it('should handle missing optional fields gracefully', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/minimal-othr.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.partA.legalName).toBeDefined();
    expect(result.data.partB).toBeUndefined();
    expect(result.confidence.lowConfidenceFields.length).toBeGreaterThan(0);
  });

  it('should extract management body members correctly', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/persija-whitepaper.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.managementBodyMembers?.offeror).toBeDefined();
    expect(result.data.managementBodyMembers?.offeror.length).toBeGreaterThan(0);
    expect(result.data.managementBodyMembers?.offeror[0].identity).toBeDefined();
    expect(result.data.managementBodyMembers?.offeror[0].function).toBeDefined();
  });
});
```

---

## Key File References

| Purpose | File |
|---------|------|
| Unified document extraction | `src/lib/document/extractor.ts` |
| PDF-specific extraction (pdf-parse) | `src/lib/pdf/extractor.ts` |
| Field mapping engine (three-pass) | `src/lib/pdf/field-mapper.ts` |
| OTHR field definitions | `src/lib/xbrl/generator/mica-template/field-definitions.ts` |
| Whitepaper data types | `src/types/whitepaper.ts` |
| Taxonomy types | `src/types/taxonomy.ts` |
