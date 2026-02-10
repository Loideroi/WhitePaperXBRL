# XBRL Taxonomy Reference - WhitePaper XBRL

## Overview

This document provides technical reference for the ESMA MiCA XBRL taxonomy used in the WhitePaper XBRL platform.

---

## Taxonomy Basics

### Taxonomy Design Principles

The MiCA taxonomy is a **closed/fixed taxonomy** -- no extensions are permitted. Reporting entities must use the taxonomy elements as-is without adding custom elements, dimensions, or link roles.

### Underlying Specifications

The taxonomy is built on the following XBRL and related specifications:

| Specification | Version | Purpose |
|---------------|---------|---------|
| XBRL | 2.1 | Core instance and taxonomy schema |
| Dimensions | 1.0 | Explicit and typed dimensional modelling |
| Extensible Enumerations | 2.0 | Single-value and set-value enumeration types |
| Formula | 1.0 | Validation assertions (existence, value) |
| Data Types Registry (DTR) | 1.1 | Extended data types (`energyItemType`, etc.) |
| Link Role Registry (LRR) | 2.0 | Standard link roles for presentation/calculation/definition |
| Taxonomy Packages | 1.0 | ZIP-based distribution and catalog resolution |
| Generic Link | 1.0 | Generic arcs for non-standard relationships |
| Generic Labels | 1.0 | Labels attached via generic links |
| Transformation Rules Registry | 5 | iXBRL value formatting transformations |

### Element Naming Convention

All element names follow the **L3C (Label CamelCase Concatenation)** format inherited from IFRS taxonomy conventions:

- Take the English standard label of the element
- Remove articles, prepositions, and punctuation
- CamelCase-concatenate the remaining words

Example: "Legal entity identifier of the offeror" becomes `LegalEntityIdentifierOfOfferor`.

All elements have `@nillable="true"` in the schema.

### Namespace and URIs

```
Root URI:   https://www.esma.europa.eu/taxonomy/2025-03-31/mica/
Namespace:  https://www.esma.europa.eu/taxonomy/2025-03-31/mica/
Prefix:     mica
Version:    2025-03-31
```

### Entry Points

| Entry Point | Token Type | File |
|-------------|------------|------|
| Table 2 | OTHR | `mica_entry_table_2.xsd` |
| Table 3 | ART | `mica_entry_table_3.xsd` |
| Table 4 | EMT | `mica_entry_table_4.xsd` |

**Note:** `mica_all.xsd` is for software developers only, not for reporting entities.

---

## Element Types

### 1. Reportable Elements (Non-Abstract)

Elements that can be tagged with data values.

```typescript
interface ReportableElement {
  name: string;           // Unique local name (L3C pattern)
  periodType: 'instant' | 'duration';
  dataType: XBRLDataType;
  nillable: true;         // Always true in this taxonomy
  abstract: false;
}
```

### 2. Abstract Elements

Used for hierarchical grouping only, cannot be tagged.

```typescript
interface AbstractElement {
  name: string;           // Ends with "Abstract"
  abstract: true;
  nillable: true;         // Always true in this taxonomy
}
```

### 3. Dimensional Constructs

| Construct | Naming Pattern | Purpose |
|-----------|----------------|---------|
| Hypercube | `*Table` | Table container |
| Dimension | `*Axis` | Axis for slicing |
| Member | `*Member` | Domain member value |

---

## Data Types

### Base XBRL Types

| Type | TypeScript Equivalent | Notes |
|------|----------------------|-------|
| `stringItemType` | `string` | Plain text, `@escape="false"` |
| `booleanItemType` | `boolean` | true/false |
| `dateItemType` | `string` (ISO date) | Format: yyyy-mm-dd |
| `monetaryItemType` | `number` | Requires unit reference |
| `decimalItemType` | `number` | Use `decimals` attribute |
| `integerItemType` | `number` | Whole numbers only |

### DTR 1.1 Types (Data Type Registry)

