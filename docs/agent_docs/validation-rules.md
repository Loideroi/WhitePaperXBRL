# Validation Rules Reference - WhitePaper XBRL

## Overview

This document describes the validation rules that must be implemented to ensure iXBRL documents comply with ESMA's MiCA taxonomy requirements.

---

## Validation Categories

### 1. Schema Validation
- XML well-formedness
- Namespace declarations
- Element structure

### 2. XBRL 2.1 Validation
- Context requirements
- Unit requirements
- Fact requirements

### 3. Inline XBRL 1.1 Validation
- Transformation rules
- Target document requirements
- Escape attribute rules

### 4. Formula Assertions
- 257 existence assertions
- 223 value assertions
- 6 LEI assertions

---

## Schema Validation

### Required Namespaces

```xml
<html xmlns="http://www.w3.org/1999/xhtml"
      xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
      xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
      xmlns:ixt="http://www.xbrl.org/inlineXBRL/transformation/2020-02-12"
      xmlns:mica="https://www.esma.europa.eu/taxonomy/2025-03-31/mica/"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:lei="http://standards.iso.org/iso/17442">
```

### Document Structure

```xml
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8"/>
    <title>Crypto-Asset White Paper</title>
    <style>/* CSS here */</style>
  </head>
  <body>
    <div style="display:none">
      <ix:header>
        <ix:hidden>
          <!-- Hidden XBRL content -->
        </ix:hidden>
        <ix:references>
          <!-- Taxonomy references -->
        </ix:references>
        <ix:resources>
          <!-- Contexts, units -->
        </ix:resources>
      </ix:header>
    </div>

    <!-- Visible document content with inline tags -->
  </body>
</html>
```

---

## XBRL 2.1 Validation Rules

### Context Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| CTX-001 | Context must have unique ID | ERROR |
| CTX-002 | Entity identifier must be valid LEI | ERROR |
| CTX-003 | Entity scheme must be `http://standards.iso.org/iso/17442` | ERROR |
| CTX-004 | Period must be instant or duration | ERROR |
| CTX-005 | Period date format: yyyy-mm-dd (no time) | ERROR |
| CTX-006 | Use scenario for dimensions, not segment | ERROR |
| CTX-007 | One entity identifier per document | ERROR |

### Unit Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| UNT-001 | Unit must have unique ID | ERROR |
| UNT-002 | Monetary units: use ISO 4217 codes | ERROR |
| UNT-003 | Pure numbers: use `xbrli:pure` | ERROR |
| UNT-004 | Energy: use `utr:kWh` | ERROR |
| UNT-005 | Emissions: use `utr:tCO2` | ERROR |

### Fact Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| FCT-001 | Fact must reference valid context | ERROR |
| FCT-002 | Numeric fact must reference valid unit | ERROR |
| FCT-003 | Use 'decimals' attribute, not 'precision' | ERROR |
| FCT-004 | No inconsistent duplicate facts (numeric) | ERROR |
| FCT-005 | No inconsistent duplicate facts (non-numeric) | WARNING |
| FCT-006 | Unique fact ID recommended | WARNING |

---

## Inline XBRL 1.1 Validation Rules

### Transformation Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| IXB-001 | Use official transformation registry | ERROR |
| IXB-002 | Date transformations: `ixt:date-*` | ERROR |
| IXB-003 | Numeric transformations: appropriate format | ERROR |

### Escape Attribute Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| ESC-001 | `textBlockItemType`: `@escape="true"` | ERROR |
| ESC-002 | `stringItemType`: `@escape="false"` | ERROR |

### Content Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| CNT-001 | No `<script>` elements | ERROR |
| CNT-002 | No JavaScript event handlers | ERROR |
| CNT-003 | No `<base>` element | ERROR |
| CNT-004 | No `xml:base` attribute | ERROR |
| CNT-005 | No executable content (Java, Flash) | ERROR |
| CNT-006 | Images: PNG, GIF, SVG, JPEG only | ERROR |
| CNT-007 | Single target document (default) | ERROR |

### Language Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| LNG-001 | `xml:lang` on root HTML element | ERROR |
| LNG-002 | `xml:lang` on `ix:references` | ERROR |
| LNG-003 | All text facts have `xml:lang` | ERROR |

---

## ESMA Formula Assertions

### Existence Assertions

Check that required facts are present.

#### Table 2 (OTHR) - 72 assertions

```typescript
// Example assertion structure
interface ExistenceAssertion {
  id: string;
  description: string;
  requiredElement: string;
  condition?: string;  // Optional conditional logic
  severity: 'ERROR' | 'WARNING';
}

// Example
const assertion: ExistenceAssertion = {
  id: 'EXS-T2-001',
  description: 'Offeror LEI must be provided',
  requiredElement: 'mica:OfferorLegalEntityIdentifier',
  severity: 'ERROR',
};
```

