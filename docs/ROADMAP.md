# Roadmap — Planned Features

This document tracks unimplemented features planned for future phases. These were originally specified in the PRD, API contracts, or security model but are not yet built.

---

## Authentication & Authorization

- **JWT Bearer tokens** via Supabase Auth (Phase 2+)
- User-specific data retention and session sharing
- Role-based access (admin, editor, viewer)

## Persistent Storage

- **Supabase integration** for session persistence and user data
- **Vercel Blob storage** for temporary file storage with signed URLs
- **Redis rate limiting** (Upstash) for multi-instance production deployment
  - Current implementation is in-memory, suitable for single-instance only

## Session Management

- `GET /api/upload/:sessionId` — Retrieve upload status and extracted data
- `PUT /api/upload/:sessionId` — Update session data (token type, field values)
- Cross-session data sharing between users

## Document Download & Preview

- `GET /api/generate/:documentId` — Download generated iXBRL document by ID
- `GET /api/generate/:documentId/preview` — Preview iXBRL document in browser with embedded viewer

## Taxonomy Browsing API

- `GET /api/taxonomy/elements?tokenType=OTHR&part=A&language=en` — Browse taxonomy elements
- `GET /api/taxonomy/enumerations/:domain` — Get enumeration options for a domain

## LEI Validation API

- `POST /api/lei/validate` — Standalone LEI validation endpoint (format, checksum, optional GLEIF lookup)
  - Note: LEI validation is currently built into the validation engine; this endpoint would expose it independently

## Webhook Events

- `upload.complete` — PDF extraction completed
- `validation.complete` — Validation finished
- `generation.complete` — iXBRL document generated
- `session.expired` — Session data deleted

## Multi-Language Output

- Generate iXBRL documents in any of the 24 EU official languages
- Language-specific label linkbases are available in the taxonomy

## Additional Features

- OCR fallback for image-based/scanned PDFs
- Streaming/progress callbacks for large document processing
- ART and EMT token type full support (currently OTHR is primary)
- Batch processing of multiple documents
- Document comparison between versions
- Audit trail for regulatory compliance
