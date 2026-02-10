# Test Strategy - WhitePaper XBRL

## Overview

This document outlines the testing strategy for the WhitePaper XBRL platform, including test types, coverage targets, and best practices.

---

## Current Test Status

### Existing Test Files (13 unit + 1 E2E)

| File | Category | Description |
|------|----------|-------------|
| `tests/lib/pdf/extractor.test.ts` | Unit | PDF text extraction |
| `tests/lib/pdf/field-mapper.test.ts` | Unit | Field mapping extraction |
| `tests/lib/xbrl/validator/lei-validator.test.ts` | Unit | LEI format + checksum |
| `tests/lib/xbrl/validator/existence-engine.test.ts` | Unit | Existence assertions |
| `tests/lib/xbrl/validator/value-engine.test.ts` | Unit | Value assertions |
| `tests/lib/xbrl/validator/duplicate-detector.test.ts` | Unit | Duplicate fact detection |
| `tests/lib/xbrl/validator/gleif-lookup.test.ts` | Unit | GLEIF LEI lookup |
| `tests/lib/xbrl/taxonomy/registry.test.ts` | Unit | Taxonomy loading |
| `tests/lib/xbrl/generator/document-generator.test.ts` | Unit | iXBRL document generation |
| `tests/lib/xbrl/generator/template/inline-tagger.test.ts` | Unit | Inline XBRL tagging |
| `tests/lib/xbrl/generator/template/language-support.test.ts` | Unit | Multi-language validation |
| `tests/lib/security/sanitize.test.ts` | Unit | Sanitization functions |
| `tests/lib/utils.test.ts` | Unit | Utility functions |
| `tests/e2e/home.spec.ts` | E2E | Home page upload workflow |

### Known Gaps

- **Test fixtures are empty**: `tests/fixtures/pdfs/` and `tests/fixtures/whitepapers/` directories exist but contain no files
- **No API route tests**: `tests/api/` directory is empty — no tests for upload, validate, or generate endpoints
- **No integration test utilities**: `tests/utils/` has no mock-request or XML validator helpers
- **No iXBRL generator tests**: No tests for `document-generator.ts`, `context-builder.ts`, or `fact-builder.ts`
- **No component tests**: No React component tests for UploadZone, field editors, or ValidationDashboard

---

## Testing Pyramid

```
                    ┌─────────────────┐
                    │      E2E        │  ~5%
                    │    (Playwright) │
                    ├─────────────────┤
                    │   Integration   │  ~20%
                    │   (API Tests)   │
                    ├─────────────────┤
                    │                 │
                    │      Unit       │  ~75%
                    │    (Vitest)     │
                    │                 │
                    └─────────────────┘
```

---

## Test Framework Setup

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Setup File

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock fetch for API tests
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Unit Tests

### Test Categories

#### 1. Type/Schema Tests

Test Zod schemas and type validations.

```typescript
// tests/types/xbrl.test.ts
import { describe, it, expect } from 'vitest';
import { XBRLContextSchema, LEISchema } from '@/types/xbrl';

describe('XBRL Types', () => {
  describe('LEI Schema', () => {
    it('should accept valid LEI format', () => {
      const result = LEISchema.safeParse('5493001KJTIIGC8Y1R12');
      expect(result.success).toBe(true);
    });

    it('should reject invalid LEI format', () => {
      const result = LEISchema.safeParse('INVALID');
      expect(result.success).toBe(false);
    });

    it('should reject LEI with lowercase', () => {
      const result = LEISchema.safeParse('5493001kjtiigc8y1r12');
      expect(result.success).toBe(false);
    });
  });

  describe('XBRLContext Schema', () => {
    it('should require entity identifier', () => {
      const result = XBRLContextSchema.safeParse({
        id: 'ctx1',
        period: { instant: '2025-01-27' },
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid instant period', () => {
      const result = XBRLContextSchema.safeParse({
        id: 'ctx1',
        entity: {
          identifier: '5493001KJTIIGC8Y1R12',
          scheme: 'http://standards.iso.org/iso/17442',
        },
        period: { instant: '2025-01-27' },
      });
      expect(result.success).toBe(true);
    });
  });
});
```

#### 2. Taxonomy Tests

Test taxonomy loading and element lookup.