#### Key Required Fields (OTHR)

| Field | Element Name | Notes |
|-------|--------------|-------|
| Offeror LEI | `mica:OfferorLegalEntityIdentifier` | Must exist |
| Token Name | `mica:CryptoAssetName` | Must exist |
| Token Symbol | `mica:CryptoAssetSymbol` | Must exist |
| Offering Date | `mica:PublicOfferingStartDate` | If public offering |
| Home Member State | `mica:HomeMemberState` | Must exist |

#### Table 3 (ART) - 103 assertions

Additional required fields for ART:
- Issuer authorization status
- Reserve asset details
- Stabilization mechanism

#### Table 4 (EMT) - 82 assertions

Additional required fields for EMT:
- Issuer authorization (credit/e-money institution)
- Monetary value backing
- Redemption mechanisms

### Value Assertions

Check relationships between field values.

#### Cross-Field Validations

```typescript
interface ValueAssertion {
  id: string;
  description: string;
  formula: string;  // Logical expression
  severity: 'ERROR' | 'WARNING';
}

// Example: End date must be after start date
const assertion: ValueAssertion = {
  id: 'VAL-T2-015',
  description: 'Public offering end date must be after start date',
  formula: 'mica:PublicOfferingEndDate > mica:PublicOfferingStartDate',
  severity: 'ERROR',
};
```

#### Common Value Assertions

| ID | Description | Formula |
|----|-------------|---------|
| VAL-001 | End date after start date | `endDate > startDate` |
| VAL-002 | Total supply positive | `totalSupply > 0` |
| VAL-003 | Percentage in range | `0 <= percentage <= 1` |
| VAL-004 | Energy below threshold or report | `energy < 500000 OR renewableReported` |
| VAL-005 | LEI checksum valid | `validateLEIChecksum(lei)` |

---

## LEI Validation

### Format Validation

```typescript
const LEI_REGEX = /^[A-Z0-9]{18}[0-9]{2}$/;

function isValidLEIFormat(lei: string): boolean {
  return LEI_REGEX.test(lei);
}
```

### Checksum Validation (ISO 17442)

```typescript
function validateLEIChecksum(lei: string): boolean {
  if (!isValidLEIFormat(lei)) return false;

  // Convert letters to numbers (A=10, B=11, ...)
  const numericLei = lei
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return (code - 55).toString(); // A=10, B=11, etc.
      }
      return char;
    })
    .join('');

  // Modulo 97 check (similar to IBAN)
  let remainder = 0;
  for (const digit of numericLei) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }

  return remainder === 1;
}
```

### GLEIF API Validation (Optional)

```typescript
async function validateLEIWithGLEIF(lei: string): Promise<{
  valid: boolean;
  entityName?: string;
  status?: string;
}> {
  try {
    const response = await fetch(
      `https://api.gleif.org/api/v1/lei-records/${lei}`
    );

    if (!response.ok) {
      return { valid: false };
    }

    const data = await response.json();
    return {
      valid: true,
      entityName: data.data.attributes.entity.legalName.name,
      status: data.data.attributes.registration.status,
    };
  } catch {
    // API failure - fall back to format validation only
    return { valid: isValidLEIFormat(lei) };
  }
}
```

---

## Implementation Architecture

### Validation Pipeline

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  ruleId: string;
  severity: 'ERROR';
  message: string;
  element?: string;
  location?: string;
}

interface ValidationWarning {
  ruleId: string;
  severity: 'WARNING';
  message: string;
  element?: string;
  suggestion?: string;
}

async function validateWhitepaper(
  data: WhitepaperData,
  tokenType: 'OTHR' | 'ART' | 'EMT'
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Schema validation
  const schemaResult = validateSchema(data);
  errors.push(...schemaResult.errors);

  // 2. XBRL 2.1 validation
  const xbrlResult = validateXBRL(data);
  errors.push(...xbrlResult.errors);
  warnings.push(...xbrlResult.warnings);

  // 3. Inline XBRL validation
  const ixbrlResult = validateInlineXBRL(data);
  errors.push(...ixbrlResult.errors);

  // 4. Existence assertions
  const existenceResult = validateExistenceAssertions(data, tokenType);
  errors.push(...existenceResult.errors);

  // 5. Value assertions
  const valueResult = validateValueAssertions(data, tokenType);
  errors.push(...valueResult.errors);
  warnings.push(...valueResult.warnings);

  // 6. LEI validation
  const leiResult = await validateLEI(data.offerorLEI);
  errors.push(...leiResult.errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### Assertion Registry

```typescript
// Load assertions from formula linkbase
class AssertionRegistry {
  private existenceAssertions: Map<string, ExistenceAssertion[]>;
  private valueAssertions: Map<string, ValueAssertion[]>;

  constructor() {
    this.existenceAssertions = new Map();
    this.valueAssertions = new Map();
  }