| Type | Purpose | Unit | Notes |
|------|---------|------|-------|
| `textBlockItemType` | Narrative sections | -- | `@escape="true"`, can contain HTML |
| `percentItemType` | Percentages | `xbrli:pure` | Store as decimal (81% = 0.81) |
| `energyItemType` | Energy consumption | `utr:kWh` | UTR namespace unit |
| `ghgEmissionsItemType` | GHG emissions | `utr:tCO2` | UTR namespace unit |
| `massItemType` | Mass/weight | `utr:t` | UTR namespace unit (tonnes) |
| `volumeItemType` | Volume | `utr:m3` | UTR namespace unit (cubic metres) |
| `domainItemType` | Abstract domain members | -- | Used for dimension domain heads |

### LEI Type

From the LEI taxonomy (separate from DTR):

| Type | Purpose | Notes |
|------|---------|-------|
| `leiItemType` | Legal Entity Identifier | 20 alphanumeric chars, ISO 17442, checksum-validated |

```typescript
// LEI format: 20 alphanumeric characters
// Scheme: http://standards.iso.org/iso/17442
// Example: 5493001KJTIIGC8Y1R12

const LEI_PATTERN = /^[A-Z0-9]{18}[0-9]{2}$/;
```

### Enumeration Types

| Type | Selection | Notes |
|------|-----------|-------|
| `enumerationItemType` | Single | Dropdown, one selection |
| `enumerationSetItemType` | Multiple | Multi-select allowed |

---

## Table Structure

### Table 2: OTHR Token Template

```
Table 2: General information
+-- Part A: Offeror information
+-- Part B: Issuer information (if different)
+-- Part C: Trading platform operator (if applicable)
+-- Part D: Project information
+-- Part E: Offering details
+-- Part F: Crypto-asset characteristics
+-- Part G: Rights and obligations
+-- Part H: Underlying technology
+-- Part I: Risk factors
+-- Part J: Sustainability indicators

Sub-tables:
+-- Table 2a: Offeror's management body members
+-- Table 2b: Issuer's management body members
+-- Table 2c: Operator's management body members
+-- Table 2d: Persons involved in project implementation
```

### Table 3: ART Token Template

Similar structure with ART-specific fields:
- Reserve asset information
- Stabilization mechanism
- Issuer authorization status

### Table 4: EMT Token Template

Similar structure with EMT-specific fields:
- Monetary value backing
- Redemption mechanisms
- Credit/E-money institution details

---

## Typed Dimensions

Used for repeating groups (e.g., management body members).

### Structure

```typescript
interface TypedDimensionEntry {
  lineIdentifier: number;  // 1, 2, 3, ...
  fields: Record<string, string>;
}

// Example: Management body member
interface ManagementBodyMember {
  lineIdentifier: number;
  identity: string;        // Full name
  businessAddress: string; // Address
  function: string;        // Role/title
}
```

### Implementation Pattern

```typescript
// Generate context for each line
function createTypedDimensionContext(
  entityLei: string,
  periodDate: string,
  tableName: string,
  lineNumber: number
): XBRLContext {
  return {
    id: `ctx_${tableName}_line${lineNumber}`,
    entity: {
      identifier: entityLei,
      scheme: 'http://standards.iso.org/iso/17442',
    },
    period: { instant: periodDate },
    scenario: {
      typedMember: {
        dimension: `mica:${tableName}LineIdentifierAxis`,
        value: lineNumber.toString(),
      },
    },
  };
}
```

---

## Enumeration Domains

### Home Member State

Domain: `mica:HomeMemberStateDomain`

Values: All 27 EU Member States + EEA countries
- AT (Austria), BE (Belgium), BG (Bulgaria), ...
- IS (Iceland), LI (Liechtenstein), NO (Norway)

### Token Type

Domain: `mica:CryptoAssetTypeDomain`

Values:
- `OTHR` - Other crypto-asset
- `ART` - Asset-Referenced Token
- `EMT` - E-Money Token

### Consensus Mechanism

Domain: `mica:ConsensusMechanismDomain`

Values:
- `POW` - Proof of Work
- `POS` - Proof of Stake
- `POA` - Proof of Authority
- `DPOS` - Delegated Proof of Stake
- `OTHER` - Other mechanism

### Linking Enumerations to Visible Text (CSS Hidden Binding)

