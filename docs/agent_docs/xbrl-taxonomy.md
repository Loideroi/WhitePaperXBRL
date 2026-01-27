# XBRL Taxonomy Reference - WhitePaper XBRL

## Overview

This document provides technical reference for the ESMA MiCA XBRL taxonomy used in the WhitePaper XBRL platform.

---

## Taxonomy Basics

### Namespace and URIs

```
Root URI: https://www.esma.europa.eu/taxonomy/2025-03-31/mica/
Namespace: https://www.esma.europa.eu/taxonomy/2025-03-31/mica/
Prefix: mica
Version: 2025-03-31
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
  abstract: false;
}
```

### 2. Abstract Elements

Used for hierarchical grouping only, cannot be tagged.

```typescript
interface AbstractElement {
  name: string;           // Ends with "Abstract"
  abstract: true;
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
| `decimalItemType` | `number` | Use 'decimals' attribute |
| `integerItemType` | `number` | Whole numbers only |

### DTR Types (Data Type Registry)

| Type | Purpose | Notes |
|------|---------|-------|
| `textBlockItemType` | Narrative sections | `@escape="true"`, can contain HTML |
| `percentItemType` | Percentages | Store as decimal (81% = 0.81) |
| `energyItemType` | Energy consumption | Unit: kWh |
| `ghgEmissionsItemType` | Emissions | Unit: tCO2 |
| `massItemType` | Mass/weight | Unit: tonnes |
| `volumeItemType` | Volume | Unit: m3 |

### Enumeration Types

| Type | Selection | Notes |
|------|-----------|-------|
| `enumerationItemType` | Single | Dropdown, one selection |
| `enumerationSetItemType` | Multiple | Multi-select allowed |

### LEI Type

```typescript
// LEI format: 20 alphanumeric characters
// Scheme: http://standards.iso.org/iso/17442
// Example: 5493001KJTIIGC8Y1R12

const LEI_PATTERN = /^[A-Z0-9]{18}[0-9]{2}$/;
```

---

## Table Structure

### Table 2: OTHR Token Template

```
Table 2: General information
├── Part A: Offeror information
├── Part B: Issuer information (if different)
├── Part C: Trading platform operator (if applicable)
├── Part D: Project information
├── Part E: Offering details
├── Part F: Crypto-asset characteristics
├── Part G: Rights and obligations
├── Part H: Underlying technology
├── Part I: Risk factors
└── Part J: Sustainability indicators

Sub-tables:
├── Table 2a: Offeror's management body members
├── Table 2b: Issuer's management body members
├── Table 2c: Operator's management body members
└── Table 2d: Persons involved in project implementation
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

| Measure | Unit ID | XBRL Unit |
|---------|---------|-----------|
| Monetary (EUR) | `u_EUR` | `iso4217:EUR` |
| Monetary (USD) | `u_USD` | `iso4217:USD` |
| Energy | `u_kWh` | `utr:kWh` |
| Emissions | `u_tCO2` | `utr:tCO2` |
| Mass | `u_tonnes` | `utr:t` |
| Volume | `u_m3` | `utr:m3` |
| Pure number | `u_pure` | `xbrli:pure` |

### Implementation

```xml
<xbrli:unit id="u_EUR">
  <xbrli:measure>iso4217:EUR</xbrli:measure>
</xbrli:unit>

<xbrli:unit id="u_pure">
  <xbrli:measure>xbrli:pure</xbrli:measure>
</xbrli:unit>
```

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
// Load English labels by default
const labels = await loadLabels('en');

// Label lookup
function getLabel(elementName: string, lang = 'en'): string {
  return labels[lang]?.[elementName] ?? elementName;
}
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

From LEI taxonomy - validate LEI format and checksum.

### Severity Levels

| Level | Action |
|-------|--------|
| ERROR | MUST fix before submission |
| WARNING | SHOULD fix, but allowed |

---

## Implementation Patterns

### Loading Taxonomy

```typescript
import { parseStringPromise } from 'xml2js';

async function loadTaxonomy(entryPoint: 'table2' | 'table3' | 'table4') {
  const schemaPath = `taxonomy/mica_entry_${entryPoint}.xsd`;
  const schema = await fs.readFile(schemaPath, 'utf-8');
  const parsed = await parseStringPromise(schema);

  // Extract elements, labels, etc.
  return buildTaxonomyRegistry(parsed);
}
```

### Element Registry

```typescript
interface TaxonomyRegistry {
  elements: Map<string, TaxonomyElement>;
  enumerations: Map<string, EnumerationDomain>;
  labels: Map<string, Map<string, string>>; // lang -> name -> label

  getElement(name: string): TaxonomyElement | undefined;
  getEnumOptions(domain: string): string[];
  getLabel(name: string, lang?: string): string;
}
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

### Taxonomy Package

```
taxonomy/
├── META-INF/
│   ├── taxonomyPackage.xml
│   └── catalog.xml
└── www.esma.europa.eu/taxonomy/mica/2025-03-31/
    ├── mica_cor.xsd           # Core schema
    ├── mica_all.xsd           # Technical entry point
    ├── mica_entry_table_2.xsd # OTHR entry point
    ├── mica_entry_table_3.xsd # ART entry point
    ├── mica_entry_table_4.xsd # EMT entry point
    ├── mica_cor-lab-en.xml    # English labels
    ├── mica_cor-lab-mt.xml    # Maltese labels
    ├── ...                    # Other language labels
    ├── mica_cor-def.xml       # Definition linkbase
    ├── mica-pre-table2.xml    # Presentation linkbase
    ├── mica-for-table2.xml    # Formula linkbase
    └── ...
```

### Reference Documents

```
ESME Research documents/
├── mica_taxonomy_2025_documentation_v1.0.pdf
├── mica_taxonomy_reporting_manual_v1.0.pdf
├── mica_taxonomy_formulas_202507.xlsx
├── SCWP_-_for_OTHR_token.xlsm
├── SCWP_-_for_ART_token.xlsm
├── SCWP_-_for_EMT_token.xlsm
└── mica_taxonomy_2025/
```
