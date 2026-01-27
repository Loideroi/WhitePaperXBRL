# API Contracts - WhitePaper XBRL

## Overview

This document defines the API contracts for the WhitePaper XBRL platform. All APIs follow RESTful conventions and use JSON for request/response bodies.

---

## Base URL

```
Production: https://whitepaper-xbrl.vercel.app/api
Development: http://localhost:3000/api
```

---

## Authentication

Phase 1: No authentication required (session-based)
Phase 2+: JWT Bearer tokens via Supabase Auth

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
    details?: Record<string, string[]>;
  };
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 413 | Payload Too Large |
| 415 | Unsupported Media Type |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## Endpoints

### POST /api/upload

Upload a PDF whitepaper for processing.

#### Request

```
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF file (max 50MB) |
| tokenType | string | No | OTHR, ART, or EMT (can be set later) |

#### Response (201 Created)

```typescript
interface UploadResponse {
  success: true;
  data: {
    sessionId: string;          // Unique session identifier
    filename: string;           // Original filename
    size: number;               // File size in bytes
    pages: number;              // Number of pages
    extractedAt: string;        // ISO timestamp
    tokenType?: 'OTHR' | 'ART' | 'EMT';
    extractionStatus: 'pending' | 'processing' | 'complete' | 'failed';
  };
}
```

#### Errors

| Code | Message |
|------|---------|
| FILE_TOO_LARGE | File exceeds 50MB limit |
| INVALID_FILE_TYPE | Only PDF files are accepted |
| EXTRACTION_FAILED | Failed to extract text from PDF |

#### Example

```bash
curl -X POST https://whitepaper-xbrl.vercel.app/api/upload \
  -F "file=@whitepaper.pdf" \
  -F "tokenType=OTHR"
