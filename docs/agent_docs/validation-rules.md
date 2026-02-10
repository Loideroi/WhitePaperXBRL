# Validation Rules Reference - WhitePaper XBRL

## Overview

This document describes the validation rules that must be implemented to ensure iXBRL documents comply with ESMA's MiCA taxonomy requirements.

### Assertion Totals (ESMA Reporting Manual)

- **257** existence assertions (required fields present)
- **223** value assertions (field value formats/constraints)
- **6** LEI assertions (format + checksum + optional GLEIF)
- **486 total** assertions

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

### 5. ESMA Filing Rules (Reporting Manual)
- Duplicate fact validation
- Language (`xml:lang`) requirements
- Hidden section rules
- CSS restrictions on tagged facts
- `decimals` vs `precision` requirement
- Single entity requirement
- Prohibited elements (`<base>`, `xml:base`)

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
| CTX-007 | One entity identifier per document (all entity identifiers must be identical) | ERROR |

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
| FCT-003 | Use `decimals` attribute, not `precision` | ERROR |
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
| LNG-003 | All text facts have `xml:lang` in scope | ERROR |

### Hidden Section Rules

| Rule ID | Description | Severity |
|---------|-------------|----------|
| HID-001 | `transformableElementIncludedInHiddenSection`: transformable elements must not be placed in `ix:hidden` | ERROR |
| HID-002 | CSS `display:none` must not be applied to tagged (ix:nonFraction, ix:nonNumeric) facts in the visible document | ERROR |

---

## ESMA Filing Rules (Reporting Manual)

These rules come from the ESMA ESEF/MiCA Reporting Manual and apply to all iXBRL filings.

### Duplicate Fact Validation

| Rule ID | Description | Severity |
|---------|-------------|----------|
| DUP-001 | Inconsistent numeric duplicate facts (same concept, context, unit, but different value) | ERROR |
| DUP-002 | Inconsistent non-numeric duplicate facts (same concept, context, xml:lang, but different value) | WARNING |

Two facts are "duplicates" when they report the same concept in the same context (and same unit for numeric facts, same `xml:lang` for non-numeric facts). Duplicate facts with identical values are acceptable; only inconsistent duplicates trigger validation messages.

### Decimals vs Precision

Numeric facts must use the `decimals` attribute. The `precision` attribute is not permitted.

### Single Entity Requirement

All `xbrli:identifier` elements across all contexts in the document must contain the same value (the LEI of the reporting entity). Multiple distinct entity identifiers in a single filing are not allowed.

### Prohibited Elements and Attributes

| Rule ID | Description | Severity |
|---------|-------------|----------|
| PRH-001 | No `<base>` HTML element | ERROR |
| PRH-002 | No `xml:base` attribute on any element | ERROR |
| PRH-003 | No `<script>` elements | ERROR |
| PRH-004 | No event handler attributes (onclick, onload, etc.) | ERROR |
| PRH-005 | No embedded executable content (Java applets, Flash, ActiveX) | ERROR |

---

## ESMA Formula Assertions

### Existence Assertions

Check that required facts are present.

#### Table 2 (OTHR) - 72 assertions

```typescript
// Example assertion structure (from existence-engine.ts)
interface ExistenceAssertion {
  id: string;
  description: string;
  fieldPath: string;
  elementName: string;
  tokenTypes: TokenType[];
  severity: 'ERROR' | 'WARNING';
  condition?: {
    fieldPath: string;
    value?: unknown;
  };
}

// Example
const assertion: ExistenceAssertion = {
  id: 'EXS-A-002',
  description: 'Offeror LEI is required',
  fieldPath: 'partA.lei',
  elementName: 'mica:OfferorLegalEntityIdentifier',
  tokenTypes: ['OTHR', 'ART', 'EMT'],
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
// Example assertion structure (from value-engine.ts)
interface ValueAssertion {
  id: string;
  description: string;
  tokenTypes: TokenType[];
  severity: 'ERROR' | 'WARNING';
  validate: (data: Partial<WhitepaperData>) => ValidationError | null;
}

// Example: End date must be after start date
const assertion: ValueAssertion = {
  id: 'VAL-001',
  description: 'Public offering end date must be after start date',
  tokenTypes: ['OTHR', 'ART', 'EMT'],
  severity: 'ERROR',
  validate: (data) => {
    const startDate = parseDate(data.partE?.publicOfferingStartDate);
    const endDate = parseDate(data.partE?.publicOfferingEndDate);
    if (startDate && endDate && endDate <= startDate) {
      return {
        ruleId: 'VAL-001',
        severity: 'ERROR',
        message: 'Public offering end date must be after start date',
        fieldPath: 'partE.publicOfferingEndDate',
      };
    }
    return null;
  },
};
```

#### Common Value Assertions

| ID | Description | Formula |
|----|-------------|---------|
| VAL-001 | End date after start date | `endDate > startDate` |
| VAL-002 | Total supply positive | `totalSupply > 0` |
| VAL-003 | Token price positive | `tokenPrice > 0` |
| VAL-004 | Max subscription goal positive | `maxSubscriptionGoal > 0` |
| VAL-005 | Renewable energy percentage in range | `0 <= percentage <= 100` |
| VAL-006 | Country code format | ISO 3166-1 alpha-2 (2 uppercase letters) |
| VAL-007 | Website URL format | Must start with `http://` or `https://` |
| VAL-008 | Email format | Valid email pattern |
| VAL-009 | Document date format | `YYYY-MM-DD` |
| VAL-010 | Language code format | ISO 639-1 (2 lowercase letters) |
| VAL-011 | Public offering completeness | If public offering, price or goal required |
| VAL-012 | Token symbol format | Should be uppercase |
| VAL-013 | Energy consumption non-negative | `energyConsumption >= 0` |

---

## LEI Validation

### Format Validation

```typescript
const LEI_REGEX = /^[A-Z0-9]{18}[0-9]{2}$/;

function isValidLEIFormat(lei: string): boolean {
  if (!lei || typeof lei !== 'string') return false;
  if (lei.length !== 20) return false;
  return LEI_REGEX.test(lei.toUpperCase());
}
```

### Checksum Validation (ISO 17442)

```typescript
function validateLEIChecksum(lei: string): boolean {
  if (!isValidLEIFormat(lei)) return false;

  const upperLei = lei.toUpperCase();

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericString = '';
  for (const char of upperLei) {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericString += (code - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Modulo 97 check (similar to IBAN)
  let remainder = 0;
  for (const digit of numericString) {
    remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
  }

  return remainder === 1;
}
```

### GLEIF API Validation (Optional)

```typescript
async function validateLEIWithGLEIF(lei: string): Promise<LEIValidationResult> {
  const errors: ValidationError[] = [];

  if (!isValidLEIFormat(lei)) {
    errors.push({ ruleId: 'LEI-001', severity: 'ERROR', message: '...', element: 'lei' });
    return { valid: false, errors };
  }

  if (!validateLEIChecksum(lei)) {
    errors.push({ ruleId: 'LEI-002', severity: 'ERROR', message: '...', element: 'lei' });
    return { valid: false, errors };
  }

  try {
    const response = await fetch(
      `https://api.gleif.org/api/v1/lei-records/${lei}`,
      {
        headers: { Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        errors.push({
          ruleId: 'LEI-003',
          severity: 'WARNING',
          message: 'LEI not found in GLEIF database',
          element: 'lei',
        });
      }
      return { valid: true, errors };
    }

    const data = await response.json();
    const attributes = data?.data?.attributes;

    if (attributes?.registration?.status !== 'ISSUED') {
      errors.push({
        ruleId: 'LEI-004',
        severity: 'WARNING',
        message: `LEI status is ${attributes.registration?.status} - should be ISSUED`,
        element: 'lei',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      entityInfo: {
        name: attributes.entity?.legalName?.name,
        status: attributes.registration?.status,
        country: attributes.entity?.jurisdiction,
      },
    };
  } catch {
    return { valid: true, errors };
  }
}
```

### LEI Rule IDs

| Rule ID | Description | Severity |
|---------|-------------|----------|
| LEI-000 | LEI is required (missing or empty) | ERROR |
| LEI-001 | Invalid LEI format (must be 18 alphanumeric + 2 check digits) | ERROR |
| LEI-002 | LEI checksum validation failed (mod-97) | ERROR |
| LEI-003 | LEI not found in GLEIF database | WARNING |
| LEI-004 | LEI registration status is not ISSUED | WARNING |
| LEI-*-ISSUER | Issuer LEI validation (same checks, prefixed) | varies |
| LEI-*-OPERATOR | Operator LEI validation (same checks, prefixed) | varies |

The `validateAllLEIs()` function checks up to 3 LEIs (offeror, issuer, operator) and returns combined errors with `fieldPath` set to `partA.lei`, `partB.lei`, or `partC.lei` respectively.

---

## Implementation Architecture

### File Structure

| File | Purpose |
|------|---------|
| `src/lib/xbrl/validator/orchestrator.ts` | Runs all validations, aggregates results |
| `src/lib/xbrl/validator/existence-engine.ts` | Checks required fields are present |
| `src/lib/xbrl/validator/value-engine.ts` | Checks field value formats/constraints |
| `src/lib/xbrl/validator/lei-validator.ts` | LEI format + checksum + optional GLEIF |
| `src/lib/xbrl/validator/index.ts` | Barrel exports for all validator modules |

Assertions are coded directly in the engine files as TypeScript arrays/objects. There is no formula linkbase XML parsing at runtime and no `AssertionRegistry` class.

### Validation Modes

The orchestrator (`orchestrator.ts`) exposes four functions:

#### `validateWhitepaper(data, tokenType, options)` - Full Validation

Runs all three engines sequentially: LEI + existence + value. Returns a `DetailedValidationResult` with errors/warnings grouped by category and assertion counts.

```typescript
async function validateWhitepaper(
  data: Partial<WhitepaperData>,
  tokenType: TokenType,
  options?: ValidationOptions
): Promise<DetailedValidationResult>
```

Options:
- `checkGLEIF?: boolean` -- whether to call the GLEIF API for LEI verification
- `stopOnFirstError?: boolean` -- whether to halt on first error
- `skipRules?: string[]` -- rule IDs to skip (filtered before aggregation)

#### `quickValidate(data, tokenType)` - Fast Mode

Runs LEI + existence only (skips value assertions). Useful for real-time form validation where speed matters.

```typescript
function quickValidate(
  data: Partial<WhitepaperData>,
  tokenType: TokenType
): { valid: boolean; errorCount: number; errors: ValidationError[] }
```

#### `validateField(data, fieldPath, tokenType)` - Single Field Validation

Runs all engines but filters results to only errors matching the given `fieldPath`. Used by the editor UI to show per-field validation messages.

```typescript
function validateField(
  data: Partial<WhitepaperData>,
  fieldPath: string,
  tokenType: TokenType
): ValidationError[]
```

#### `getValidationRequirements(tokenType)` - Assertion Counts

Returns the total number of assertions for a given token type (existence + value + 6 LEI). Used for display in the UI (e.g., progress bars).

```typescript
function getValidationRequirements(tokenType: TokenType): {
  existence: { total: number; required: number; recommended: number; byPart: Record<string, number> };
  value: { total: number; required: number; recommended: number };
  total: number; // existence.total + value.total + 6
}
```

### Validation Pipeline (orchestrator.ts)

```typescript
// Simplified flow inside validateWhitepaper():

