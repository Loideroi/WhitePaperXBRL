# Extraction Pipeline Research Findings

> Research date: 2026-02-10
> Test document: SPURS-Fan-Token-White-Paper.pdf (37 pages)
> Extraction result: 24 fields auto-extracted, 80% confidence, validation passed

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Pipeline Architecture](#2-current-pipeline-architecture)
3. [Issue 1: "No Field Content" Pollution](#3-issue-1-no-field-content-pollution)
4. [Issue 2: Wrong Content in Fields (Cross-Field Bleed)](#4-issue-2-wrong-content-in-fields)
5. [Issue 3: Field Boundary Detection Failures](#5-issue-3-field-boundary-detection-failures)
6. [Issue 4: Numeric Field Mis-extraction](#6-issue-4-numeric-field-mis-extraction)
7. [Issue 5: Country/Address Confusion](#7-issue-5-countryaddress-confusion)
8. [Issue 6: Date Formatting Artifacts](#8-issue-6-date-formatting-artifacts)
9. [Issue 7: Missing Value Trimming](#9-issue-7-missing-value-trimming)
10. [Issue 8: Silent Currency Defaults](#10-issue-8-silent-currency-defaults)
11. [Root Cause: PDF Table Extraction Model](#11-root-cause-pdf-table-extraction-model)
12. [Affected Code Paths](#12-affected-code-paths)
13. [Observed Failures in SPURS Whitepaper](#13-observed-failures-in-spurs-whitepaper)
14. [Proposed Fix Categories](#14-proposed-fix-categories)

---

## 1. Executive Summary

The extraction pipeline has **two fundamental weaknesses**:

1. **PDF table structure is lost during text extraction.** `pdf-parse` produces a flat text stream where the 3-column MiCA table (`No | Field | Content`) becomes indistinguishable from flowing text. The field mapper then uses regex heuristics to reconstruct boundaries, which fails when:
   - Empty cells contain placeholder text like "No Field Content"
   - Multi-line content spans across what `pdf-parse` renders as separate lines
   - Section headers from the next field bleed into the current field's value

2. **No post-extraction cleaning layer.** Extracted values go almost directly into iXBRL facts with minimal normalization. There is no "scrubbing" step that would detect and remove PDF artifacts, placeholder text, or obviously wrong values (like a year `2023` in a currency amount field).

These two issues combine to produce the 10+ data quality problems observed in the SPURS whitepaper output.

---

## 2. Current Pipeline Architecture

```
PDF Buffer
    │
    ▼
extractPdfText(buffer)                    [src/lib/pdf/extractor.ts]
    ├── pdf-parse(buffer)                 → raw text (all pages concatenated)
    ├── detectSections(text)              → Map<sectionName, sectionContent>
    ├── extractTableRows(sectionText)     → TableRow[] {number, field, content}
    ├── normalizeText(text)               → whitespace normalization
    └── extractLEI/Date/Number/Monetary   → specialized extractors
    │
    ▼
mapPdfToWhitepaper(extraction)            [src/lib/pdf/field-mapper.ts]
    ├── Pass 1: Table-based extraction    → MICA_SECTION_MAPPINGS × extractTableContent()
    ├── Pass 2: Pattern-based fallback    → regex patterns against full text
    ├── Pass 3: Raw field extraction      → extractAllRawFields() for unmapped fields
    ├── Transform functions               → 30+ field-specific cleaners
    └── Confidence scoring                → high/medium/low per field
    │
    ▼
WhitepaperData                            [src/types/whitepaper.ts]
    │
    ▼
mapDataToFactValues(data)                 [src/lib/xbrl/generator/document-generator.ts]
    ├── getNestedValue() for typed fields
    ├── tryExtractNumericValue() for rawFields
    ├── Enumeration URI mapping
    └── FactValue Map<xbrlElement, {value, contextRef, unitRef?, ...}>
    │
    ▼
renderSection() + wrapInlineTag()         [template/section-renderer.ts, inline-tagger.ts]
    └── Final iXBRL output
```

### Key Functions in Field Mapper

| Function | Purpose | Lines |
|----------|---------|-------|
| `extractTableContent()` | Single-line field from table format | 820-866 |
| `extractMultiLineTableContent()` | Multi-line field from table format | 871-902 |
| `extractAllRawFields()` | Capture ALL numbered field content | 936-1025 |
| `smartJoinLines()` | Fix PDF line-wrapping artifacts | 1132-1171 |
| `cleanFieldContent()` | Normalize extracted content | 1176-1191 |
| `removeFieldLabelFromContent()` | Strip field label from value | 1097-1118 |
| `populateNotApplicableSections()` | Fill "N/A" for inapplicable parts | 1228-1266 |

---

## 3. Issue 1: "No Field Content" Pollution

### Problem
Many extracted fields have `"No Field Content"` appended to the end of real content, or contain only this text when they should be empty.

### Root Cause
The SPURS whitepaper PDF uses a 3-column MiCA table format:

| No | Field | Content |
|----|-------|---------|
| A.1 | Legal Name | Socios Technologies AG |
| A.2 | Legal Form | *(empty — PDF cell contains "No Field Content")* |

When `pdf-parse` extracts this, it produces a flat text stream:
```
A.1 Legal Name Socios Technologies AG
A.2 Legal Form No Field Content
A.3 Address Gubelstrasse 11, 6300 Zug, Switzerland
```

The field boundary regex in `extractAllRawFields()`:
```typescript
const fieldPattern = /(?:^|\n)\s*([A-JS]\.?\d+(?:-[A-JS]?\d+)?|\d{1,2})\s+/g;
```

Captures everything from after `A.1` to before `A.2`. For fields with real content, this includes:
```
"Legal Name Socios Technologies AG\nA.2 Legal Form No Field Content"
```

After the `removeFieldLabelFromContent()` step removes "Legal Name", the value becomes:
```
"Socios Technologies AG\n...No Field Content"
```

For multi-line fields, the content from the NEXT row's "No Field Content" placeholder bleeds in at the end.

### Current Filter (Insufficient)
```typescript
// extractTableContent() line 837
if (content.length > 1 && !/^(Field|Content|No)$/i.test(content)) {
  return content;
}
```
This only rejects **single-word** matches. `"No Field Content"` (3 words) passes through.

### Observed in SPURS Output
- fact_1 (`DateOfNotificationForOtherTokenWhitePaper`): ends with `"No Field Content launch."`
- fact_6 (`StatementAboutCompensationAndGuarantee`): ends with `"Summary\n\nNo Field Content"`
- fact_8 (`DescriptionOfCharacteristics`): ends with `"No Field Content entity associated with the Issuer."`
- fact_10 (`OfferDescription`): ends with `"Part A:\n...No Field Content"`
- fact_25 (`OfferorsBusinessActivity`): contains `"No Field Content addition, the Platform..."`
- Part H DLT Description: begins with wrong text entirely

---

## 4. Issue 2: Wrong Content in Fields

### Problem
Some fields contain content from entirely different sections of the PDF.

### Observed Cases

**DLT Description (H.1)** — Expected: description of blockchain/DLT technology. Got: "Markets Served" paragraph about target demographics.

**Root Cause:** The pattern-based fallback (Pass 2) uses:
```typescript
patterns: [/Distributed\s*ledger\s*technol/i]
```
This matches the first occurrence of "Distributed ledger technol" in the text, which may be in a different section than H.1. The multi-line extraction then captures from that match point to the next section marker, picking up adjacent paragraphs.

**Smart Contract Information** — Content starts with "and technical standards Chiliz Chain Protocols..." (missing beginning of sentence). This is because the pattern match landed mid-paragraph and the extraction started from the match point.

### Root Cause
Pass 2 (pattern matching) searches the **full text** rather than the specific section. When the section detection in Pass 1 fails (no table row found for that field), the fallback regex can match text anywhere in the document.

---

## 5. Issue 3: Field Boundary Detection Failures

### Problem
The `extractAllRawFields()` function uses a single regex to find field numbers, then slices text between consecutive matches. This fails when:

1. **Field numbers appear in content** — e.g., "Article 6(5)" or "Regulation (EU) 2023/1114" contain numbers that could be misinterpreted
2. **Multi-row content** — Long text blocks that span multiple "rows" in the PDF table get split at the wrong boundary
3. **Missing field numbers** — If a field number isn't on its own line, the boundary detection misses it

### Field Number Regex
```typescript
const fieldPattern = /(?:^|\n)\s*([A-JS]\.?\d+(?:-[A-JS]?\d+)?|\d{1,2})\s+/g;
```

This matches:
- `A.1`, `B.2`, `S.8` — letter + optional dot + digit(s)
- `01`, `10` — 1-2 digit numbers (summary fields)
- `B.2-B12` — field ranges

**False positive risk:** A line starting with a number 1-99 will be treated as a field boundary even if it's part of content (e.g., numbered list items within a field's value).

---

## 6. Issue 4: Numeric Field Mis-extraction

### Problem
Numeric fields sometimes contain wrong values extracted from nearby text.

### Observed Cases

**Subscription Fee (E.10)** — Tagged as `2023` (a year from "2023-10-04") instead of a fee amount. The PDF text near E.10 contains:
```
Subscription fees (if any): Not applicable.
...
Subscription period: 2023-10-04 at 11:00 CET
```

The `tryExtractNumericValue()` function:
```typescript
function tryExtractNumericValue(text: string, dataType: XBRLDataType): string {
  const cleaned = text.replace(/[,$€£%]/g, '').trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);  // Takes FIRST number
  if (match && match[1] && isFinite(Number(match[1]))) {
    return match[1];
  }
  return text;  // Returns original text if no number found
}
```

Issues:
1. **Takes the first number found** — ignores context. "2023-10-04" → extracts `2023`
2. **Returns original text on failure** — a non-numeric string becomes the fact value, generating invalid `ix:nonNumeric` fallback
3. **No validation against field semantics** — doesn't check if extracted number is plausible for the field type

**Renewable Energy % (S.10)** — Tagged as `8` with no context. Actual PDF likely says "8%" but the percent sign is stripped during extraction. The value `8` with `decimals="4"` in the iXBRL suggests 8.0000 (not 0.08 as a decimal), which may be correct or may need `scale="-2"` per ESMA rules.

---

## 7. Issue 5: Country/Address Confusion

### Problem
Country fields contain full addresses, and the registered country doesn't match the address.

### Observed Cases

| Field | Expected | Got |
|-------|----------|-----|
| A.3c Registered Country | CH (Switzerland, based on address) | MT (Malta) — enum in ix:hidden |
| A.3s Country Subdivision | Zug (canton) | "Gubelstrasse 11, 6300 Zug, Switzerland" (full address) |
| A.4c Head Office Country | CH or country code | "Gubelstrasse 11, 6300 Zug, Switzerland" (full address) |

### Root Cause

**Country code extraction** (`extractCountryCode()`) has a lookup table:
```typescript
const COUNTRY_MAP: Record<string, string> = {
  'switzerland': 'CH', 'malta': 'MT', 'germany': 'DE', ...
};
```

For the registered country (A.3c), the extraction found "Malta" somewhere in the text (the parent company is registered in Malta) and mapped it to `MT`. But the actual registered address is in Zug, Switzerland.

**Address vs. country confusion:** The field mapper doesn't distinguish between:
- The full address field (A.3) — should contain the address
- The country field (A.3c) — should contain only the country code
- The subdivision field (A.3s) — should contain only the region/canton

The `extractTableContent()` function captures the same content for all three because they're in the same section of text, and the specific sub-field separation (A.3 vs A.3c vs A.3s) isn't properly handled.

---

## 8. Issue 6: Date Formatting Artifacts

### Problem
Dates have trailing characters or wrong formats.

### Observed Cases

| Field | Expected | Got |
|-------|----------|-----|
| A.5 Registration Date | 2021-01-21 | "2021-01-21." (trailing period) |
| E.21 Subscription Start | 2023-10-04 | "04/10/2023" (DD/MM/YYYY displayed) |

### Root Cause

**Trailing period:** The `extractDateValue()` transform doesn't strip trailing punctuation after extracting the ISO date. The PDF text likely says "2021-01-21." (with a period ending the sentence).

**Date format inconsistency:** The extractor returns ISO format internally but the UI displays the raw extracted text. The E.21/E.22 dates were extracted via pattern matching and stored as "04/10/2023" / "06/10/2023" (DD/MM/YYYY from the PDF) rather than being normalized to ISO format.

---

## 9. Issue 7: Missing Value Trimming

### Problem
Values are not consistently trimmed before being stored or tagged.

### Code Path Analysis

| Layer | Trims? | Location |
|-------|--------|----------|
| `extractTableContent()` | Yes (`.trim()` on return) | field-mapper.ts:862 |
| `extractAllRawFields()` | Yes (`.trim()` on content) | field-mapper.ts:1001 |
| `mapDataToFactValues()` — typed fields | **NO** | document-generator.ts:304 |
| `mapDataToFactValues()` — rawFields | Yes (`.trim()` on content) | document-generator.ts:344 |
| `wrapInlineTag()` | **NO** (uses value as-is) | inline-tagger.ts:72 |

The gap is at `mapDataToFactValues()` for typed fields — values from `WhitepaperData` are converted to strings via `String(value)` without trimming.

---

## 10. Issue 8: Silent Currency Defaults

### Problem
If no currency is detected, the system silently defaults to USD.

### Code
```typescript
// document-generator.ts
const currency = (getNestedValue(dataObj, 'partE.tokenPriceCurrency') as string) || 'USD';
```

### Impact
The SPURS whitepaper uses USD for the issue price (2 USD per token), but the `unit_EUR` context is also generated. The `OfficialCurrencyDeterminingIssuePrice` enum in `ix:hidden` shows `#USD`, which is correct for this document — but the silent default means a document without explicit currency would silently generate USD-denominated facts.

---

## 11. Root Cause: PDF Table Extraction Model

### The Fundamental Problem

`pdf-parse` was designed for extracting flowing text from PDFs, not structured table data. MiCA whitepapers are heavily table-based documents. The mismatch means:

1. **Column separation is lost.** The 3-column table becomes a single line of text where columns are separated only by whitespace (sometimes just 2+ spaces, sometimes inconsistent).

2. **Row boundaries are ambiguous.** Multi-line cell content (common for text blocks) gets interleaved with other cells when the PDF renderer lays them out.

3. **Empty cells are invisible or contain placeholders.** An empty cell might produce no text at all (losing the field entirely) or produce placeholder text like "No Field Content" that gets mixed with adjacent content.

### The `extractTableRows()` Patterns

Three patterns are tried, in order:

```typescript
// Pattern 1: Spaced format
/^([A-Z]?\d+(?:\.\d+)?)\s{2,}([^\t\n]+?)\s{2,}(.+)$/gm

// Pattern 2: Pipe format
/^([A-Z]?\d+(?:\.\d+)?)\s*\|\s*([^|]+)\s*\|\s*(.+)$/gm

// Pattern 3: Numbered colon format
/^(\d+)\.\s*([^:]+):\s*(.+)$/gm
```

**Pattern 1** requires 2+ spaces between columns. This works when `pdf-parse` preserves column spacing, but fails when it collapses spaces.

**Pattern 2** requires pipe characters, which MiCA whitepapers don't typically use.

**Pattern 3** matches numbered lists, not table rows.

In practice, most field extraction falls back to `extractAllRawFields()` which does simpler line-by-line parsing.

---

## 12. Affected Code Paths

| File | Function | Issue |
|------|----------|-------|
| `src/lib/pdf/field-mapper.ts` | `extractTableContent()` | **FIXED** — "No Field Content" stripped via `stripPlaceholderText()` |
| `src/lib/pdf/field-mapper.ts` | `extractAllRawFields()` | **IMPROVED** — field number echo stripping, label removal, section header bleed stripping |
| `src/lib/pdf/field-mapper.ts` | `extractMultiLineTableContent()` | **IMPROVED** — `cleanTextContent()` now strips section header bleed |
| `src/lib/pdf/field-mapper.ts` | `cleanFieldContent()` | **FIXED** — strips placeholders, repairs ligatures, strips section headers |
| `src/lib/pdf/field-mapper.ts` | `cleanTextContent()` | **FIXED** — repairs ligatures, strips section header bleed |
| `src/lib/pdf/field-mapper.ts` | `repairLigatures()` | **NEW** — fixes ff/fi/fl ligature splitting from pdf-parse |
| `src/lib/pdf/field-mapper.ts` | `smartJoinLines()` | Improved — works with repairLigatures for cleaner output |
| `src/lib/pdf/field-mapper.ts` | `removeFieldLabelFromContent()` | Uses `OTHR_FIELD_DEFINITIONS` to strip labels |
| `src/lib/pdf/extractor.ts` | `extractTableRows()` L varies | Table patterns don't match most MiCA PDFs |
| `src/lib/xbrl/generator/document-generator.ts` | `tryExtractNumericValue()` L92 | Takes first number; returns text on failure |
| `src/lib/xbrl/generator/document-generator.ts` | `mapDataToFactValues()` L304 | No trimming on typed field values |

---

## 13. Observed Failures in SPURS Whitepaper

### Summary of All Extraction Errors

| # | Field | XBRL Element | Problem | Category |
|---|-------|-------------|---------|----------|
| 1 | Summary row 01 | `DateOfNotificationForOtherTokenWhitePaper` | Contains custodial services text, not a date | Wrong content |
| 2 | Summary rows 06, 08, 10 | Various | End with "No Field Content" | Placeholder bleed |
| 3 | A.3c Registered Country | `OfferorsRegisteredCountry` | Malta instead of Switzerland | Wrong country |
| 4 | A.3s Subdivision | `OfferorsRegisteredCountrySubdivision` | Contains full address instead of region | Address confusion |
| 5 | A.4c Head Office Country | `OfferorsHeadOfficeCountry` | Contains full address instead of country | Address confusion |
| 6 | A.5 Registration Date | `OfferorsRegistrationDate` | Trailing period: "2021-01-21." | Date artifact |
| 7 | A.13 Business Activity | `OfferorsBusinessActivityExplanatory` | "No Field Content addition, the Platform..." mid-text | Placeholder bleed |
| 8 | E.10 Subscription Fee | `SubscriptionFeeExpressedInCurrency` | Value is `2023` (a year, not a fee) | Numeric mis-extraction |
| 9 | H.1 DLT Description | `DLTDescription` | Contains "Markets Served" paragraph | Wrong content |
| 10 | H.2 Smart Contract Info | Smart contract field | Starts mid-sentence: "and technical standards..." | Boundary error |
| 11 | S.10 Renewable Energy % | `RenewableEnergyConsumptionPercentage` | Raw `8` — unclear if 8% or wrong | Numeric ambiguity |
| 12 | Multiple fields | Various | "No Field Content" at end of real content | Placeholder bleed |

---

## 14. Proposed Fix Categories

### Category A: "No Field Content" Cleanup — **DONE**

**Goal:** Strip the literal text "No Field Content" from all extracted values.

**Status:** Implemented in previous session. `stripPlaceholderText()` handles standalone, end-of-text, mid-text, and separate-line occurrences. Called as the first step in `cleanFieldContent()` and in extraction functions.

**Additionally implemented (Feb 2026):**
- `repairLigatures()` — fixes PDF ligature splitting where `pdf-parse` renders ff/fi/fl ligatures as separate characters with a space (e.g., `"o ffering"` → `"offering"`, `"bene fits"` → `"benefits"`, `"speci fic"` → `"specific"`). Applied in both `cleanTextContent()` and `cleanFieldContent()`.
- Section header bleed stripping — removes MiCA section headers (e.g., `"\nPart D:\nInformation about..."`) that bleed into the end of adjacent field content. Applied in both `cleanTextContent()` and `cleanFieldContent()`.

### Category B: Improved Field Boundary Detection — **PARTIALLY DONE**

**Goal:** Better separation of field number, label, and content columns.

**Status (Feb 2026):**
1. `removeFieldLabelFromContent()` strips known field labels using `OTHR_FIELD_DEFINITIONS` — **DONE** (previous session)
2. `extractFieldsByLabelPattern()` performs second-pass label matching for unextracted fields — **DONE** (previous session)
3. Field number echo stripping: `content.replace(/^[A-J]\.\d+[a-z]?\s+/, '')` removes duplicate field number prefix from content — **DONE**
4. Section header bleed stripping in `cleanFieldContent()` and `cleanTextContent()` stops content at `"Part X:\nTitle"` patterns — **DONE**

**Remaining:**
- Content boundary could still be improved for edge cases where numbered list items within a field's value are misinterpreted as field boundaries

### Category C: Numeric Extraction Hardening (HIGH PRIORITY)

**Goal:** Prevent obviously wrong numeric values like "2023" in a fee field.

**Approach:**
1. In `tryExtractNumericValue()`, don't just take the first number — validate context:
   - If the field is a monetary amount, look for currency-adjacent numbers
   - If "Not applicable" or similar text is present, return empty/undefined
2. Add field-specific value range checks (e.g., subscription fee shouldn't be a 4-digit year)
3. Return `undefined` instead of original text when no valid number is found — better to have an empty field than a wrong value

### Category D: Country/Address Field Separation (MEDIUM PRIORITY)

**Goal:** Extract country codes from addresses correctly.

**Approach:**
1. For country fields (A.3c, A.4c, B.4c, C.3c), extract country from the END of the address string
2. Parse address to find country name at the end (after last comma)
3. Cross-validate: if registered address says "Switzerland" but country field says "Malta", flag as low confidence
4. For subdivision fields (A.3s), extract the city/region portion only (between last two commas typically)

### Category E: Date Normalization (LOW PRIORITY)

**Goal:** Clean date values consistently.

**Approach:**
1. Strip trailing punctuation (`.`, `,`, `;`) from extracted dates
2. Normalize all dates to ISO format (`yyyy-mm-dd`) regardless of source format
3. Validate extracted dates are reasonable (not in the future for historical fields, not before 2000)

### Category F: Value Trimming (LOW PRIORITY)

**Goal:** Ensure all values are trimmed before iXBRL tagging.

**Approach:**
1. Add `.trim()` to `mapDataToFactValues()` for typed fields at line ~304
2. Add `.trim()` inside `wrapInlineTag()` as a safety net

### Category G: Pattern Match Scoping (MEDIUM PRIORITY)

**Goal:** Prevent Pass 2 pattern matching from grabbing content from wrong sections.

**Approach:**
1. When using pattern-based fallback, restrict search to the relevant section text (from `detectSections()`) rather than the full document text
2. If section text is available for that part (e.g., Part H section detected), only search within it
3. Fall back to full text only if no section was detected

---

## Appendix: Key Constants

### MICA_SECTION_MAPPINGS Count
- 35 mapping entries covering Parts A through J plus sustainability indicators

### Transform Functions (30+)
`repairLigatures`, `cleanLegalName`, `cleanCryptoAssetName`, `cleanTickerSymbol`, `cleanTextContent`, `cleanFieldContent`, `stripPlaceholderText`, `extractLEIValue`, `extractCountryCode`, `extractCountryFromAddress`, `extractSubdivisionFromAddress`, `extractUrl`, `extractEmail`, `extractDateValue`, `extractTokenPrice`, `extractCurrency`, `extractMaxSubscriptionGoal`, `extractTotalSupply`, `extractTokenStandard`, `extractBlockchainNetwork`, `extractConsensusMechanism`, `extractConsensusMechanismFromDLT`, `extractEnergyConsumption`, `extractRenewableEnergy`, and more.

### Known Placeholder Patterns in MiCA PDFs
- `"No Field Content"` (most common)
- `"Not applicable"` / `"N/A"` (intentional — should be preserved)
- Empty table cells (produce no text in extraction)
- Column headers: `"No"`, `"Field"`, `"Content"` (single-word, already partially filtered)
