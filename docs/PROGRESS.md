# Implementation Progress Tracker

## Order of Implementation

| # | Item | Status | Commit |
|---|------|--------|--------|
| 1 | Phase 3: UI — Token Type Selector | DONE | (existed in UploadZone) |
| 2 | Phase 3: UI — Field Editor (all sub-components) | DONE | see below |
| 3 | Phase 3: UI — Validation Dashboard | DONE | (existed) |
| 4 | Phase 3: UI — Preview Page | DONE | (existed) |
| 5 | Phase 6: Integration — End-to-end flow | DONE | see below |
| 6 | Phase 6: Integration — Error handling & loading states | DONE | (existed) |
| 0 | **CRITICAL: Regulator Feedback Fixes** | IN PROGRESS | |
| 7 | Tier 1: ART Token Type (Table 3) | PENDING | |
| 8 | Tier 1: EMT Token Type (Table 4) | PENDING | |
| 9 | Tier 1: Block Tagging (ix:continuation / ix:exclude) | DONE | 5a53a53 |
| 10 | Tier 1: Duplicate Fact Detection | DONE | bcba0c9 |
| 11 | Tier 1: Multi-Language Output | DONE | 88e9978 |
| 12 | Tier 2: iXBRL Preview (embedded viewer) | PENDING | |
| 13 | Tier 2: GLEIF LEI Lookup | DONE | 53249c6 |
| 14 | Tier 2: Session Persistence | PENDING | |
| 15 | Tier 2: Authentication | PENDING | |
| 16 | Tier 2: Redis Rate Limiting | PENDING | |
| 17 | Tier 3: OCR Fallback | PENDING | |
| 18 | Tier 3: Taxonomy Browsing API | PENDING | |
| 19 | Tier 3: Batch Processing | PENDING | |
| 20 | Tier 3: Audit Trail | PENDING | |
| 21 | Phase 7: Integration Tests | PENDING | |
| 22 | Phase 7: E2E Tests | PENDING | |
| 23 | Phase 7: Security Audit | PENDING | |
| 24 | Phase 8: Vercel Config & Deployment | PENDING | |

## Completed Details

### Phase 3: UI Field Editor (#2)
- Created `DateField`, `EnumerationField`, `ManagementBodyTable` components
- Updated `SectionEditor` to handle 'date' and 'enumeration' field types
- Updated barrel exports in `fields/index.ts`

### Phase 6: Integration — End-to-end flow (#5)
- Expanded transform page SECTIONS from 5 → 10 sections (all MiCA Parts A-J + Sustainability S)
- Added enumeration option maps (member states, currencies, offering types, etc.)
- All 150+ taxonomy fields now have corresponding UI fields
- Date fields use native date picker, enumerations use dropdowns

### Validation Dashboard (#3) & Preview Page (#4) & Error Handling (#6)
- Already existed from prior implementation: `ValidationDashboard`, `IXBRLPreview`, error/loading states in transform page

### Block Tagging (#9)
- Added `ix:continuation` support for multi-fragment text blocks in inline-tagger
- Added `ix:exclude` wrapping for nested non-fraction elements within text blocks
- Section-renderer generates unique continuation IDs and links fragments
- 41 tests covering block tagging scenarios

### Multi-Language Output (#11)
- New `language-support.ts` module with ISO 639-1 validation for all 24 EU languages
- Language metadata (name, native name, direction) for each language
- VAL-014 assertion in value-engine validates xml:lang attribute
- English framework with extensible architecture for future language packs

### Duplicate Fact Detection (#10)
- New `duplicate-detector.ts` module identifies duplicate facts by concept+context+unit key
- Integrated into validation orchestrator as part of the standard validation flow
- 17 tests covering duplicate detection edge cases

### GLEIF LEI Lookup (#13)
- New `gleif-lookup.ts` module validates LEI codes against the GLEIF API
- 5-second timeout with graceful fallback to local-only validation
- New `/api/lei-lookup` route for client-side lookups
- Optional `LEI_API_KEY` env var for authenticated API access
- DOMException-safe error handling for jsdom compatibility

### Regulator Feedback Fixes (#0) — 2026-03-17

First XBRL submission rejected with 22 items. Fixes applied:

**Code Fixes (DONE):**
- F.5: Added `modification` (MODI) enum value to SUBMISSION_TYPE_ENUM
- F.12: Changed language output from ISO code ("en") to full name ("English")
- E.32: Added `firmCommitment`/`withoutFirmCommitment` placement form enum values
- UI: Updated transform page dropdowns for F.5 and E.32

**New Existence Assertions (DONE):**
- EXS-D-005: D.13 (planned use of funds) required
- EXS-D-006: D.14 (resource allocation) required
- EXS-E-003: E.32 (placement form) required
- EXS-F-001: F.8 (issuer website) required
- EXS-F-002: F.5 (submission type) required
- EXS-G-001: G.5 (retained tokens) required
- EXS-A-007: A.12 (management info) required
- EXS-A-008: A.16 (financial condition) required
- EXS-B-001: B.1=true → issuer info required (conditional)

**New Value Assertions (DONE):**
- VAL-015: H.6=true → H.7 can't be "Non applicable"
- VAL-016: B.1=true → Section B must have content
- VAL-017: H.8=true → H.9 should reflect audit outcome
- VAL-018: E.23 CASP name too short / abbreviation warning
- VAL-019: F.1 description too brief warning

**Infrastructure Fix (DONE):**
- `getNestedValue()` in existence-engine now handles compound keys (e.g., `rawFields.D.13`)

**Open Questions (BLOCKED — awaiting user answers):**
1. #13 (F.4): Does F.4 need ART/EMT/OCA enum values? What taxonomy URIs?
2. #8 (E.21/E.22): Content fix or add past-date validation?
3. #2 (Statement 6): Which MiCA Article 6 summary statement?
4. #17 (F.15/F.16): What is unclear — labels or values?
5. #22 (Part I ToC): Is PDF ToC bleeding into Part I extraction?
6. #11,18 (E.40→Part F, F.19→Part G): Cross-reference contamination — need to investigate PDF extraction boundaries

## Notes

- Items are ordered by dependency and priority (ESMA compliance first)
- Each item is committed separately for clean git history
- Context is cleared between major phases to stay within limits
