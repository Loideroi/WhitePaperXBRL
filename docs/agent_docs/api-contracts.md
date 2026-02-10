# API Contracts - WhitePaper XBRL

## Overview

This document defines the API contracts for the WhitePaper XBRL platform. All APIs follow RESTful conventions and use JSON for request/response bodies unless otherwise noted.

---

## Base URL

```
Production: https://whitepaper-xbrl.vercel.app/api
Development: http://localhost:3000/api
```

---

## Authentication

Phase 1 (current): No authentication required (stateless, no sessions stored server-side).

---

## Common Response Format

### Success Response

```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
}
```

### Error Response

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]> | ValidationError[];
  };
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 413 | Payload Too Large |
| 415 | Unsupported Media Type |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Endpoints

### POST /api/upload

Upload a whitepaper document for processing. Supports multiple document formats: PDF, DOCX, ODT, and RTF. Processing is synchronous -- the response includes extracted content and field mappings.

#### Request

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Document file (max 50MB). Supported formats: PDF, DOCX, ODT, RTF |
| tokenType | string | No | `OTHR`, `ART`, or `EMT` (defaults to `OTHR`) |

Server-side validation includes both file extension/MIME type checking and magic byte verification to ensure the file content matches the declared format.

#### Response (200 OK)

```typescript
interface UploadResponse {
  success: true;
  data: {
    sessionId: string;             // Unique session identifier
    filename: string;              // Original filename
    size: number;                  // File size in bytes
    format: string;                // Detected format (pdf, docx, odt, rtf)
    tokenType: 'OTHR' | 'ART' | 'EMT';
    uploadedAt: string;            // ISO timestamp
    status: 'complete';            // Always 'complete' (synchronous processing)
    extraction: {
      pages: number;               // Number of pages (if applicable)
      metadata: {
        title?: string;
        author?: string;
        creationDate?: string;
      };
    };
    mapping: ExtractionResult;     // See ExtractionResult type below
  };
}
```

#### Errors

| Code | HTTP Status | Message |
|------|-------------|---------|
| FILE_REQUIRED | 400 | A document file is required (PDF, DOCX, ODT, or RTF) |
| FILE_TOO_LARGE | 413 | File exceeds maximum size of 50MB |
| UNSUPPORTED_FORMAT | 415 | Unsupported file format. Accepted formats: PDF, DOCX, ODT, RTF |
| INVALID_FILE_TYPE | 415 | File content does not match declared format |
| INVALID_TOKEN_TYPE | 400 | Token type must be OTHR, ART, or EMT |
| PROCESSING_FAILED | 500 | Failed to process document |

#### Example

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@whitepaper.pdf" \
  -F "tokenType=OTHR"
```

---

### POST /api/validate

Validate whitepaper data against ESMA MiCA taxonomy rules. Supports three modes: full validation, quick validation, and single-field validation.

#### Request

```typescript
interface ValidateRequest {
  data: Record<string, unknown>;         // Whitepaper data (partial or complete)
  tokenType: 'OTHR' | 'ART' | 'EMT';
  options?: {
    checkGLEIF?: boolean;                // Verify LEI against GLEIF registry
    skipRules?: string[];                // Rule IDs to skip
    quickMode?: boolean;                 // Quick validation (existence + LEI only)
    fieldPath?: string;                  // Single field path to validate
  };
}
```

#### Response: Full Mode (200 OK)

Default when no `options.quickMode` or `options.fieldPath` is set.

```typescript
interface FullValidateResponse {
  success: true;
  data: {
    mode: 'full';
    valid: boolean;
    summary: {
      totalAssertions: number;
      passed: number;
      errors: number;
      warnings: number;
    };
    errors: ValidationError[];
    warnings: ValidationWarning[];
    byCategory: Record<string, {
      errors: ValidationError[];
      warnings: ValidationWarning[];
    }>;
    assertionCounts: Record<string, number>;
  };
}
```

#### Response: Quick Mode (200 OK)

Returned when `options.quickMode` is `true`.

```typescript
interface QuickValidateResponse {
  success: true;
  data: {
    mode: 'quick';
    valid: boolean;
    errorCount: number;
    errors: ValidationError[];
  };
}
```

#### Response: Field Mode (200 OK)

Returned when `options.fieldPath` is set. Takes priority over `quickMode`.

```typescript
interface FieldValidateResponse {
  success: true;
  data: {
    field: string;
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
}
```

#### Validation Types

```typescript
interface ValidationError {
  ruleId: string;
  severity: 'ERROR';
  message: string;
  field?: string;
  fieldPath?: string;
}

interface ValidationWarning {
  ruleId: string;
  severity: 'WARNING';
  message: string;
  field?: string;
  suggestion?: string;
}
```

#### Errors

| Code | HTTP Status | Message |
|------|-------------|---------|
| INVALID_REQUEST | 400 | Zod validation error message |
| RATE_LIMITED | 429 | Too many validation requests |
| VALIDATION_FAILED | 500 | Internal validation engine failure |

#### Example

```bash
# Full validation
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "tokenType": "OTHR", "partA": { "lei": "529900T8BM49AURSDO55", "legalName": "Example Corp" } },
    "tokenType": "OTHR"
  }'

