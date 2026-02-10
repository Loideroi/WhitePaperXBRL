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

## Notes

- Items are ordered by dependency and priority (ESMA compliance first)
- Each item is committed separately for clean git history
- Context is cleared between major phases to stay within limits
