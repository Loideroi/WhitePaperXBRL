# Roadmap — WhitePaper XBRL

This roadmap is prioritized based on ESMA regulatory requirements and practical production needs. Items are grouped into tiers reflecting compliance urgency, not development order.

**Current state:** The platform fully supports OTHR (Table 2) token type with 72 existence + 139 value + 6 LEI = 217 active assertions, PDF/DOCX/ODT/RTF extraction, and iXBRL generation. All processing is in-memory and synchronous.

---

## Tier 1: ESMA Compliance Gaps (High Priority)

Features required or strongly recommended by ESMA regulations that are not yet implemented.

### 1. ART Token Type (Table 3) — Full Support

ESMA mandates Table 3 for Asset-Referenced Tokens with 165 assertions (103 existence + 62 value). The codebase has type definitions and validation stubs for ART but lacks field definitions, field mapping, and generation templates.

**Work required:**
- Add ART-specific field definitions (reserve assets, stabilization mechanism, issuer authorization) in `field-definitions.ts`
- Add ART field mapping for document extraction in `field-mapper.ts`
- Add ART iXBRL generation template (entry point: `mica_entry_table_3.xsd`)
- Activate the 103 existence + 62 value assertions already stubbed in `existence-engine.ts` and `value-engine.ts`
- Reference: `SCWP_-_for_ART_token.xlsm` for field structure

### 2. EMT Token Type (Table 4) — Full Support

ESMA mandates Table 4 for E-Money Tokens with 104 assertions (82 existence + 22 value). Same gap as ART — type definitions exist but no field definitions, mapping, or generation.

**Work required:**
- Add EMT-specific field definitions (redemption, safeguarding, e-money institution details) in `field-definitions.ts`
- Add EMT field mapping for document extraction in `field-mapper.ts`
- Add EMT iXBRL generation template (entry point: `mica_entry_table_4.xsd`)
- Activate the 82 existence + 22 value assertions already stubbed
- Reference: `SCWP_-_for_EMT_token.xlsm` for field structure

### 3. Multi-Language Output

ESMA requires white papers in the language of the home Member State. The taxonomy includes labels in all 24 EU official languages (BG, CS, DA, DE, EL, EN, ES, ET, FI, FR, GA, HR, HU, IT, LT, LV, MT, NL, PL, PT, RO, SK, SL, SV). Currently `xml:lang` is set on the output but all labels are English-only.

**Work required:**
- Load language-specific labels from the taxonomy bundle (label linkbases exist for all 24 languages)
- Generate iXBRL documents using the selected language's taxonomy labels
- Produce separate iXBRL files per language version (same tagging structure, different labels)

### 4. Block Tagging (`ix:continuation` / `ix:exclude`)

The ESMA reporting manual specifies `ix:continuation` for narrative text blocks (`textBlockItemType`) that span multiple document sections or page boundaries, and `ix:exclude` for removing non-reportable content (headers, footers, page numbers) from tagged blocks. Neither is currently implemented (0 matches in codebase).

**Work required:**
- Implement `ix:continuation` support in the document generator for multi-fragment block tagging
- Implement `ix:exclude` for stripping non-reportable content within tagged blocks
- Affects `textBlockItemType` elements primarily

### 5. Duplicate Fact Detection

ESMA requires validation of duplicate facts in generated output:
- Inconsistent numeric duplicates → **ERROR**
- Inconsistent non-numeric duplicates → **WARNING**
- Consistent duplicates (same value) → OK

**Work required:**
- Add duplicate fact detection pass after iXBRL generation, before download
- Report errors/warnings to the user in the validation results UI

---

## Tier 2: Production Readiness (Medium Priority)

Features needed for a usable multi-user deployment.

### 1. Session Persistence

Users currently lose all work on page refresh. Replace in-memory session storage with database-backed persistence.

**Work required:**
- Database-backed session storage (technology TBD)
- `GET /api/upload/:sessionId` — retrieve session state and extracted data
- `PUT /api/upload/:sessionId` — update field values within a session

### 2. Authentication

User accounts with session-scoped data isolation.

**Work required:**
- Authentication integration (technology TBD — Supabase Auth, NextAuth, etc.)
- Single role sufficient initially; role-based access not needed

### 3. Redis Rate Limiting

The current in-memory rate limiter works for single-instance deployment only. Multi-instance production requires shared state.

**Work required:**
- Replace in-memory rate limiter with Redis-backed implementation (e.g., Upstash)
- Maintain current rate limits: upload=10, process=20, validate=60, generate=30 per minute

### 4. GLEIF LEI Lookup

Currently LEI validation only checks format and checksum (ISO 17442). Verifying that the LEI actually exists in the GLEIF database would add real validation value.

**Work required:**
- Add GLEIF API lookup to existing LEI validation in `lei-validator.ts`
- Fail gracefully if GLEIF API is unavailable (format/checksum validation still applies)
- No standalone endpoint needed — enhance existing validation pipeline

### 5. iXBRL Preview

The preview page route exists (`/preview/[id]`) but is currently empty. Users need to see what their generated iXBRL looks like before downloading.

**Work required:**
- Browser-based iXBRL preview with an embedded XBRL viewer
- Display tagged facts with hover/click inspection

---

## Tier 3: Enhanced Features (Lower Priority)

Nice-to-have features for power users and edge cases.

### 1. OCR Fallback for Scanned PDFs

Image-based/scanned PDFs currently extract no text. Adding OCR support would expand the range of documents that can be processed.

**Work required:**
- Integrate Tesseract.js or a cloud OCR API for image-based PDF pages
- Detect image-only pages and route to OCR pipeline

### 2. Taxonomy Browsing API

Expose the taxonomy data via API endpoints for developer integrations and tooling.

**Work required:**
- `GET /api/taxonomy/elements` — browse/search taxonomy elements with filtering by token type, part, and language
- `GET /api/taxonomy/enumerations/:domain` — get valid enumeration values for a domain

### 3. Batch Processing

Process multiple whitepaper documents in a single request, useful for NCAs processing bulk submissions.

### 4. Audit Trail

Log all validation results and generation events for regulatory compliance evidence.

---

## Removed Items

Items from the previous roadmap that have been removed:

| Removed Item | Reason |
|---|---|
| Webhook Events | Over-engineering for a synchronous document conversion tool; no async processing workflows exist |
| Vercel Blob storage | In-memory processing is correct per ESMA file retention requirements; session persistence is a database concern, not blob storage |
| Cross-session data sharing | No clear use case for a regulatory filing tool |
| Document comparison between versions | External diff tools suffice; not a core workflow |
| Streaming/progress callbacks | Processing completes in under a second; no user-visible latency to address |
| Standalone LEI validation endpoint | LEI validation is already part of the validation pipeline; a standalone `POST /api/lei/validate` endpoint adds no value |
| Role-based access (admin/editor/viewer) | Single-role authentication sufficient for initial production use |