# Quick validation
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "tokenType": "OTHR", "partA": { "lei": "529900T8BM49AURSDO55" } },
    "tokenType": "OTHR",
    "options": { "quickMode": true }
  }'

# Single field validation
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "partA": { "lei": "529900T8BM49AURSDO55" } },
    "tokenType": "OTHR",
    "options": { "fieldPath": "partA.lei" }
  }'
```

---

### GET /api/validate

Get validation requirements for a given token type. Returns counts and breakdowns of all assertions that will be checked.

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| tokenType | string | Yes | `OTHR`, `ART`, or `EMT` |

#### Response (200 OK)

```typescript
interface ValidationRequirementsResponse {
  success: true;
  data: {
    tokenType: 'OTHR' | 'ART' | 'EMT';
    requirements: {
      existence: {
        total: number;
        required: number;
        recommended: number;
        byPart: Record<string, number>;
      };
      value: {
        total: number;
        required: number;
        recommended: number;
      };
      lei: {
        total: number;
        description: string;
      };
      totalAssertions: number;
    };
  };
}
```

#### Example

```bash
curl "http://localhost:3000/api/validate?tokenType=OTHR"
```

---

### POST /api/generate

Generate an iXBRL or JSON document from whitepaper data.

#### Request

```typescript
interface GenerateRequest {
  data: Record<string, unknown>;    // Whitepaper data object
  format?: 'ixbrl' | 'json';       // Output format (default: 'ixbrl')
  filename?: string;                // Optional output filename
}
```

Required fields in `data`:
- `partA.lei` -- valid 20-character uppercase alphanumeric LEI
- `partA.legalName` -- legal name of the offeror
- `partD.cryptoAssetName` -- name of the crypto-asset
- `tokenType` -- OTHR, ART, or EMT

#### Response: iXBRL Format (200 OK)

When `format` is `'ixbrl'` (default), the response is the raw iXBRL document:

```
Content-Type: application/xhtml+xml
Content-Disposition: attachment; filename="whitepaper-btc-2025-01-27.xhtml"
X-Content-Type-Options: nosniff
```

The response body is the iXBRL/XHTML document content directly (not wrapped in JSON).

#### Response: JSON Format (200 OK)

When `format` is `'json'`:

```typescript
interface GenerateJsonResponse {
  success: true;
  data: {
    format: 'json';
    content: Partial<WhitepaperData>;    // The whitepaper data as structured JSON
  };
}
```

#### Errors

| Code | HTTP Status | Message |
|------|-------------|---------|
| INVALID_REQUEST | 400 | Zod schema validation error |
| VALIDATION_FAILED | 400 | Required fields are missing or invalid (includes `details` array) |
| RATE_LIMITED | 429 | Too many generation requests |
| GENERATION_FAILED | 500 | Failed to generate document |

#### Example

```bash
# Generate iXBRL (returns XHTML directly)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tokenType": "OTHR",
      "documentDate": "2025-01-27",
      "language": "en",
      "partA": { "lei": "529900T8BM49AURSDO55", "legalName": "Example Corp", "registeredAddress": "123 Street", "country": "NL" },
      "partD": { "cryptoAssetName": "ExampleCoin", "cryptoAssetSymbol": "EXC", "totalSupply": 1000000, "projectDescription": "A sample project." }
    },
    "format": "ixbrl"
  }' \
  -o whitepaper.xhtml

# Generate JSON (returns structured data)
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "tokenType": "OTHR", "partA": { "lei": "529900T8BM49AURSDO55", "legalName": "Example Corp" }, "partD": { "cryptoAssetName": "ExampleCoin" } },
    "format": "json"
  }'
```

---

### GET /api/generate

Returns endpoint usage information (informational only).

#### Response (200 OK)

```typescript
{
  success: true;
  message: "Use POST to generate iXBRL document";
  endpoints: {
    generate: {
      method: "POST";
      body: {
        data: "Whitepaper data object";
        format: "ixbrl (default) | json";
        filename: "Optional output filename";
      };
    };
  };
}
```

---

## Data Types

### WhitepaperData

```typescript
interface WhitepaperData {
  // Metadata
  tokenType: 'OTHR' | 'ART' | 'EMT';
  documentDate: string;  // yyyy-mm-dd format
  language: string;      // ISO 639-1 (2 characters)

  // Part A: Offeror
  partA: {
    legalName: string;
    lei: string;                    // 20 uppercase alphanumeric chars
    registeredAddress: string;
    country: string;                // ISO 3166-1 alpha-2
    website?: string;               // Valid URL
    contactEmail?: string;          // Valid email
    contactPhone?: string;
  };

  // Part B: Issuer (if different from offeror)
  partB?: {
    legalName: string;
    lei: string;
    registeredAddress: string;
    country: string;
  };

  // Part C: Trading Platform Operator (if applicable)
  partC?: {
    legalName: string;
    lei: string;
    registeredAddress: string;
    country: string;
  };

  // Part D: Project Information
  partD: {
    cryptoAssetName: string;
    cryptoAssetSymbol: string;
    totalSupply: number;
    tokenStandard?: string;
    blockchainNetwork?: string;
    consensusMechanism?: string;
    projectDescription: string;
  };

  // Part E: Offering Details
  partE: {
    isPublicOffering: boolean;
    publicOfferingStartDate?: string;
    publicOfferingEndDate?: string;
    tokenPrice?: number;
    tokenPriceCurrency?: string;
    maxSubscriptionGoal?: number;
    distributionDate?: string;
    withdrawalRights?: boolean;
    paymentMethods?: string[];
  };

  // Part F: Crypto-Asset Characteristics
  partF: {
    classification: string;
    rightsDescription: string;
    technicalSpecifications?: string;
  };

  // Part G: Rights and Obligations
  partG: {
    purchaseRights?: string;
    ownershipRights?: string;
    transferRestrictions?: string;
    lockUpPeriod?: string;
    dynamicSupplyMechanism?: string;
  };

  // Part H: Underlying Technology
  partH: {
    blockchainDescription: string;
    smartContractInfo?: string;
    securityAudits?: string[];
    technicalCapacity?: string;
  };

  // Part I: Risk Factors
  partI: {
    offerRisks: string[];
    issuerRisks: string[];
    marketRisks: string[];
    technologyRisks: string[];
    regulatoryRisks: string[];
  };

  // Part J: Sustainability
  partJ: {
    energyConsumption?: number;
    energyUnit?: 'kWh';
    consensusMechanismType?: string;
    renewableEnergyPercentage?: number;  // 0-100
    ghgEmissions?: number;
  };

  // Management body members
  managementBodyMembers?: {
    offeror?: ManagementBodyMember[];
    issuer?: ManagementBodyMember[];
    operator?: ManagementBodyMember[];
  };

  // Project persons
  projectPersons?: ProjectPerson[];

  // Raw extracted fields keyed by field number (e.g., "A.1", "E.14")
  rawFields?: Record<string, string>;
}

interface ManagementBodyMember {
  identity: string;
  businessAddress: string;
  function: string;
}

interface ProjectPerson {
  identity: string;
  businessAddress: string;
  role: string;
}
```

### ExtractionResult

Returned as part of the upload response `mapping` field.

```typescript
interface ExtractionResult {
  data: Partial<WhitepaperData>;
  mappings: MappedField[];
  confidence: {
    overall: number;
    bySection: Record<string, number>;
    lowConfidenceFields: string[];
  };
}

interface MappedField {
  path: string;
  value: unknown;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}
```

---

## Rate Limits

Defined in `src/lib/security/rate-limiter.ts`:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/upload | 10 | 1 minute |
| POST /api/validate | 60 | 1 minute |
| POST /api/generate | 30 | 1 minute |
| (internal) process | 20 | 1 minute |

When rate limited, the response includes:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706400000
```

Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are also included on successful responses to upload, validate, and generate endpoints.

---

## Planned Endpoints (Not Yet Implemented)

The following endpoints are planned for future phases but are not currently available:

- **GET/PUT /api/upload/:sessionId** -- Session retrieval and update (requires server-side storage)
- **GET /api/generate/:documentId** -- Download previously generated documents
- **GET /api/generate/:documentId/preview** -- Browser-based iXBRL preview
- **GET /api/taxonomy/elements** -- Query taxonomy elements by token type
- **GET /api/taxonomy/enumerations/:domain** -- Enumerate valid values for a domain
- **POST /api/lei/validate** -- Standalone LEI validation endpoint (currently LEI validation is performed inline during `/api/validate`)
- **Webhook events** -- Async event notifications (`upload.complete`, `validation.complete`, etc.)
- **JWT authentication** -- Supabase Auth integration

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| FILE_REQUIRED | 400 | No file provided in upload |
| FILE_TOO_LARGE | 413 | File exceeds 50MB size limit |
| UNSUPPORTED_FORMAT | 415 | File format not in PDF, DOCX, ODT, RTF |
| INVALID_FILE_TYPE | 415 | File content does not match declared format (magic byte mismatch) |
| INVALID_TOKEN_TYPE | 400 | Token type must be OTHR, ART, or EMT |
| INVALID_REQUEST | 400 | Request body failed Zod schema validation |
| VALIDATION_FAILED | 400/500 | Validation errors present (400) or internal failure (500) |
| PROCESSING_FAILED | 500 | Document extraction/processing failed |
| GENERATION_FAILED | 500 | iXBRL generation failed |
| RATE_LIMITED | 429 | Too many requests |
