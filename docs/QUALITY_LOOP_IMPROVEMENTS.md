# Quality Loop Improvements — Research Findings

## 1. Yes/No Boolean Fields Never Prepopulated

**Root Cause:** 23 boolean fields exist on the editor page (`BooleanField` with Yes/No toggles), but only **2** have actual boolean extraction logic:

| Extracted as boolean | Field |
|---|---|
| `partE.isPublicOffering` | E.1 — regex: `/yes\|OTPC\|public\|offer/i` |
| `partE.withdrawalRights` | E.26 — regex: `/yes\|entitled\|right\|withdraw/i` |

The remaining **21 boolean fields** read from `rawFields` paths (e.g., `rawFields.B.1`, `rawFields.D.6`, `rawFields.H.8`). The raw field values are **strings** like `"'False' – No"` or `"'True' – Yes"`, but `BooleanField` expects `boolean | undefined`. Since a string is truthy but not `=== true`, the Yes/No buttons stay neutral.

**Unpopulated boolean fields (21):**
`A.15`, `B.1`, `D.6`, `D.9`, `D.11`, `E.6`, `E.15`, `E.20`, `F.15`, `F.16`, `F.17`, `G.6`, `G.9`, `G.12`, `G.14`, `G.16`, `H.6`, `H.8`, `I.02a`, `I.02b`, `I.03`

**Fix:** Add boolean coercion in the field mapper or `SectionEditor`:
- Pattern `/'?True'?\s*[–-]|yes/i` → `true`
- Pattern `/'?False'?\s*[–-]|no\b/i` → `false`

---

## 2. Currency Defaults to EUR Instead of USD

**Root Cause:** Two conflicting defaults:

| Layer | Default |
|---|---|
| `extractCurrency()` in field-mapper.ts | `'USD'` |
| `MonetaryField` component prop | `'EUR'` |

For typed fields (`partE.tokenPrice`), the mapper extracts currency into `partE.tokenPriceCurrency` via `extractCurrency()`. But the editor's `MonetaryField` component defaults its `currency` prop to `'EUR'`, and the `SectionEditor` may not pass the extracted currency field through.

For rawField-based monetary fields (`rawFields.E.4`, `rawFields.E.5`, `rawFields.E.10`), no separate currency extraction exists — they're plain text strings.

All Socios whitepapers specify USD, so the editor showing EUR is incorrect.

**Fix:**
1. Ensure `SectionEditor` passes extracted `tokenPriceCurrency` to monetary field components
2. For rawField monetary fields, extract currency from text content
3. Change `MonetaryField` default from `'EUR'` to extracted currency or `'USD'`

---

## 3. Prepopulate Every Field & Report Missing Ones

**Coverage gap:** Only ~19 of 150+ typed fields are extracted (~13%):

| Part | Extracted | Total | Coverage |
|---|---|---|---|
| A (Offeror) | 6 | 21 | 29% |
| B (Issuer) | 0 | 13 | 0% |
| C (Trading Platform) | 0 | 15 | 0% |
| D (Project) | 7 | 17 | 41% |
| E (Offering) | 8 | 40 | 20% |
| F (Crypto-Asset) | 0 | 19 | 0% |
| G (Rights/Obligations) | 0 | 19 | 0% |
| H (Technology) | 3 | 10 | 30% |
| I (Risk Disclosure) | 0 | 10 | 0% |
| J/S (Sustainability) | 3 | 20 | 15% |

**Good news:** `rawFields` extraction captures nearly all content as text strings (SPURS/ARG both have 174 raw fields). The data IS there — it's just not converted to typed format.

**Problem:** The editor defines fields with specific types (`boolean`, `monetary`, `date`, `number`, `enumeration`, `text`, `textblock`), but raw fields are all strings.

**Fix — three layers:**

1. **Typed field promotion:** For each editor field reading from `rawFields.*`, add conversion:
   - Boolean: `"'True' – Yes"` → `true`, `"'False' – No"` → `false`
   - Date: Parse ISO dates or natural dates from raw text
   - Number: Parse numeric values
   - Enumeration: Map raw text to enum keys (`"'OTPC'"` → `"publicOffering"`, `"'RETL'"` → `"retailInvestors"`)
   - Monetary: Split into value + currency

2. **Coverage reporting in quality check:** Add section to `quality-check.ts` comparing every editor field against populated data:
   - Fields populated with correct type
   - Fields with raw content available but not converted
   - Fields with no content (genuinely missing from PDF)

3. **Console logging for missing fields:** During extraction, log which MiCA fields have no matching PDF content so the quality loop can verify if they're truly absent.

---

## Recommended Implementation Order

1. **Boolean coercion** — highest impact, simplest fix — converts 21 raw field strings to booleans, fixes all Yes/No buttons
2. **Currency fix** — ensure extracted currency flows to MonetaryField, change default
3. **Quality check coverage report** — field-by-field coverage in benchmark script
4. **Typed field promotion** — date, number, enumeration conversions from raw text

---

## Key Files

| File | Role |
|---|---|
| `src/lib/pdf/field-mapper.ts` | Extraction & mapping (boolean coercion, currency extraction) |
| `src/components/editor/SectionEditor.tsx` | Renders fields, passes values to components |
| `src/components/editor/fields/BooleanField.tsx` | Yes/No toggle (expects `boolean`) |
| `src/components/editor/fields/MonetaryField.tsx` | Amount + currency (defaults to EUR) |
| `src/app/transform/[id]/page.tsx` | Editor page with all field definitions & enum options |
| `scripts/quality-check.ts` | Quality benchmark (needs coverage reporting) |
| `tests/fixtures/whitepapers/*-expected.json` | Ground truth fixtures |