Enumeration facts are typically placed in `ix:hidden` since they are machine-readable codes, not human-readable text. To link the visible document text to the hidden enumeration fact, use the CSS binding pattern:

```css
.-ix-hidden\:fact_id_123 {
  /* This class links visible text to the ix:hidden fact with id="fact_id_123" */
}
```

```html
<!-- Hidden fact -->
<ix:hidden>
  <ix:nonNumeric id="fact_id_123" name="mica:HomeMemberState"
    contextRef="ctx1">mica:ATMember</ix:nonNumeric>
</ix:hidden>

<!-- Visible text linked via CSS class -->
<span class="-ix-hidden:fact_id_123">Austria</span>
```

---

## Context Requirements

### Entity Identification

```xml
<xbrli:entity>
  <xbrli:identifier scheme="http://standards.iso.org/iso/17442">
    5493001KJTIIGC8Y1R12
  </xbrli:identifier>
</xbrli:entity>
```

### Period Format

**CRITICAL:** No time components allowed!

```typescript
// CORRECT
const period = '2025-12-31';

// WRONG
const period = '2025-12-31T00:00:00';
```

### Scenario vs Segment

**Use `xbrli:scenario` ONLY, never `xbrli:segment`**

```xml
<!-- CORRECT -->
<xbrli:scenario>
  <xbrldi:explicitMember dimension="mica:TokenTypeAxis">
    mica:OTHRMember
  </xbrldi:explicitMember>
</xbrli:scenario>

<!-- WRONG - Never use segment -->
<xbrli:segment>
  ...
</xbrli:segment>
```

---

## Unit References

### Standard Units

| Measure | Unit ID | XBRL Unit | Namespace |
|---------|---------|-----------|-----------|
| Monetary (EUR) | `u_EUR` | `iso4217:EUR` | ISO 4217 |
| Monetary (USD) | `u_USD` | `iso4217:USD` | ISO 4217 |
| Energy | `u_kWh` | `utr:kWh` | UTR |
| Emissions | `u_tCO2` | `utr:tCO2` | UTR |
| Mass | `u_tonnes` | `utr:t` | UTR |
| Volume | `u_m3` | `utr:m3` | UTR |
| Pure number | `u_pure` | `xbrli:pure` | XBRL core |

### Implementation

```xml
<xbrli:unit id="u_EUR">
  <xbrli:measure>iso4217:EUR</xbrli:measure>
</xbrli:unit>

<xbrli:unit id="u_kWh">
  <xbrli:measure>utr:kWh</xbrli:measure>
</xbrli:unit>

<xbrli:unit id="u_pure">
  <xbrli:measure>xbrli:pure</xbrli:measure>
</xbrli:unit>
```

---

## Inline XBRL (iXBRL) Reporting Patterns

### Block Tagging with Continuation and Exclusion

When a narrative text block spans multiple non-contiguous locations in the document, use `ix:continuation` to join them and `ix:exclude` to remove non-reportable content:

```html
<!-- First part of the narrative -->
<ix:nonFraction id="fact_risk_1" name="mica:RiskFactors" contextRef="ctx1"
  escape="true" continuedAt="fact_risk_1_cont1">
  <p>Risk factor description begins here...</p>
  <ix:exclude>
    <p>Page footer - not part of the tagged content</p>
  </ix:exclude>
</ix:nonFraction>

<!-- Continuation on another page -->
<ix:continuation id="fact_risk_1_cont1">
  <p>...continuation of risk factor description.</p>
</ix:continuation>
```

### Percentage Handling

Percentages must be reported in **decimal form** (0.81 for 81%). When displaying 81% in the document while reporting 0.81 to XBRL, use the `scale` attribute on `ix:nonFraction`:

```html
<!-- Displays "81" in document, reports 0.81 to XBRL (81 * 10^-2 = 0.81) -->
<ix:nonFraction name="mica:PercentageOfReserveAssets" contextRef="ctx1"
  unitRef="u_pure" decimals="4" scale="-2"
  format="ixt:num-dot-decimal">81</ix:nonFraction>%
```

### Decimals vs Precision

The `decimals` attribute is **required** on all numeric facts. The `precision` attribute must **NEVER** be used -- its presence triggers the validation violation `precisionAttributeUsed`.