```typescript
// tests/lib/xbrl/taxonomy/registry.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { TaxonomyRegistry } from '@/lib/xbrl/taxonomy/registry';

describe('TaxonomyRegistry', () => {
  let registry: TaxonomyRegistry;

  beforeAll(async () => {
    registry = new TaxonomyRegistry();
    await registry.load('OTHR');
  });

  it('should load all required elements for OTHR', () => {
    const element = registry.getElement('mica:OfferorLegalEntityIdentifier');
    expect(element).toBeDefined();
    expect(element?.dataType).toBe('leiItemType');
  });

  it('should return English labels by default', () => {
    const label = registry.getLabel('mica:CryptoAssetName');
    expect(label).toBe('Crypto-asset name');
  });

  it('should return enumeration options', () => {
    const options = registry.getEnumOptions('mica:HomeMemberStateDomain');
    expect(options).toContain('MT'); // Malta
    expect(options.length).toBeGreaterThan(25);
  });
});
```

#### 3. Validation Tests

Test validation assertions.

```typescript
// tests/lib/xbrl/validator/assertions.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateExistenceAssertions,
  validateValueAssertions,
  validateLEI,
} from '@/lib/xbrl/validator';
import {
  createMinimalWhitepaper,
  createCompleteWhitepaper,
} from '../fixtures/whitepapers';

describe('Validation Assertions', () => {
  describe('Existence Assertions', () => {
    it('should fail when required LEI is missing', () => {
      const data = createMinimalWhitepaper({ offerorLEI: undefined });
      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          ruleId: 'EXS-T2-001',
          severity: 'ERROR',
        })
      );
    });

    it('should pass when all required fields present', () => {
      const data = createCompleteWhitepaper();
      const result = validateExistenceAssertions(data, 'OTHR');

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Value Assertions', () => {
    it('should validate date ordering', () => {
      const data = createCompleteWhitepaper({
        partE: {
          publicOfferingStartDate: '2025-12-31',
          publicOfferingEndDate: '2025-12-01', // Before start!
        },
      });
      const result = validateValueAssertions(data, 'OTHR');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          ruleId: 'VAL-001',
        })
      );
    });

    it('should validate total supply is positive', () => {
      const data = createCompleteWhitepaper({
        partD: { totalSupply: -100 },
      });
      const result = validateValueAssertions(data, 'OTHR');

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          ruleId: 'VAL-002',
        })
      );
    });
  });

  describe('LEI Validation', () => {
    it('should validate correct LEI checksum', () => {
      const result = validateLEI('5493001KJTIIGC8Y1R12');
      expect(result.valid).toBe(true);
      expect(result.checksumValid).toBe(true);
    });

    it('should reject invalid LEI checksum', () => {
      const result = validateLEI('5493001KJTIIGC8Y1R99');
      expect(result.valid).toBe(false);
      expect(result.checksumValid).toBe(false);
    });
  });
});
```

#### 4. Generator Tests

Test iXBRL generation.

```typescript
// tests/lib/xbrl/generator/document-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateIXBRL } from '@/lib/xbrl/generator';
import { createCompleteWhitepaper } from '../fixtures/whitepapers';
import { validateXML } from '../utils/xml-validator';

describe('iXBRL Generator', () => {
  it('should generate valid XHTML document', async () => {
    const data = createCompleteWhitepaper();
    const result = await generateIXBRL(data, 'OTHR');

    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('xmlns:ix=');
    expect(result).toContain('xmlns:mica=');
  });

  it('should include all required namespaces', async () => {
    const data = createCompleteWhitepaper();
    const result = await generateIXBRL(data, 'OTHR');

    const requiredNamespaces = [
      'http://www.xbrl.org/2003/instance',
      'http://www.xbrl.org/2013/inlineXBRL',
      'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
    ];

    for (const ns of requiredNamespaces) {
      expect(result).toContain(ns);
    }
  });

  it('should generate valid XML', async () => {
    const data = createCompleteWhitepaper();
    const result = await generateIXBRL(data, 'OTHR');

    const validation = await validateXML(result);
    expect(validation.valid).toBe(true);
  });

  it('should use escape="true" for text blocks', async () => {
    const data = createCompleteWhitepaper({
      partD: { projectDescription: '<p>Test description</p>' },
    });
    const result = await generateIXBRL(data, 'OTHR');

    expect(result).toContain('escape="true"');
  });

  it('should not include prohibited content', async () => {
    const data = createCompleteWhitepaper();
    const result = await generateIXBRL(data, 'OTHR');

    expect(result).not.toContain('<script');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('onclick=');
  });
});
```

#### 5. PDF Extraction Tests

Test PDF parsing and field mapping.