// 1. LEI Validation (format + checksum, optional GLEIF)
const leiErrors = validateAllLEIs(data.partA?.lei, partB?.lei, partC?.lei);

// 2. Existence Assertions (required fields present)
const existenceResult = validateExistenceAssertions(data, tokenType);

// 3. Value Assertions (field value formats/constraints)
const valueResult = validateValueAssertions(data, tokenType);

// 4. Aggregate by category, apply skipRules filter, compute counts
return {
  valid: allErrors.length === 0,
  errors: allErrors,
  warnings: allWarnings,
  summary: { totalAssertions, passed, errors, warnings },
  byCategory: { lei, existence, value },
  assertionCounts: { existence, value, lei },
};
```

### Result Types

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalAssertions: number;
    passed: number;
    errors: number;
    warnings: number;
  };
}

interface ValidationError {
  ruleId: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  element?: string;
  fieldPath?: string;
}

interface DetailedValidationResult extends ValidationResult {
  byCategory: {
    lei: { errors: ValidationError[]; warnings: ValidationError[] };
    existence: { errors: ValidationError[]; warnings: ValidationError[] };
    value: { errors: ValidationError[]; warnings: ValidationError[] };
  };
  assertionCounts: {
    existence: { total: number; passed: number; failed: number };
    value: { total: number; passed: number; failed: number };
    lei: { total: number; passed: number; failed: number };
  };
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
    'EXS-A-002': 'The offeror\'s Legal Entity Identifier (LEI) is required',
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
        expect.objectContaining({ ruleId: 'EXS-A-002' })
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

### Assertion Evaluation

Assertions are defined as static TypeScript arrays in `existence-engine.ts` and `value-engine.ts`. No file I/O or XML parsing is needed at runtime -- all assertions are loaded when the module is imported. This makes validation fast and deterministic.

### Parallel Validation

```typescript
// The orchestrator runs engines sequentially, but each engine
// iterates its own assertion list independently. For the full
// validateWhitepaper() call, the flow is:
//
// 1. validateAllLEIs()           -- synchronous (unless GLEIF)
// 2. validateExistenceAssertions() -- synchronous
// 3. validateValueAssertions()     -- synchronous
//
// GLEIF API is the only async step and is optional.
```

### Quick Validation Path

For real-time form feedback, use `quickValidate()` which skips value assertions entirely. This is faster because value assertions run custom validation functions, while existence assertions are simple "is field present?" checks.

### Field-Level Validation

For per-field validation in the editor UI, `validateField()` runs all engines but filters results by `fieldPath`. This is acceptable for single-field checks but should not be called in a loop for all fields -- use `validateWhitepaper()` instead and filter client-side.

---

## Reference: Assertion Counts

| Token Type | Existence | Value | Total |
|------------|-----------|-------|-------|
| OTHR (Table 2) | 72 | 139 | 211 |
| ART (Table 3) | 103 | 62 | 165 |
| EMT (Table 4) | 82 | 22 | 104 |
| LEI | - | 6 | 6 |
| **Total** | **257** | **229** | **486** |