```

---

### GET /api/upload/:sessionId

Get upload status and extracted data.

#### Response (200 OK)

```typescript
interface UploadStatusResponse {
  success: true;
  data: {
    sessionId: string;
    status: 'pending' | 'processing' | 'complete' | 'failed';
    filename: string;
    tokenType?: 'OTHR' | 'ART' | 'EMT';
    extractedData?: WhitepaperData;  // Present when status is 'complete'
    error?: string;                   // Present when status is 'failed'
    expiresAt: string;               // ISO timestamp (1 hour from upload)
  };
}
```

---

### PUT /api/upload/:sessionId

Update session data (token type, field values).

#### Request

```typescript
interface UpdateSessionRequest {
  tokenType?: 'OTHR' | 'ART' | 'EMT';
  fields?: Partial<WhitepaperData>;
}
```

#### Response (200 OK)

```typescript
interface UpdateSessionResponse {
  success: true;
  data: {
    sessionId: string;
    updated: string[];  // List of updated field paths
  };
}
```

---

### POST /api/validate

Validate whitepaper data against ESMA taxonomy rules.

#### Request

```typescript
interface ValidateRequest {
  sessionId: string;
  // OR provide data directly:
  data?: WhitepaperData;
  tokenType: 'OTHR' | 'ART' | 'EMT';
}
```

#### Response (200 OK)

```typescript
interface ValidateResponse {
  success: true;
  data: {
    valid: boolean;
    summary: {
      totalAssertions: number;
      passed: number;
      errors: number;
      warnings: number;
    };
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
}

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

#### Example

```bash
curl -X POST https://whitepaper-xbrl.vercel.app/api/validate \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "abc123", "tokenType": "OTHR"}'
```

---

### POST /api/generate

Generate iXBRL document from validated data.

#### Request

```typescript
interface GenerateRequest {
  sessionId: string;
  // OR provide data directly:
  data?: WhitepaperData;
  tokenType: 'OTHR' | 'ART' | 'EMT';
  options?: {
    language?: string;         // Default: 'en'
    includeStyles?: boolean;   // Default: true
    embedTaxonomy?: boolean;   // Default: false
  };
}
```

#### Response (200 OK)

```typescript
interface GenerateResponse {
  success: true;
  data: {
    documentId: string;
    filename: string;          // e.g., 'whitepaper_2025-01-27.xhtml'
    size: number;              // File size in bytes
    downloadUrl: string;       // Temporary signed URL
    expiresAt: string;         // URL expiration (1 hour)
    validation: {
      passed: boolean;
      errors: number;
      warnings: number;
    };
  };
}
```

#### Errors

| Code | Message |
|------|---------|
| VALIDATION_FAILED | Document has validation errors. Fix errors before generating. |
| GENERATION_FAILED | Failed to generate iXBRL document |
| SESSION_EXPIRED | Session has expired. Please upload again. |

---

### GET /api/generate/:documentId

Download generated iXBRL document.

#### Response (200 OK)

```
Content-Type: application/xhtml+xml
Content-Disposition: attachment; filename="whitepaper.xhtml"
```

Returns the raw iXBRL document.

---

### GET /api/generate/:documentId/preview

Preview iXBRL document in browser.

#### Response (200 OK)

```
Content-Type: text/html
```

Returns HTML page with embedded iXBRL viewer.

---

### GET /api/taxonomy/elements

Get taxonomy elements for a token type.

#### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| tokenType | string | Yes | OTHR, ART, or EMT |
| part | string | No | Filter by part (A, B, C, etc.) |
| language | string | No | Label language (default: en) |

#### Response (200 OK)

```typescript
interface TaxonomyElementsResponse {
  success: true;
  data: {
    elements: TaxonomyElement[];
    enumerations: Record<string, EnumerationOption[]>;
  };
}

interface TaxonomyElement {
  name: string;
  label: string;
  description?: string;
  dataType: string;
  required: boolean;
  part: string;
  order: number;
}

interface EnumerationOption {
  value: string;
  label: string;
}
```

---

### GET /api/taxonomy/enumerations/:domain

Get enumeration options for a domain.

#### Response (200 OK)

```typescript
interface EnumerationResponse {
  success: true;
  data: {
    domain: string;
    options: EnumerationOption[];
  };
}
```

---

### POST /api/lei/validate

Validate a Legal Entity Identifier.

#### Request

```typescript
interface LEIValidateRequest {
  lei: string;
  checkGLEIF?: boolean;  // Default: false (format only)
}
```

#### Response (200 OK)

```typescript
interface LEIValidateResponse {
  success: true;
  data: {
    lei: string;
    valid: boolean;
    formatValid: boolean;
    checksumValid: boolean;
    gleifStatus?: {
      found: boolean;
      entityName?: string;
      status?: 'ISSUED' | 'LAPSED' | 'PENDING';
      country?: string;
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
  documentDate: string;  // ISO date
  language: string;      // ISO 639-1

  // Part A: Offeror
  partA: {
    legalName: string;
    lei: string;
    registeredAddress: string;
    country: string;
    website?: string;
    contactEmail?: string;
    contactPhone?: string;
  };

  // Part B: Issuer (if different)
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
    renewableEnergyPercentage?: number;
    ghgEmissions?: number;
  };

  // Management body members
  managementBodyMembers?: {
    offeror: ManagementBodyMember[];
    issuer?: ManagementBodyMember[];
    operator?: ManagementBodyMember[];
  };

  // Project persons
  projectPersons?: ProjectPerson[];
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

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/upload | 10 | 1 minute |
| POST /api/validate | 30 | 1 minute |
| POST /api/generate | 10 | 1 minute |
| GET /api/* | 60 | 1 minute |

When rate limited, response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706400000
```

---

## Webhook Events (Phase 4)

### Event Types

| Event | Description |
|-------|-------------|
| `upload.complete` | PDF extraction completed |
| `validation.complete` | Validation finished |
| `generation.complete` | iXBRL document generated |
| `session.expired` | Session data deleted |

### Webhook Payload

```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    sessionId: string;
    // Event-specific data
  };
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| FILE_TOO_LARGE | 413 | File exceeds size limit |
| INVALID_FILE_TYPE | 415 | Unsupported file type |
| INVALID_TOKEN_TYPE | 400 | Token type must be OTHR, ART, or EMT |
| SESSION_NOT_FOUND | 404 | Session ID not found |
| SESSION_EXPIRED | 410 | Session has expired |
| VALIDATION_FAILED | 422 | Validation errors present |
| GENERATION_FAILED | 500 | iXBRL generation failed |
| LEI_INVALID | 400 | LEI format or checksum invalid |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |
