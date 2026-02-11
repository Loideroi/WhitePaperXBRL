/**
 * Quality Benchmark Script for PDF Extraction Pipeline
 *
 * Runs PDFs through the full pipeline (extract → map → validate → generate)
 * and compares extracted values against known correct values from ground truth fixtures.
 *
 * Usage:
 *   npm run quality-check                    # Run all fixtures
 *   npx tsx scripts/quality-check.ts         # Run all fixtures
 *   npx tsx scripts/quality-check.ts spurs   # Run only SPURS
 *   npx tsx scripts/quality-check.ts spurs arg  # Run SPURS and ARG
 */

import fs from 'fs';
import path from 'path';
import { extractPdfText } from '../src/lib/pdf/extractor';
import { mapPdfToWhitepaper } from '../src/lib/pdf/field-mapper';
import { validateWhitepaper } from '../src/lib/xbrl/validator/orchestrator';
import { generateIXBRLDocument } from '../src/lib/xbrl/generator/document-generator';
import type { WhitepaperData } from '../src/types/whitepaper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldMatcher {
  equals?: unknown;
  contains?: string;
  oneOf?: unknown[];
  matches?: string;
}

interface ExpectedData {
  pdf: string;
  tokenType: string;
  typed: Record<string, FieldMatcher>;
  rawFields: Record<string, FieldMatcher>;
  iXBRL: {
    minNonNumericFacts: number;
    minNonFractionFacts: number;
    requiredNamespaces: string[];
    mustContain: string[];
    mustNotContain: string[];
  };
}

