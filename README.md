# WhitePaper XBRL

A Next.js web application that transforms crypto-asset whitepaper documents into MiCA-compliant iXBRL files for regulatory submission to ESMA and National Competent Authorities (NCAs).

As of December 23, 2025, all MiCA crypto-asset whitepapers must be submitted in Inline XBRL (iXBRL) format per Commission Implementing Regulation (EU) 2024/2984. This tool automates that transformation by extracting structured data from uploaded documents, validating it against ESMA's 488 taxonomy assertions, and generating submission-ready iXBRL/XHTML files.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supported Document Formats

- **PDF** — via `pdf-parse`
- **DOCX** — via `officeparser`
- **ODT** — via `officeparser`
- **RTF** — via `officeparser`

## Architecture

```
Upload Document → Extract Text → Map Fields → Review/Edit → Validate → Generate iXBRL
```

- **Document Extraction**: Multi-format text extraction with three-pass field mapping (MiCA table format, pattern matching, label matching)
- **Validation Engine**: 257 existence assertions + 224 value assertions + 6 LEI checks + 1 duplicate detection, with full/quick/single-field modes
- **iXBRL Generation**: XHTML output with inline XBRL tags, proper namespace declarations, embedded CSS, and ix:hidden enumeration facts
- **Taxonomy**: ESMA MiCA taxonomy (2025-03-31) bundled as JSON — closed/fixed, no extensions allowed

## Tech Stack

Next.js 16 (App Router) · TypeScript (strict) · React 19 · Tailwind CSS · shadcn/ui · Vitest · Playwright

## Token Types

| Type | Description | ESMA Table |
|------|-------------|------------|
| OTHR | Crypto-assets other than ART/EMT | Table 2 |
| ART | Asset-Referenced Tokens | Table 3 |
| EMT | E-Money Tokens | Table 4 |

## Documentation

- [CLAUDE.md](CLAUDE.md) — Development instructions and project structure
- [PRD.md](PRD.md) — Product requirements document
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — Phased implementation plan with status
- [docs/ROADMAP.md](docs/ROADMAP.md) — Planned future features
- [docs/agent_docs/](docs/agent_docs/) — Detailed technical guides (XBRL taxonomy, validation rules, API contracts, security model, document extraction)

## License

Proprietary.