  async loadAssertions(tokenType: 'OTHR' | 'ART' | 'EMT'): Promise<void> {
    const tableNum = { OTHR: '2', ART: '3', EMT: '4' }[tokenType];
    const formulaPath = `taxonomy/mica-for-table${tableNum}.xml`;

    const parsed = await parseFormulaLinkbase(formulaPath);

    this.existenceAssertions.set(tokenType, parsed.existence);
    this.valueAssertions.set(tokenType, parsed.value);
  }

  getExistenceAssertions(tokenType: string): ExistenceAssertion[] {
    return this.existenceAssertions.get(tokenType) ?? [];
  }

  getValueAssertions(tokenType: string): ValueAssertion[] {
    return this.valueAssertions.get(tokenType) ?? [];
  }
}
```

---

## Error Messages

### User-Friendly Error Format

```typescript
function formatErrorMessage(error: ValidationError): string {
  const templates: Record<string, string> = {
    'CTX-003': 'The entity identifier scheme must be the LEI standard (http://standards.iso.org/iso/17442)',
    'CTX-005': 'Dates must be in yyyy-mm-dd format without time components',
    'FCT-002': 'Numeric values must have a unit of measure specified',
    'ESC-001': 'Text blocks must have escape="true" attribute',
    'EXS-T2-001': 'The offeror\'s Legal Entity Identifier (LEI) is required',
    'VAL-001': 'The end date must be after the start date',
  };

  return templates[error.ruleId] ?? error.message;
}
```

### Field-Linked Errors

```typescript
interface FieldError {
  fieldPath: string;    // e.g., 'partE.publicOfferingEndDate'
  ruleId: string;
  message: string;
}

function linkErrorsToFields(
  errors: ValidationError[]
): FieldError[] {
  return errors.map(error => ({
    fieldPath: elementToFieldPath(error.element),
    ruleId: error.ruleId,
    message: formatErrorMessage(error),
  }));
}
```

---

## Testing Validation Rules

### Test Structure

```typescript
// tests/lib/xbrl/validator/assertions.test.ts

describe('Existence Assertions', () => {
  describe('Table 2 (OTHR)', () => {
    it('should require offeror LEI', () => {
      const data = createMinimalWhitepaper({ offerorLEI: undefined });
      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors).toContainEqual(
        expect.objectContaining({ ruleId: 'EXS-T2-001' })
      );
    });

    it('should pass with all required fields', () => {
      const data = createCompleteWhitepaper();
      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Value Assertions', () => {
  it('should validate date order', () => {
    const data = createWhitepaperWithDates({
      startDate: '2025-12-31',
      endDate: '2025-12-01', // Before start
    });
    const result = validateValueAssertions(data, 'OTHR');

    expect(result.errors).toContainEqual(
      expect.objectContaining({ ruleId: 'VAL-001' })
    );
  });
});

describe('LEI Validation', () => {
  it('should validate correct LEI format', () => {
    expect(isValidLEIFormat('5493001KJTIIGC8Y1R12')).toBe(true);
  });

  it('should reject invalid LEI format', () => {
    expect(isValidLEIFormat('INVALID')).toBe(false);
  });

  it('should validate LEI checksum', () => {
    expect(validateLEIChecksum('5493001KJTIIGC8Y1R12')).toBe(true);
  });
});
```

---

## Performance Considerations

### Assertion Caching

```typescript
// Cache parsed assertions in memory
const assertionCache = new Map<string, {
  existence: ExistenceAssertion[];
  value: ValueAssertion[];
  loadedAt: number;
}>();

async function getAssertions(tokenType: string) {
  const cached = assertionCache.get(tokenType);
  if (cached && Date.now() - cached.loadedAt < 3600000) {
    return cached;
  }

  const loaded = await loadAssertions(tokenType);
  assertionCache.set(tokenType, {
    ...loaded,
    loadedAt: Date.now(),
  });

  return loaded;
}
```

### Parallel Validation

```typescript
async function validateAll(data: WhitepaperData, tokenType: string) {
  // Run independent validations in parallel
  const [schema, xbrl, ixbrl, existence, value, lei] = await Promise.all([
    validateSchema(data),
    validateXBRL(data),
    validateInlineXBRL(data),
    validateExistenceAssertions(data, tokenType),
    validateValueAssertions(data, tokenType),
    validateLEI(data.offerorLEI),
  ]);

  return mergeResults([schema, xbrl, ixbrl, existence, value, lei]);
}
```

---

## Reference: Assertion Counts

| Token Type | Existence | Value | Total |
|------------|-----------|-------|-------|
| OTHR (Table 2) | 72 | 139 | 211 |
| ART (Table 3) | 103 | 62 | 165 |
| EMT (Table 4) | 82 | 22 | 104 |
| LEI | - | 6 | 6 |
| **Total** | **257** | **229** | **486** |