```typescript
// tests/lib/pdf/extractor.test.ts
import { describe, it, expect } from 'vitest';
import { extractWhitepaper } from '@/lib/pdf/extractor';
import { readFile } from 'fs/promises';
import path from 'path';

describe('PDF Extractor', () => {
  it('should extract text from valid PDF', async () => {
    const buffer = await readFile(
      path.join(__dirname, '../fixtures/pdfs/minimal-othr.pdf')
    );
    const result = await extractWhitepaper(buffer);

    expect(result.text.length).toBeGreaterThan(100);
    expect(result.pages).toBeGreaterThan(0);
  });

  it('should detect document sections', async () => {
    const buffer = await readFile(
      path.join(__dirname, '../fixtures/pdfs/persija-whitepaper.pdf')
    );
    const result = await extractWhitepaper(buffer);

    expect(result.sections.has('partA')).toBe(true);
    expect(result.sections.has('partD')).toBe(true);
    expect(result.sections.has('partE')).toBe(true);
  });

  it('should extract LEI correctly', async () => {
    const buffer = await readFile(
      path.join(__dirname, '../fixtures/pdfs/persija-whitepaper.pdf')
    );
    const result = await extractWhitepaper(buffer);

    expect(result.data.partA.lei).toMatch(/^[A-Z0-9]{20}$/);
  });

  it('should calculate confidence scores', async () => {
    const buffer = await readFile(
      path.join(__dirname, '../fixtures/pdfs/minimal-othr.pdf')
    );
    const result = await extractWhitepaper(buffer);

    expect(result.confidence.overall).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(100);
  });
});
```

---

## Integration Tests

### API Endpoint Tests

```typescript
// tests/api/upload.test.ts
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/upload/route';
import { createMockRequest } from '../utils/mock-request';

describe('POST /api/upload', () => {
  it('should accept valid PDF upload', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['%PDF-1.4...'], { type: 'application/pdf' }));
    formData.append('tokenType', 'OTHR');

    const request = createMockRequest('POST', formData);
    const response = await POST(request);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
  });

  it('should reject non-PDF files', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['not a pdf'], { type: 'text/plain' }));

    const request = createMockRequest('POST', formData);
    const response = await POST(request);

    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('should enforce file size limit', async () => {
    const largeContent = Buffer.alloc(51 * 1024 * 1024); // 51MB
    const formData = new FormData();
    formData.append('file', new Blob([largeContent], { type: 'application/pdf' }));

    const request = createMockRequest('POST', formData);
    const response = await POST(request);

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error.code).toBe('FILE_TOO_LARGE');
  });
});
```

```typescript
// tests/api/validate.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/validate/route';
import { createMockRequest } from '../utils/mock-request';
import { createCompleteWhitepaper } from '../fixtures/whitepapers';

describe('POST /api/validate', () => {
  it('should return validation results', async () => {
    const request = createMockRequest('POST', {
      data: createCompleteWhitepaper(),
      tokenType: 'OTHR',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.summary.totalAssertions).toBeGreaterThan(0);
  });

  it('should return errors for invalid data', async () => {
    const request = createMockRequest('POST', {
      data: { partA: {} }, // Missing required fields
      tokenType: 'OTHR',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.valid).toBe(false);
    expect(body.data.errors.length).toBeGreaterThan(0);
  });
});
```

---

## E2E Tests

### Full Workflow Test

```typescript
// tests/e2e/full-workflow.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Full Transformation Workflow', () => {
  test('should complete OTHR token transformation', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /whitepaper xbrl/i })).toBeVisible();

    // 2. Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, '../fixtures/pdfs/minimal-othr.pdf')
    );

    // 3. Wait for extraction
    await expect(page.getByText(/extraction complete/i)).toBeVisible({
      timeout: 30000,
    });

    // 4. Select token type
    await page.getByRole('radio', { name: /othr/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // 5. Review fields
    await expect(page.getByRole('heading', { name: /review fields/i })).toBeVisible();

    // 6. Fill any missing required fields
    const leiInput = page.getByLabel(/lei/i);
    if (await leiInput.inputValue() === '') {
      await leiInput.fill('5493001KJTIIGC8Y1R12');
    }

    // 7. Run validation
    await page.getByRole('button', { name: /validate/i }).click();
    await expect(page.getByText(/validation complete/i)).toBeVisible({
      timeout: 10000,
    });

    // 8. Check for no errors
    await expect(page.getByText(/0 errors/i)).toBeVisible();

    // 9. Generate iXBRL
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.getByText(/generation complete/i)).toBeVisible({
      timeout: 10000,
    });

    // 10. Download file
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.xhtml$/);
  });

  test('should show validation errors', async ({ page }) => {
    await page.goto('/');

    // Upload minimal PDF without all required fields
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(
      path.join(__dirname, '../fixtures/pdfs/incomplete-whitepaper.pdf')
    );

    await expect(page.getByText(/extraction complete/i)).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole('radio', { name: /othr/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();

    // Run validation without fixing fields
    await page.getByRole('button', { name: /validate/i }).click();
    await expect(page.getByText(/validation complete/i)).toBeVisible();

    // Should show errors
    const errorCount = page.getByTestId('error-count');
    await expect(errorCount).not.toHaveText('0');

    // Generate button should be disabled
    const generateButton = page.getByRole('button', { name: /generate/i });
    await expect(generateButton).toBeDisabled();
  });
});
```