interface FieldResult {
  field: string;
  pass: boolean;
  actual: unknown;
  expected: string;
  issue?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLACEHOLDER_LEI = '529900T8BM49AURSDO55';
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures/whitepapers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function matchField(value: unknown, matcher: FieldMatcher): { pass: boolean; expected: string; issue?: string } {
  if ('equals' in matcher) {
    const pass = value === matcher.equals;
    return {
      pass,
      expected: JSON.stringify(matcher.equals),
      issue: pass ? undefined : `got ${JSON.stringify(value)}`,
    };
  }
  if ('contains' in matcher) {
    const str = String(value ?? '');
    const pass = str.includes(matcher.contains!);
    return {
      pass,
      expected: `contains "${matcher.contains}"`,
      issue: pass ? undefined : `"${truncate(str, 60)}" missing substring`,
    };
  }
  if ('oneOf' in matcher) {
    const pass = matcher.oneOf!.includes(value);
    return {
      pass,
      expected: `one of ${JSON.stringify(matcher.oneOf)}`,
      issue: pass ? undefined : `got ${JSON.stringify(value)}`,
    };
  }
  if ('matches' in matcher) {
    const str = String(value ?? '');
    const pass = new RegExp(matcher.matches!).test(str);
    return {
      pass,
      expected: `matches /${matcher.matches}/`,
      issue: pass ? undefined : `"${truncate(str, 60)}" no match`,
    };
  }
  return { pass: false, expected: '(unknown matcher)', issue: 'invalid matcher' };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ---------------------------------------------------------------------------
// Run a single fixture
// ---------------------------------------------------------------------------

async function runFixture(fixturePath: string): Promise<{ name: string; pct: number; passed: boolean }> {
  const startTime = Date.now();
  const fixtureName = path.basename(fixturePath, '-expected.json').toUpperCase();

  const expected: ExpectedData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

  const pdfPath = path.resolve(expected.pdf);
  if (!fs.existsSync(pdfPath)) {
    console.error(`  PDF not found: ${pdfPath}`);
    return { name: fixtureName, pct: 0, passed: false };
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ${fixtureName} Quality Benchmark`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // --- Stage 1: Extract ---
  const buffer = fs.readFileSync(pdfPath);
  const pdfExtraction = await extractPdfText(buffer);

  console.log(`  Extraction: ${pdfExtraction.pages} pages, ${pdfExtraction.sections.size} sections detected`);

  // --- Stage 2: Map ---
  const mapping = mapPdfToWhitepaper(pdfExtraction, expected.tokenType as 'OTHR');
  const data: Partial<WhitepaperData> = {
    ...mapping.data,
    tokenType: expected.tokenType as 'OTHR',
    partA: {
      ...mapping.data.partA!,
      lei: PLACEHOLDER_LEI,
    },
  };

  const rawFieldCount = Object.keys(data.rawFields ?? {}).length;
  console.log(`  Mapping:    ${rawFieldCount} rawFields extracted`);
  console.log(`  Confidence: ${mapping.confidence.overall}% overall`);
  console.log('');

  // --- Stage 3: Compare typed fields ---
  const typedResults: FieldResult[] = [];
  for (const [dotPath, matcher] of Object.entries(expected.typed)) {
    const actual = getNestedValue(data as Record<string, unknown>, dotPath);
    const result = matchField(actual, matcher);
    typedResults.push({
      field: dotPath,
      pass: result.pass,
      actual,
      expected: result.expected,
      issue: result.issue,
    });
  }

  console.log('  TYPED FIELDS:');
  for (const r of typedResults) {
    const icon = r.pass ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
    const fieldName = pad(r.field, 36);
    if (r.pass) {
      const display = typeof r.actual === 'string' ? `"${truncate(r.actual, 50)}"` : JSON.stringify(r.actual);
      console.log(`  ${icon} ${fieldName} = ${display}`);
    } else {
      console.log(`  ${icon} ${fieldName} ${r.issue} (expected: ${r.expected})`);
    }
  }
  console.log('');

  // --- Stage 4: Compare raw fields ---
  const rawResults: FieldResult[] = [];
  const rawFields = data.rawFields ?? {};
  for (const [fieldNum, matcher] of Object.entries(expected.rawFields)) {
    const actual = rawFields[fieldNum];
    const result = matchField(actual, matcher);
    rawResults.push({
      field: fieldNum,
      pass: result.pass,
      actual,
      expected: result.expected,
      issue: result.issue,
    });
  }

  console.log('  RAW FIELDS:');
  for (const r of rawResults) {
    const icon = r.pass ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
    const fieldName = pad(r.field, 8);
    if (r.pass) {
      const display = typeof r.actual === 'string' ? `"${truncate(r.actual, 60)}"` : JSON.stringify(r.actual);
      console.log(`  ${icon} ${fieldName} ${display}`);
    } else {
      console.log(`  ${icon} ${fieldName} ${r.issue} (expected: ${r.expected})`);
    }
  }
  console.log('');

  // --- Stage 5: Validation ---
  const validation = await validateWhitepaper(data, expected.tokenType as 'OTHR', {
    checkGLEIF: false,
  });

  console.log('  VALIDATION:');
  const cats = validation.assertionCounts;
  console.log(`  Existence: ${cats.existence.passed}/${cats.existence.total} pass`);
  console.log(`  Value:     ${cats.value.passed}/${cats.value.total} pass`);
  console.log(`  LEI:       ${cats.lei.passed}/${cats.lei.total} pass`);
  console.log(`  Duplicate: ${cats.duplicate.passed}/${cats.duplicate.total} pass`);
  if (validation.errors.length > 0) {
    console.log(`  Errors (${validation.errors.length}):`);
    for (const err of validation.errors.slice(0, 5)) {
      console.log(`    - ${err.field}: ${err.message}`);
    }
    if (validation.errors.length > 5) {
      console.log(`    ... and ${validation.errors.length - 5} more`);
    }
  }
  if (validation.warnings.length > 0) {
    console.log(`  Warnings (${validation.warnings.length}):`);
    for (const warn of validation.warnings.slice(0, 3)) {
      console.log(`    - ${warn.field}: ${warn.message}`);
    }
    if (validation.warnings.length > 3) {
      console.log(`    ... and ${validation.warnings.length - 3} more`);
    }
  }
  console.log('');

  // --- Stage 6: iXBRL structure ---
  const ixbrl = generateIXBRLDocument(data);
  const ixbrlChecks: { label: string; pass: boolean; detail?: string }[] = [];

  ixbrlChecks.push({
    label: 'XML declaration present',
    pass: ixbrl.startsWith('<?xml'),
  });

  for (const ns of expected.iXBRL.requiredNamespaces) {
    ixbrlChecks.push({
      label: `xmlns:${ns} declared`,
      pass: ixbrl.includes(`xmlns:${ns}`),
    });
  }

  ixbrlChecks.push({
    label: 'ix:header present',
    pass: ixbrl.includes('<ix:header>'),
  });

  const nonNumericCount = (ixbrl.match(/<ix:nonNumeric/g) || []).length;
  const nonFractionCount = (ixbrl.match(/<ix:nonFraction/g) || []).length;
  ixbrlChecks.push({
    label: `ix:nonNumeric facts`,
    pass: nonNumericCount >= expected.iXBRL.minNonNumericFacts,
    detail: `${nonNumericCount} (min: ${expected.iXBRL.minNonNumericFacts})`,
  });
  ixbrlChecks.push({
    label: `ix:nonFraction facts`,
    pass: nonFractionCount >= expected.iXBRL.minNonFractionFacts,
    detail: `${nonFractionCount} (min: ${expected.iXBRL.minNonFractionFacts})`,
  });

  for (const text of expected.iXBRL.mustContain) {
    ixbrlChecks.push({
      label: `contains "${truncate(text, 30)}"`,
      pass: ixbrl.includes(text),
    });
  }

  for (const text of expected.iXBRL.mustNotContain) {
    const pattern = new RegExp(`(?<![a-zA-Z])${text}(?![a-zA-Z])`, 'i');
    const found = pattern.test(ixbrl);
    ixbrlChecks.push({
      label: `no stray "${text}"`,
      pass: !found,
      detail: found ? 'FOUND in output' : undefined,
    });
  }

  ixbrlChecks.push({
    label: 'no xbrli:segment (uses scenario)',
    pass: !ixbrl.includes('xbrli:segment'),
  });

  ixbrlChecks.push({
    label: 'CSS embedded (not external)',
    pass: ixbrl.includes('<style') && !/<link[^>]+rel=["']stylesheet["']/.test(ixbrl),
  });

  console.log('  iXBRL STRUCTURE:');
  for (const check of ixbrlChecks) {
    const icon = check.pass ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
    const detail = check.detail ? ` (${check.detail})` : '';
    console.log(`  ${icon} ${check.label}${detail}`);
  }
  console.log('');

  // --- Summary ---
  const typedPass = typedResults.filter((r) => r.pass).length;
  const rawPass = rawResults.filter((r) => r.pass).length;
  const totalFields = typedResults.length + rawResults.length;
  const totalPass = typedPass + rawPass;
  const ixbrlPass = ixbrlChecks.filter((c) => c.pass).length;
  const pct = Math.round((totalPass / totalFields) * 100);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════════════');
  console.log(`  TYPED:  ${typedPass}/${typedResults.length} correct`);
  console.log(`  RAW:    ${rawPass}/${rawResults.length} correct`);
  console.log(`  iXBRL:  ${ixbrlPass}/${ixbrlChecks.length} checks pass`);
  console.log(`  SCORE:  ${totalPass}/${totalFields} fields correct (${pct}%)`);
  console.log(`  TIME:   ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  return { name: fixtureName, pct, passed: pct >= 70 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  // Discover fixtures
  let fixturePaths: string[];
  if (args.length > 0) {
    fixturePaths = args.map((name) => {
      const normalized = name.toLowerCase().replace(/-expected(\.json)?$/, '');
      return path.join(FIXTURES_DIR, `${normalized}-expected.json`);
    });
  } else {
    const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('-expected.json'));
    fixturePaths = files.map((f) => path.join(FIXTURES_DIR, f));
  }

  if (fixturePaths.length === 0) {
    console.error('No fixtures found in', FIXTURES_DIR);
    process.exit(1);
  }

  const results: { name: string; pct: number; passed: boolean }[] = [];

  for (const fp of fixturePaths) {
    if (!fs.existsSync(fp)) {
      console.error(`Fixture not found: ${fp}`);
      results.push({ name: path.basename(fp), pct: 0, passed: false });
      continue;
    }
    results.push(await runFixture(fp));
  }

  // Grand summary
  if (results.length > 1) {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  OVERALL SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    for (const r of results) {
      const icon = r.passed ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
      console.log(`  ${icon} ${pad(r.name, 12)} ${r.pct}%`);
    }
    console.log('═══════════════════════════════════════════════════');
    console.log('');
  }

  const anyFail = results.some((r) => !r.passed);
  if (anyFail) {
    console.log('\x1b[31m  FAIL: One or more fixtures below 70% threshold\x1b[0m');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Quality check failed:', err);
  process.exit(1);
});
