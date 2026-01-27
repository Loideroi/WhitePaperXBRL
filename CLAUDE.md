# WhitePaper XBRL - Claude Code Instructions

## Project Overview

A Next.js web application that transforms PDF whitepapers into MiCA-compliant iXBRL files for regulatory submission to ESMA/NCAs.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Vercel

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

### Security
- NEVER store uploaded PDFs longer than necessary (max 1 hour)
- NEVER log or store LEI values in plain text in logs
- ALWAYS sanitize PDF content before processing (prevent injection)
- NEVER trust PDF metadata without validation
- ALWAYS validate file types server-side, not just by extension

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
      /upload             # PDF upload endpoint
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
      /generator          # iXBRL document generator
      /validator          # Validation assertion engine
    /pdf                  # PDF parsing utilities
    /utils                # General utilities
  /types                  # TypeScript type definitions
    /xbrl.ts              # XBRL-specific types
    /taxonomy.ts          # Taxonomy element types
    /whitepaper.ts        # Whitepaper data types
  /config                 # Configuration files
/tests                    # Test files (mirrors /src structure)
/docs                     # Additional documentation
  /agent_docs             # Context documents for Claude
/taxonomy                 # ESMA taxonomy files (bundled)
```

---

## Agent Documentation

For complex features, check these context documents:

| Feature | Document |
|---------|----------|
| XBRL Taxonomy | `docs/agent_docs/xbrl-taxonomy.md` |
| Validation Rules | `docs/agent_docs/validation-rules.md` |
| PDF Extraction | `docs/agent_docs/pdf-extraction.md` |
| Security Model | `docs/agent_docs/security-model.md` |
| API Contracts | `docs/agent_docs/api-contracts.md` |

---

## Key Files Reference

| Purpose | File(s) |
|---------|---------|
| XBRL Types | `src/types/xbrl.ts` |
| Taxonomy Elements | `src/lib/xbrl/taxonomy/elements.ts` |
| iXBRL Generator | `src/lib/xbrl/generator/ixbrl-generator.ts` |
| Validation Engine | `src/lib/xbrl/validator/assertion-engine.ts` |
| PDF Parser | `src/lib/pdf/parser.ts` |
| Upload API | `src/app/api/upload/route.ts` |

---

## Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/lib/xbrl/validator/__tests__/assertions.test.ts

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## Common Tasks

### Adding a New Taxonomy Element
1. Add type definition in `src/types/taxonomy.ts`
2. Add element config in `src/lib/xbrl/taxonomy/elements.ts`
3. Add validation rules in `src/lib/xbrl/validator/rules/`
4. Add tests in `tests/lib/xbrl/taxonomy/`
5. Update field mapping in `src/lib/pdf/field-mapper.ts`

### Adding a New Validation Assertion
1. Define assertion in `src/lib/xbrl/validator/assertions/`
2. Register in assertion registry `src/lib/xbrl/validator/registry.ts`
3. Add test cases covering pass/fail scenarios
4. Document in `docs/agent_docs/validation-rules.md`

### Modifying PDF Extraction
1. Update parser in `src/lib/pdf/parser.ts`
2. Update field mapper in `src/lib/pdf/field-mapper.ts`
3. Add test PDFs to `tests/fixtures/pdfs/`
4. Run extraction tests: `npm test -- pdf`

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_APP_URL=           # Base URL for the app

# Optional (Phase 2+)
SUPABASE_URL=                  # Supabase project URL
SUPABASE_ANON_KEY=             # Supabase anonymous key
LEI_API_KEY=                   # GLEIF API key for LEI validation
```

---

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
Scopes: `xbrl`, `pdf`, `validation`, `ui`, `api`, `config`

---

## PR Checklist

Before creating a PR:
- [ ] All tests pass (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] New features have tests
- [ ] XBRL output validated against ESMA taxonomy
- [ ] Security considerations documented if applicable