### Accessibility Test

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {
  test('home page should have no accessibility violations', async ({ page }) => {
    await page.goto('/');

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test('form fields should be properly labeled', async ({ page }) => {
    await page.goto('/transform/test-session');

    const results = await new AxeBuilder({ page })
      .include('form')
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
```

---

## Test Fixtures

### Whitepaper Fixtures

```typescript
// tests/fixtures/whitepapers.ts
import { WhitepaperData } from '@/types/whitepaper';
import { deepMerge } from '@/lib/utils';

export function createMinimalWhitepaper(
  overrides?: Partial<WhitepaperData>
): WhitepaperData {
  const minimal: WhitepaperData = {
    tokenType: 'OTHR',
    documentDate: '2025-01-27',
    language: 'en',
    partA: {
      legalName: 'Test Company AG',
      lei: '5493001KJTIIGC8Y1R12',
      registeredAddress: 'Test Street 1, Zurich',
      country: 'CH',
    },
    partD: {
      cryptoAssetName: 'TestToken',
      cryptoAssetSymbol: 'TEST',
      totalSupply: 1000000,
      projectDescription: 'A test token for testing.',
    },
    partE: {
      isPublicOffering: false,
    },
    partF: {
      classification: 'Other crypto-asset',
      rightsDescription: 'No rights attached.',
    },
    partG: {},
    partH: {
      blockchainDescription: 'Ethereum-based token.',
    },
    partI: {
      offerRisks: ['Market risk'],
      issuerRisks: ['Operational risk'],
      marketRisks: ['Volatility'],
      technologyRisks: ['Smart contract risk'],
      regulatoryRisks: ['Regulatory uncertainty'],
    },
    partJ: {},
  };

  return deepMerge(minimal, overrides || {});
}

export function createCompleteWhitepaper(
  overrides?: Partial<WhitepaperData>
): WhitepaperData {
  return deepMerge(createMinimalWhitepaper(), {
    partA: {
      website: 'https://example.com',
      contactEmail: 'contact@example.com',
    },
    partE: {
      isPublicOffering: true,
      publicOfferingStartDate: '2025-02-01',
      publicOfferingEndDate: '2025-02-28',
      tokenPrice: 1.0,
      tokenPriceCurrency: 'EUR',
      maxSubscriptionGoal: 100000,
      withdrawalRights: true,
    },
    partJ: {
      energyConsumption: 100,
      energyUnit: 'kWh',
      consensusMechanismType: 'POS',
    },
    managementBodyMembers: {
      offeror: [
        {
          identity: 'John Doe',
          businessAddress: 'Test Street 1, Zurich',
          function: 'CEO',
        },
      ],
    },
    ...overrides,
  });
}
```

---

## Test Utilities

### Mock Request Helper

```typescript
// tests/utils/mock-request.ts
export function createMockRequest(
  method: string,
  body: unknown
): Request {
  const headers = new Headers();

  if (body instanceof FormData) {
    // Let fetch set the content-type for FormData
    return new Request('http://localhost:3000/api/test', {
      method,
      body,
    });
  }

  headers.set('Content-Type', 'application/json');
  return new Request('http://localhost:3000/api/test', {
    method,
    headers,
    body: JSON.stringify(body),
  });
}
```

### XML Validator

```typescript
// tests/utils/xml-validator.ts
import { parseStringPromise } from 'xml2js';

export async function validateXML(xml: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    await parseStringPromise(xml);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

## Coverage Requirements

### Minimum Coverage Targets

| Category | Lines | Branches | Functions |
|----------|-------|----------|-----------|
| Overall | 80% | 80% | 80% |
| lib/xbrl | 90% | 85% | 90% |
| lib/pdf | 80% | 75% | 80% |
| components | 70% | 70% | 70% |
| api | 85% | 80% | 85% |

### Running Coverage

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/index.html
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run type-check

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Test Commands Reference

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/lib/xbrl/validator/__tests__/assertions.test.ts

# Run tests matching pattern
npm test -- --grep "LEI"

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests headed (visible browser)
npm run test:e2e -- --headed

# Run E2E tests for specific browser
npm run test:e2e -- --project=chromium

# Debug E2E test
npm run test:e2e -- --debug
```