```html
<!-- CORRECT -->
<ix:nonFraction name="mica:TotalAmount" contextRef="ctx1"
  unitRef="u_EUR" decimals="2">1000000.00</ix:nonFraction>

<!-- WRONG - precision is forbidden -->
<ix:nonFraction name="mica:TotalAmount" contextRef="ctx1"
  unitRef="u_EUR" precision="8">1000000.00</ix:nonFraction>
```

### Duplicate Fact Rules

| Fact Type | Consistency | Severity |
|-----------|-------------|----------|
| Numeric (same value) | Consistent | OK |
| Numeric (different value) | Inconsistent | **ERROR** |
| Non-numeric (same value) | Consistent | OK |
| Non-numeric (different value) | Inconsistent | **WARNING** |

### Transformation Rules Registry 5

Use TRR 5 format codes on `ix:nonFraction` and `ix:nonNumeric` elements for value formatting. Common transformations:

| Format | Example Input | Purpose |
|--------|---------------|---------|
| `ixt:num-dot-decimal` | `1,234,567.89` | Numeric with dot decimal separator |
| `ixt:num-comma-decimal` | `1.234.567,89` | Numeric with comma decimal separator |
| `ixt:date-day-monthname-year-en` | `31 December 2025` | Date formatting |
| `ixt:bool-true-false` | `true` / `false` | Boolean display |

---

## Labels and Languages

### Available Languages

All 24 EU official languages:
BG, CS, DA, DE, EL, EN, ES, ET, FI, FR, GA, HR, HU, IT, LT, LV, MT, NL, PL, PT, RO, SK, SL, SV

### Label Types

| Role | Purpose |
|------|---------|
| `label` | Standard human-readable label |
| `terseLabel` | Short form for tables |
| `documentation` | Extended description |

### Loading Labels

```typescript
// Labels are bundled in the taxonomy-bundle.json
// Access via the TaxonomyRegistry instance
const registry = getTaxonomyRegistry();
const element = registry.getElement('mica:OfferorLegalEntityIdentifier');
const label = element?.label;          // Standard label (English)
const docs = element?.documentation;   // Documentation label
const terse = element?.terseLabel;     // Terse label
```

---

## Extended Link Roles (ELRs)

### Pattern

```
https://www.esma.europa.eu/xbrl/role/mica-{component}
```

### Key ELRs

| ELR | Purpose |
|-----|---------|
| `mica-enum` | Enumeration domains |
| `mica-table2` | OTHR main template |
| `mica-table2a` | Offeror management body |
| `mica-table2b` | Issuer management body |
| `mica-table2c` | Operator management body |
| `mica-table2d` | Project persons |
| `mica-table3` | ART main template |
| `mica-table3a` - `3c` | ART sub-templates |
| `mica-table4` | EMT main template |
| `mica-table4a`, `4b` | EMT sub-templates |

---

## Validation Assertions

### Existence Assertions (257 total)

Check that required fields are present.

| Table | Count |
|-------|-------|
| Table 2 | 72 |
| Table 3 | 103 |
| Table 4 | 82 |

### Value Assertions (223 total)

Check field values and cross-field relationships.

| Table | Count |
|-------|-------|
| Table 2 | 139 |
| Table 3 | 62 |
| Table 4 | 22 |

### LEI Assertions (6 total)

From LEI taxonomy -- validate LEI format and checksum.

### Total: 486 Assertions

257 existence + 223 value + 6 LEI = 486

### Severity Levels

| Level | Action |
|-------|--------|
| ERROR | MUST fix before submission |
| WARNING | SHOULD fix, but allowed |

---

## Implementation Patterns

### Loading Taxonomy

The taxonomy is loaded from a pre-processed bundled JSON file, not parsed from raw XSD at runtime. The `TaxonomyRegistry` class provides all lookup methods.

```typescript
import { getTaxonomyRegistry } from '@/lib/xbrl/taxonomy';

// Get the singleton registry (lazy-loaded from bundled JSON)
const registry = getTaxonomyRegistry();

// Look up elements
const element = registry.getElement('mica:OfferorLegalEntityIdentifier');
const elements = registry.getElementsByTokenType('OTHR');
const partElements = registry.getElementsForTokenTypeAndPart('OTHR', 'Part A');
```

