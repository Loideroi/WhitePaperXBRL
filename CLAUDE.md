# WhitePaper XBRL - Claude Code Instructions

## Project Overview

A Next.js web application that transforms whitepaper documents (PDF, DOCX, ODT, RTF) into MiCA-compliant iXBRL files for regulatory submission to ESMA/NCAs.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel

---

## Critical Rules

### XBRL/iXBRL Compliance
- NEVER generate iXBRL without proper namespace declarations
- ALWAYS use `xbrli:scenario` for dimensions, NEVER `xbrli:segment`
- ALWAYS set `@escape="true"` for `textBlockItemType` elements
- ALWAYS set `@escape="false"` for `stringItemType` elements
- Period format MUST be `yyyy-mm-dd` with NO time components
- LEI format MUST be validated (20 alphanumeric characters with checksum)
- NEVER include executable code (JavaScript, Java, Flash) in generated iXBRL
- Only allow PNG, GIF, SVG, JPEG images in output
- ALWAYS use `decimals` attribute, NEVER `precision`
- Percentages stored as decimals (0.81 for 81%) with `scale="-2"` on `ix:nonFraction`
- Enumeration facts MUST go in `ix:hidden`, linked via CSS `-ix-hidden:{fact_id}`
- `xml:lang` MUST be set on root HTML element and on `ix:references`
- No `display:none` CSS on tagged facts; CSS SHOULD be embedded (not external)
- Use `ix:continuation` for multi-fragment block tagging
- Taxonomy is closed/fixed — no extensions allowed

### Security
- NEVER store uploaded documents longer than necessary (max 1 hour)
- NEVER log or store LEI values in plain text in logs
- ALWAYS sanitize document content before processing (prevent injection)
- NEVER trust document metadata without validation
- ALWAYS validate file types server-side, not just by extension (magic bytes)

### Code Quality
- Use TypeScript strict mode throughout
- All XBRL-related functions must have comprehensive JSDoc comments
- Validation functions must return structured error objects, not throw
- Use Zod for runtime validation of all external inputs

---

## Project Structure

```
/src
  /app                    # Next.js App Router pages
    /api                  # API routes
      /upload             # Document upload endpoint (PDF, DOCX, ODT, RTF)
      /validate           # Validation endpoint
      /generate           # iXBRL generation endpoint
    /(routes)             # Page routes
      /                   # Home/upload page
      /transform/[id]     # Transformation workflow
      /preview/[id]       # iXBRL preview
  /components             # React components
    /ui                   # shadcn/ui components
    /upload               # Upload-related components
    /editor               # Field editor components
    /validation           # Validation display components
  /lib                    # Core libraries
    /xbrl                 # XBRL/iXBRL generation engine
      /taxonomy           # ESMA taxonomy definitions
        /data             # Bundled taxonomy JSON (taxonomy-bundle.json)
      /generator          # iXBRL document generator
        /mica-template    # MiCA field definitions & enumeration mappings
          field-definitions.ts
          enumeration-mappings.ts
        /template         # Template rendering (CSS, tagger, layout, etc.)
          css-styles.ts
          inline-tagger.ts
          hidden-facts.ts
          page-layout.ts
          section-renderer.ts
          image-handler.ts
        document-generator.ts
        context-builder.ts
        fact-builder.ts
        summary-generator.ts
      /validator          # Validation assertion engine
        orchestrator.ts
        existence-engine.ts
        value-engine.ts
        lei-validator.ts
    /document             # Multi-format document extraction
      extractor.ts        # Unified DOCX/ODT/RTF/PDF extractor
    /pdf                  # PDF-specific parsing utilities
      extractor.ts        # Low-level PDF text extraction
      field-mapper.ts     # Maps extracted content to WhitepaperData
    /security             # Security utilities
      rate-limiter.ts
      sanitize.ts
    /utils                # General utilities
    env.ts                # Environment configuration
  /types                  # TypeScript type definitions
    xbrl.ts               # XBRL-specific types
    taxonomy.ts           # Taxonomy element types
    whitepaper.ts         # Whitepaper data types
/tests                    # Test files (mirrors /src structure)
/docs                     # Additional documentation
  /agent_docs             # Context documents for Claude
/taxonomy                 # Empty — raw ESMA files are in ESME Research documents/
                          # Bundled data is at src/lib/xbrl/taxonomy/data/
```

---

## Agent Documentation

For complex features, check these context documents:

| Feature | Document |
|---------|----------|
| XBRL Taxonomy | `docs/agent_docs/xbrl-taxonomy.md` |
| Validation Rules | `docs/agent_docs/validation-rules.md` |
| Document Extraction | `docs/agent_docs/pdf-extraction.md` |
| Security Model | `docs/agent_docs/security-model.md` |
| API Contracts | `docs/agent_docs/api-contracts.md` |

