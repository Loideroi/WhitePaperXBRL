# WhitePaper XBRL - Phased Implementation Plan

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Project Setup | **COMPLETE** | Next.js 16, TypeScript strict, Vitest, Playwright |
| Phase 1: Core Types & Taxonomy | **COMPLETE** | Types defined, taxonomy bundled as JSON |
| Phase 2: Document Processing | **COMPLETE** | Multi-format: PDF, DOCX, ODT, RTF via `pdf-parse` + `officeparser` |
| Phase 3: User Interface | **PARTIAL** | UploadZone done, transform page exists, preview page empty |
| Phase 4: iXBRL Generation | **COMPLETE** | document-generator, context-builder, fact-builder, template system |
| Phase 5: Validation Engine | **COMPLETE** | orchestrator, existence-engine, value-engine, lei-validator |
| Phase 6: Integration & Polish | **IN PROGRESS** | End-to-end flow needs completion |
| Phase 7: Testing & Security | **IN PROGRESS** | 8 unit test files + 1 E2E test; fixture dirs empty |
| Phase 8: Deployment | **NOT STARTED** | Vercel config pending |

### Key Implementation Deviations from Plan

- **Multi-format support** added (DOCX, ODT, RTF via `officeparser`) — not in original plan
- **Taxonomy** is bundled as JSON (`src/lib/xbrl/taxonomy/data/taxonomy-bundle.json`), not loaded from XSD at runtime
- **Validation assertions** are coded directly in engine files, not parsed from formula linkbase XML
- **No `pdfjs-dist`** dependency — only `pdf-parse` is used for PDF extraction
- **No Supabase/Redis** integration — sessions are in-memory only (Phase 1 scope)

---

## Overview

This document outlines the phased implementation approach for building the WhitePaper XBRL platform using Claude Code best practices.

---

## Best Practices for Claude-Assisted Development

### 1. Context Management

**Problem:** Claude has limited context windows and loses track of complex projects.

**Solutions Applied:**
- **CLAUDE.md**: Project-specific instructions at root level
- **agent_docs/**: Detailed documentation for specific domains
- **Modular Architecture**: Small, focused files (<300 lines each)
- **Clear Naming**: Files named to describe their purpose
- **Type Definitions First**: Define types before implementation

### 2. Incremental Development

**Approach:**
- Build and test each module independently
- Commit frequently with clear messages
- Run tests after each significant change
- Use feature flags for incomplete features

### 3. Documentation-Driven

**For Each Feature:**
1. Document the feature in agent_docs
2. Define types in /types
3. Write tests first (TDD when appropriate)
4. Implement the feature
5. Update CLAUDE.md if new patterns emerge

---

## Phase 0: Project Setup (Day 1)

### 0.1 Initialize Project

```bash
# Create Next.js project
npx create-next-app@latest whitepaper-xbrl --typescript --tailwind --app --src-dir

# Install core dependencies
npm install zod lucide-react class-variance-authority clsx tailwind-merge

# Install shadcn/ui
npx shadcn-ui@latest init

# Install document processing
npm install pdf-parse officeparser

# Install testing
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright

# Install dev tools
npm install -D @types/node prettier eslint-config-prettier
```

### 0.2 Configure TypeScript Strict Mode

```json
// tsconfig.json additions
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

### 0.3 Set Up Project Structure

Create the directory structure as defined in CLAUDE.md.

### 0.4 Configure Testing

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### 0.5 Deliverables Checklist

- [ ] Next.js project initialized
- [ ] TypeScript strict mode configured
- [ ] Directory structure created
- [ ] Testing framework configured
- [ ] Linting and formatting configured
- [ ] CLAUDE.md in place
- [ ] Git repository initialized
- [ ] Initial commit made

---

## Phase 1: Core Types and Taxonomy (Week 1)

### 1.1 Define XBRL Types

**File:** `src/types/xbrl.ts`

Key types to define:
- `XBRLContext` - Entity, period, scenario
- `XBRLFact` - Tagged data values
- `XBRLUnit` - Monetary, pure, etc.
- `IXBRLDocument` - Complete document structure

**Tests:** `tests/types/xbrl.test.ts`
- Type validation tests using Zod schemas

### 1.2 Define Taxonomy Types

**File:** `src/types/taxonomy.ts`

Key types:
- `TaxonomyElement` - Single XBRL element
- `TaxonomyTable` - Table structure (2, 3, 4)
- `EnumerationDomain` - Dropdown options
- `TypedDimension` - For management body members

### 1.3 Implement Taxonomy Loader

**File:** `src/lib/xbrl/taxonomy/loader.ts`

Load and parse ESMA taxonomy files:
- Parse XSD schemas
- Load label linkbases (start with English)
- Load enumeration domains
- Build element registry

**Tests:**
- Verify all required elements loaded
- Verify labels in correct language
- Verify enumeration options complete

### 1.4 Create Element Registry

**File:** `src/lib/xbrl/taxonomy/registry.ts`

Efficient lookup for taxonomy elements:
- By element name
- By table (OTHR, ART, EMT)
- By part (A, B, C, D, etc.)

### 1.5 Deliverables Checklist

- [ ] XBRL types defined with Zod schemas
- [ ] Taxonomy types defined
- [ ] Taxonomy loader implemented
- [ ] Element registry implemented
- [ ] 100% test coverage on types
- [ ] Documentation in agent_docs/xbrl-taxonomy.md

---

## Phase 2: PDF Processing (Week 2)

### 2.1 PDF Upload Handler

**File:** `src/app/api/upload/route.ts`

Functionality:
- Accept PDF uploads (max 50MB)
- Validate file type server-side
- Generate unique session ID
- Store temporarily in memory (session persistence via database is a future roadmap item)
- Return session ID to client

**Security Checks:**
- File type validation (magic bytes, not extension)
- File size limit enforcement
- Rate limiting per IP

### 2.2 PDF Text Extraction

**File:** `src/lib/pdf/extractor.ts`

Extract content from PDF:
- Full text extraction
- Table structure detection
- Page-by-page processing
- Handle multi-column layouts

**Tests:** Use sample PDFs from `tests/fixtures/pdfs/`

### 2.3 Field Mapper

**File:** `src/lib/pdf/field-mapper.ts`

Map extracted text to taxonomy fields:
- Pattern matching for known field labels
- Section detection (Part A, B, C, etc.)
- Value extraction and normalization
- Confidence scoring for each mapping

### 2.4 Whitepaper Data Model

**File:** `src/types/whitepaper.ts`

Structured representation of extracted data:
- Matches taxonomy structure
- Includes mapping confidence
- Supports manual overrides

### 2.5 Deliverables Checklist

- [ ] Upload API endpoint functional
- [ ] PDF text extraction working
- [ ] Field mapper implemented
- [ ] Tested with example $PERSIJA whitepaper
- [ ] Security checks implemented
- [ ] Documentation in agent_docs/pdf-extraction.md

---

## Phase 3: User Interface (Week 3)

### 3.1 Upload Component

**File:** `src/components/upload/UploadZone.tsx`

Features:
- Drag-and-drop support
- Progress indicator
- Error display
- File type validation (client-side)

### 3.2 Token Type Selector

**File:** `src/components/upload/TokenTypeSelector.tsx`

Selection UI for:
- OTHR (Crypto-asset other than ART/EMT)
- ART (Asset-Referenced Token)
- EMT (E-Money Token)

### 3.3 Field Editor

**File:** `src/components/editor/FieldEditor.tsx`

Features:
- Display all mapped fields
- Show extraction confidence
- Allow manual editing
- Highlight required fields
- Show validation errors inline

Sub-components:
- `TextField` - Simple text input
- `DateField` - Date picker
- `MonetaryField` - Amount + currency
- `EnumerationField` - Dropdown from taxonomy
- `BooleanField` - Yes/No toggle
- `TextBlockField` - Rich text editor
- `ManagementBodyTable` - Dynamic rows for typed dimensions

### 3.4 Validation Dashboard

**File:** `src/components/validation/ValidationDashboard.tsx`

Features:
- Overall validation status
- Error list with field links
- Warning list (SHOULD fix)
- Validation progress indicator

### 3.5 Page Routes

**Files:**
- `src/app/page.tsx` - Home/upload page
- `src/app/transform/[id]/page.tsx` - Transformation workflow
- `src/app/preview/[id]/page.tsx` - iXBRL preview

### 3.6 Deliverables Checklist

- [ ] Upload component functional
- [ ] Token type selector working
- [ ] Field editor complete for all field types
- [ ] Validation dashboard showing errors
- [ ] Full workflow navigable
- [ ] Responsive design for tablet
- [ ] Accessibility audit passed

---

## Phase 4: iXBRL Generation (Week 4)

### 4.1 Context Builder

**File:** `src/lib/xbrl/generator/context-builder.ts`

Generate XBRL contexts:
- Entity identifier (LEI)
- Period (instant or duration)
- Scenario (for dimensional data)

### 4.2 Fact Builder

**File:** `src/lib/xbrl/generator/fact-builder.ts`

Generate XBRL facts:
- Proper formatting per data type
- Unique fact IDs
- Correct escape attributes
- Unit references for monetary values

### 4.3 Inline XBRL Wrapper

**File:** `src/lib/xbrl/generator/ixbrl-wrapper.ts`

Wrap facts in HTML structure:
- Proper namespace declarations
- DOCTYPE and HTML5 structure
- CSS styling for readability
- ix:header with hidden block
- ix:nonNumeric and ix:nonFraction elements

### 4.4 Document Generator

**File:** `src/lib/xbrl/generator/document-generator.ts`

Orchestrate full document generation:
- Collect all whitepaper data
- Build contexts
- Build facts
- Wrap in iXBRL structure
- Generate final XHTML string

### 4.5 Output Validator

**File:** `src/lib/xbrl/generator/output-validator.ts`

Validate generated iXBRL:
- Well-formed XML check
- Namespace validation
- No prohibited content (scripts, etc.)
- Required elements present

### 4.6 Deliverables Checklist

- [ ] Context builder working for all scenarios
- [ ] Fact builder handling all data types
- [ ] iXBRL wrapper generating valid structure
- [ ] Document generator producing complete files
- [ ] Output passes XML validation
- [ ] Generated files render in browser
- [ ] Documentation in agent_docs/ixbrl-generation.md

---

## Phase 5: Validation Engine (Week 5-6)

### 5.1 Assertion Parser

**File:** `src/lib/xbrl/validator/assertion-parser.ts`

Parse ESMA formula assertions:
- Read mica-for-{table}.xml files
- Extract existence assertions
- Extract value assertions
- Build executable validation rules

### 5.2 Existence Assertion Engine

**File:** `src/lib/xbrl/validator/existence-engine.ts`

Validate required fields:
- Check for presence of required facts
- Handle conditional requirements
- Generate meaningful error messages

### 5.3 Value Assertion Engine

**File:** `src/lib/xbrl/validator/value-engine.ts`

Validate field values:
- Cross-field comparisons
- Format validations
- Range checks
- Enumeration membership

### 5.4 LEI Validator

**File:** `src/lib/xbrl/validator/lei-validator.ts`

Validate Legal Entity Identifiers:
- Format check (20 alphanumeric)
- Checksum validation
- Optional: GLEIF API lookup

### 5.5 Validation Orchestrator

**File:** `src/lib/xbrl/validator/orchestrator.ts`

Run all validations:
- Collect all assertions for token type
- Execute in order
- Aggregate results
- Categorize by severity (ERROR/WARNING)

### 5.6 Validation API

**File:** `src/app/api/validate/route.ts`

API endpoint for validation:
- Accept whitepaper data
- Run all assertions
- Return structured results

### 5.7 Deliverables Checklist

- [ ] All 257 existence assertions implemented
- [ ] All 223 value assertions implemented
- [ ] LEI validation working
- [ ] Validation API functional
- [ ] Error messages clear and actionable
- [ ] Performance: <10 seconds for full validation
- [ ] Documentation in agent_docs/validation-rules.md

---

## Phase 6: Integration and Polish (Week 7)

### 6.1 End-to-End Flow

Complete the full workflow:
1. Upload PDF
2. Select token type
3. Review/edit fields
4. Run validation
5. Fix errors
6. Generate iXBRL
7. Preview and download

### 6.2 Error Handling

Implement comprehensive error handling:
- PDF parsing failures
- Network errors
- Validation failures
- Generation errors
- User-friendly error messages

### 6.3 Loading States

Add loading indicators:
- Upload progress
- Extraction progress
- Validation progress
- Generation progress

### 6.4 Preview Mode

**File:** `src/app/preview/[id]/page.tsx`

iXBRL preview functionality:
- Render iXBRL in iframe
- Highlight tagged elements
- Toggle XBRL visibility
- Download button

### 6.5 Deliverables Checklist

- [ ] Full workflow functional end-to-end
- [ ] Error handling comprehensive
- [ ] Loading states smooth
- [ ] Preview mode working
- [ ] Mobile/tablet responsive
- [ ] Performance optimized

---

## Phase 6a: Real-World Testing Fixes

### Problem

Testing with real whitepapers (ARG and SPURS) revealed that **numeric taxonomy fields were being tagged as `ix:nonFraction` but contained narrative text instead of numbers**, and were **missing required `unitRef` attributes**. This produces invalid iXBRL that fails ESMA validation.

**Affected fields include:**

| Field | Element | Data Type | Raw Content | Issue |
|-------|---------|-----------|-------------|-------|
| A.10 | `OfferorsResponseTimeDays` | integerItemType | "(Days) Response time: 7 days." | Text in nonFraction, no unitRef |
| C.10 | `NumberOfUnits` | integerItemType | "Non-applicability of Part C…" | Text in nonFraction, no unitRef |
| E.4 | `MinimumSubscriptionGoalExpressedInCurrency` | monetaryItemType | "No minimum goal." | Text in nonFraction, no unitRef |
| S.10+ | `RenewableEnergyConsumptionPercentage` | percentItemType | "Not applicable" | Text in nonFraction, no unitRef |

### Root Cause

1. **rawFields fallback ignores data types**: When a field is not extracted via typed extraction, the fallback to `rawFields` (raw PDF text) sets no `unitRef` or `decimals`, and passes raw narrative text as the value.
2. **No numeric content validation**: The inline tagger blindly wraps any value in `ix:nonFraction` if the field's data type is numeric, even when the content is text.

### Fix (3-Part)

1. **`inline-tagger.ts`**: Added `isValueNumeric()` function. Modified `wrapInlineTag()` to fall back to `ix:nonNumeric` (with `escape="false"`) when a numeric field contains non-numeric content.
2. **`document-generator.ts`**: Added `getDefaultDecimals()` and `tryExtractNumericValue()` helpers. The rawFields fallback loop now computes and attaches default `unitRef`/`decimals` for numeric fields, and attempts to extract numeric values from narrative text (e.g., "7" from "(Days) Response time: 7 days.").
3. **Tests**: Added `inline-tagger.test.ts` (isValueNumeric, wrapInlineTag fallback, getUnitRefForType) and `document-generator.test.ts` (rawFields numeric handling, iXBRL output verification).

### Verification

- Re-process ARG and SPURS whitepapers and confirm:
  - Numeric fields with valid numbers produce `ix:nonFraction` with `unitRef`
  - Numeric fields with text content produce `ix:nonNumeric` (valid fallback)
  - No `ix:nonFraction` elements appear without `unitRef`

---

## Phase 7: Testing and Security (Week 8)

### 7.1 Unit Tests

Target: >80% coverage on core libraries

Key test files:
- `tests/lib/xbrl/taxonomy/*.test.ts`
- `tests/lib/xbrl/generator/*.test.ts`
- `tests/lib/xbrl/validator/*.test.ts`
- `tests/lib/pdf/*.test.ts`

### 7.2 Integration Tests

Test API endpoints:
- `tests/api/upload.test.ts`
- `tests/api/validate.test.ts`
- `tests/api/generate.test.ts`

### 7.3 E2E Tests

**File:** `tests/e2e/full-workflow.spec.ts`

Using Playwright:
- Upload sample PDF
- Complete field editing
- Run validation
- Generate and download

### 7.4 Security Audit

See `docs/agent_docs/security-model.md` for full details.

Key areas:
- [ ] File upload validation
- [ ] Input sanitization
- [ ] Output safety (no XSS in iXBRL)
- [ ] Rate limiting
- [ ] Error message safety (no info leakage)

### 7.5 Performance Testing

- PDF processing time
- Validation time
- Generation time
- Memory usage

### 7.6 Deliverables Checklist

- [ ] Unit test coverage >80%
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Security audit complete
- [ ] Performance benchmarks documented
- [ ] No critical/high vulnerabilities

---

## Phase 8: Deployment (Week 9)

### 8.1 Vercel Configuration

**File:** `vercel.json`

```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ]
}
```

### 8.2 Environment Setup

Configure Vercel environment variables:
- Production secrets
- Feature flags
- API keys (if any)

### 8.3 Monitoring

Set up:
- Vercel Analytics
- Error tracking (Sentry or similar)
- Uptime monitoring

### 8.4 Documentation

- User guide
- API documentation
- Troubleshooting guide

### 8.5 Deliverables Checklist

- [ ] Deployed to Vercel
- [ ] Custom domain configured
- [ ] SSL/HTTPS working
- [ ] Monitoring active
- [ ] Documentation complete
- [ ] Team access configured

---

## Task Breakdown Summary

| Phase | Tasks | Est. Effort |
|-------|-------|-------------|
| 0. Setup | 5 tasks | 1 day |
| 1. Types/Taxonomy | 5 tasks | 1 week |
| 2. PDF Processing | 5 tasks | 1 week |
| 3. User Interface | 6 tasks | 1 week |
| 4. iXBRL Generation | 6 tasks | 1 week |
| 5. Validation Engine | 7 tasks | 2 weeks |
| 6. Integration | 5 tasks | 1 week |
| 7. Testing/Security | 6 tasks | 1 week |
| 8. Deployment | 5 tasks | 1 week |
| **Total** | **50 tasks** | **~9 weeks** |

---

## Claude Code Workflow for Each Task

For each task, follow this workflow:

1. **Read Context**: Start by reading relevant files in `docs/agent_docs/`
2. **Check Types**: Review types in `src/types/` before implementing
3. **Write Tests First**: Create test file with expected behavior
4. **Implement**: Write the implementation code
5. **Run Tests**: Verify tests pass
6. **Update Docs**: Update agent_docs if patterns change
7. **Commit**: Make atomic commits with clear messages

### Example Task Flow

```
User: Implement the LEI validator

Claude:
1. Read docs/agent_docs/validation-rules.md
2. Read src/types/xbrl.ts for LEI type
3. Create tests/lib/xbrl/validator/lei-validator.test.ts
4. Implement src/lib/xbrl/validator/lei-validator.ts
5. Run: npm test -- lei-validator
6. Update agent_docs if needed
7. Commit: "feat(validation): implement LEI format and checksum validation"
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Complex PDF layouts fail extraction | Provide manual entry fallback; improve extraction iteratively |
| ESMA taxonomy updates | Version taxonomy in code; monitor ESMA publications |
| Validation performance | Cache parsed assertions; optimize hot paths |
| Browser compatibility | Test across browsers; use progressive enhancement |
| Large file handling | Stream processing; show progress; set limits |

---

## Success Criteria

Phase is complete when:

1. All deliverables checked off
2. Tests pass with >80% coverage
3. No TypeScript errors
4. Linting passes
5. Code reviewed (or self-reviewed against CLAUDE.md guidelines)
6. Documentation updated
7. Committed to main branch