### Element Registry

The `TaxonomyRegistry` class loads from `src/lib/xbrl/taxonomy/data/taxonomy-bundle.json` and indexes elements by multiple keys for efficient lookup:

```typescript
export class TaxonomyRegistry {
  private elements: Map<string, TaxonomyElement>;
  private elementsByLocalName: Map<string, TaxonomyElement>;
  private elementsByPart: Map<WhitepaperPart, TaxonomyElement[]>;
  private elementsByTokenType: Map<TokenType, TaxonomyElement[]>;

  public readonly version: string;
  public readonly namespace: string;

  constructor(data: BundledData) { /* loads from bundled JSON */ }

  getElement(name: string): TaxonomyElement | undefined;
  getElementByLocalName(localName: string): TaxonomyElement | undefined;
  getElementsByPart(part: WhitepaperPart): TaxonomyElement[];
  getElementsByTokenType(tokenType: TokenType): TaxonomyElement[];
  getReportableElements(): TaxonomyElement[];
  getAllElements(): TaxonomyElement[];
  searchByLabel(query: string): TaxonomyElement[];
  getElementsByDataType(dataType: XBRLDataType): TaxonomyElement[];
  getElementsForTokenTypeAndPart(tokenType: TokenType, part: WhitepaperPart): TaxonomyElement[];
}

// Singleton access
import { getTaxonomyRegistry } from '@/lib/xbrl/taxonomy';
const registry = getTaxonomyRegistry();
```

### Generating Facts

```typescript
function generateFact(
  element: TaxonomyElement,
  value: unknown,
  contextRef: string,
  unitRef?: string
): XBRLFact {
  const fact: XBRLFact = {
    name: element.name,
    contextRef,
    value: formatValue(element.dataType, value),
  };

  if (unitRef) {
    fact.unitRef = unitRef;
  }

  if (isNumeric(element.dataType)) {
    fact.decimals = getDecimals(element.dataType);
  }

  return fact;
}
```

---

## File Locations

### Bundled Taxonomy Data (Used at Runtime)

```
src/lib/xbrl/taxonomy/
+-- data/
|   +-- taxonomy-bundle.json   # Pre-processed taxonomy data (elements, labels, metadata)
|   +-- index.ts               # Re-exports bundled data with type assertion
+-- registry.ts                # TaxonomyRegistry class (loads from bundled JSON)
+-- index.ts                   # Module exports
```

### Raw ESMA Taxonomy Files (Source of Truth)

The `/taxonomy` directory at project root is currently empty. The raw ESMA taxonomy distribution files are stored in the research documents directory:

```
ESME Research documents/mica_taxonomy_2025/
+-- META-INF/
|   +-- taxonomyPackage.xml
|   +-- catalog.xml
+-- www.esma.europa.eu/taxonomy/mica/2025-03-31/
    +-- mica_cor.xsd           # Core schema
    +-- mica_all.xsd           # Technical entry point
    +-- mica_entry_table_2.xsd # OTHR entry point
    +-- mica_entry_table_3.xsd # ART entry point
    +-- mica_entry_table_4.xsd # EMT entry point
    +-- mica_cor-lab-en.xml    # English labels
    +-- mica_cor-lab-mt.xml    # Maltese labels
    +-- ...                    # Other language labels
    +-- mica_cor-def.xml       # Definition linkbase
    +-- mica-pre-table2.xml    # Presentation linkbase
    +-- mica-for-table2.xml    # Formula linkbase
    +-- ...
```

These raw files are processed into `taxonomy-bundle.json` for runtime use.

### Reference Documents

```
ESME Research documents/
+-- mica_taxonomy_2025_documentation_v1.0.pdf
+-- mica_taxonomy_reporting_manual_v1.0.pdf
+-- mica_taxonomy_formulas_202507.xlsx
+-- SCWP_-_for_OTHR_token.xlsm
+-- SCWP_-_for_ART_token.xlsm
+-- SCWP_-_for_EMT_token.xlsm
+-- mica_taxonomy_2025/
```