---

## Key Files Reference

| Purpose | File(s) |
|---------|---------|
| XBRL Types | `src/types/xbrl.ts` |
| Taxonomy Types | `src/types/taxonomy.ts` |
| Whitepaper Types | `src/types/whitepaper.ts` |
| Taxonomy Registry | `src/lib/xbrl/taxonomy/registry.ts` |
| Taxonomy Bundle | `src/lib/xbrl/taxonomy/data/taxonomy-bundle.json` |
| iXBRL Document Generator | `src/lib/xbrl/generator/document-generator.ts` |
| Context Builder | `src/lib/xbrl/generator/context-builder.ts` |
| Fact Builder | `src/lib/xbrl/generator/fact-builder.ts` |
| Summary Generator | `src/lib/xbrl/generator/summary-generator.ts` |
| MiCA Field Definitions | `src/lib/xbrl/generator/mica-template/field-definitions.ts` |
| Enumeration Mappings | `src/lib/xbrl/generator/mica-template/enumeration-mappings.ts` |
| Validation Orchestrator | `src/lib/xbrl/validator/orchestrator.ts` |
| Existence Engine | `src/lib/xbrl/validator/existence-engine.ts` |
| Value Engine | `src/lib/xbrl/validator/value-engine.ts` |
| LEI Validator | `src/lib/xbrl/validator/lei-validator.ts` |
| Document Extractor | `src/lib/document/extractor.ts` |
| PDF Extractor | `src/lib/pdf/extractor.ts` |
| Field Mapper | `src/lib/pdf/field-mapper.ts` |
| Upload API | `src/app/api/upload/route.ts` |
| Validate API | `src/app/api/validate/route.ts` |
| Generate API | `src/app/api/generate/route.ts` |
| Environment Config | `src/lib/env.ts` |

---

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/lib/xbrl/validator/lei-validator.test.ts

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## Common Tasks

### Adding a New Taxonomy Element
1. Add type definition in `src/types/taxonomy.ts`
2. Add element config in `src/lib/xbrl/taxonomy/registry.ts`
3. Add field definition in `src/lib/xbrl/generator/mica-template/field-definitions.ts`
4. Add validation rules in `src/lib/xbrl/validator/existence-engine.ts` and/or `value-engine.ts`
5. Add tests in `tests/lib/xbrl/taxonomy/`
6. Update field mapping in `src/lib/pdf/field-mapper.ts`

### Adding a New Validation Assertion
1. Add assertion logic in `src/lib/xbrl/validator/existence-engine.ts` or `value-engine.ts`
2. Add test cases covering pass/fail scenarios
3. Document in `docs/agent_docs/validation-rules.md`

### Modifying Document Extraction
1. For PDF-specific changes: update `src/lib/pdf/extractor.ts`
2. For multi-format changes: update `src/lib/document/extractor.ts`
3. Update field mapper in `src/lib/pdf/field-mapper.ts`
4. Add test fixtures to `tests/fixtures/pdfs/`
5. Run extraction tests: `npm test -- pdf`

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_APP_URL=           # Base URL for the app

# Optional
LEI_API_KEY=                   # GLEIF API key for LEI validation
```

---

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Scopes: `xbrl`, `pdf`, `document`, `validation`, `ui`, `api`, `config`

---

## PR Checklist

Before creating a PR:
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] New features have tests
- [ ] XBRL output validated against ESMA taxonomy
- [ ] Security considerations documented if applicable

---

## Context Management

### During Long Sessions
- **At 60% context**: Run `/compact` to compress conversation history
- **Before starting a new feature**: Run `/clear` if the previous feature is committed
- **After each commit**: Consider `/clear` to free context for the next task

### For Multi-Step Implementations
1. Write a plan to `docs/PROGRESS.md` before coding (track what's pending/done)
2. Commit after each complete feature (code + tests passing)
3. Use subagents for investigation/exploration to avoid polluting main context
4. If a task touches >5 files, break it into sub-tasks and commit each separately

### Checkpoint Pattern (Prevents "Dumb Zone")
When implementing multiple features in one session:
1. Implement feature → run tests → commit
2. Update `docs/PROGRESS.md` with what's done and what's next
3. `/compact` or `/clear`
4. Repeat for next feature

### Recovery from Context Limit
If a session hits context limit mid-implementation:
1. Uncommitted work survives in the working tree
2. New session: read `docs/PROGRESS.md` + `git status` + `git diff --stat`
3. Run `npm test` to assess state
4. Fix any issues, commit logically grouped changes
