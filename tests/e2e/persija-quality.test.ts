/**
 * PERSIJA Quality Regression Test
 *
 * Runs the PERSIJA PDF through the full pipeline and asserts a minimum
 * quality score against the ground truth fixture. Prevents regressions
 * in extraction, mapping, validation, and iXBRL generation.
 *
 * Run with: npm run test:e2e:pipeline
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { extractPdfText, type PdfExtractionResult } from '@/lib/pdf/extractor';
import { mapPdfToWhitepaper, type MappingResult } from '@/lib/pdf/field-mapper';
import { validateWhitepaper } from '@/lib/xbrl/validator/orchestrator';
import type { DetailedValidationResult } from '@/lib/xbrl/validator/orchestrator';
import { generateIXBRLDocument } from '@/lib/xbrl/generator/document-generator';
import type { WhitepaperData } from '@/types/whitepaper';

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

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER_LEI = '529900T8BM49AURSDO55';
const EXPECTED_PATH = path.resolve(
  __dirname,
  '../fixtures/whitepapers/persija-expected.json'
);
const MIN_QUALITY_SCORE = 70; // percentage

function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function matchField(value: unknown, matcher: FieldMatcher): boolean {
  if ('equals' in matcher) return value === matcher.equals;
  if ('contains' in matcher) return String(value ?? '').includes(matcher.contains!);
  if ('oneOf' in matcher) return matcher.oneOf!.includes(value);
  if ('matches' in matcher) return new RegExp(matcher.matches!).test(String(value ?? ''));
  return false;
}

// ---------------------------------------------------------------------------
// Pipeline state
// ---------------------------------------------------------------------------

let expected: ExpectedData;
let pdfExtraction: PdfExtractionResult;
let mapping: MappingResult;
let data: Partial<WhitepaperData>;
let validation: DetailedValidationResult;
let ixbrl: string;

// ---------------------------------------------------------------------------
// Setup — run pipeline once
// ---------------------------------------------------------------------------

beforeAll(async () => {
  expected = JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf-8'));

  const pdfPath = path.resolve(expected.pdf);
  const buffer = fs.readFileSync(pdfPath);

  pdfExtraction = await extractPdfText(buffer);
  mapping = mapPdfToWhitepaper(pdfExtraction, expected.tokenType as 'OTHR');
  data = {
    ...mapping.data,
    tokenType: expected.tokenType as 'OTHR',
    partA: {
      ...mapping.data.partA!,
      lei: PLACEHOLDER_LEI,
    },
  };

  validation = await validateWhitepaper(data, expected.tokenType as 'OTHR', {
    checkGLEIF: false,
  });

  ixbrl = generateIXBRLDocument(data);
}, 60_000);

// ===========================================================================
// Extraction
// ===========================================================================

describe('PERSIJA Extraction', () => {
  it('extracts all MiCA sections', () => {
    expect(pdfExtraction.sections.size).toBeGreaterThanOrEqual(5);
  });

  it('extracts non-empty text', () => {
    expect(pdfExtraction.text.length).toBeGreaterThan(1000);
  });
});

// ===========================================================================
// Typed Fields
// ===========================================================================

describe('PERSIJA Typed Fields', () => {
  it('meets minimum quality score', () => {
    let pass = 0;
    let total = 0;
    for (const [dotPath, matcher] of Object.entries(expected.typed)) {
      total++;
      const actual = getNestedValue(data as Record<string, unknown>, dotPath);
      if (matchField(actual, matcher)) pass++;
    }
    const pct = Math.round((pass / total) * 100);
    expect(pct).toBeGreaterThanOrEqual(MIN_QUALITY_SCORE);
  });

  it('extracts legal name correctly', () => {
    expect(data.partA?.legalName?.toLowerCase()).toContain('socios');
  });

  it('extracts country correctly', () => {
    expect(data.partA?.country).toBe('CH');
  });

  it('extracts crypto-asset name', () => {
    expect(data.partD?.cryptoAssetName).toContain('PERSIJA');
  });

  it('extracts token price', () => {
    expect(data.partE?.tokenPrice).toBe(0.5);
  });

  it('extracts energy consumption', () => {
    expect(data.partJ?.energyConsumption).toBeCloseTo(86.68176, 2);
  });
});

// ===========================================================================
// Raw Fields
// ===========================================================================

describe('PERSIJA Raw Fields', () => {
  it('meets minimum quality score', () => {
    let pass = 0;
    let total = 0;
    const raw = data.rawFields ?? {};
    for (const [fieldNum, matcher] of Object.entries(expected.rawFields)) {
      total++;
      if (matchField(raw[fieldNum], matcher)) pass++;
    }
    const pct = Math.round((pass / total) * 100);
    expect(pct).toBeGreaterThanOrEqual(MIN_QUALITY_SCORE);
  });

  it('extracts A.1 (legal name)', () => {
    expect(data.rawFields?.['A.1']).toBe('Socios Technologies AG');
  });

  it('extracts E.12 (total offering)', () => {
    expect(data.rawFields?.['E.12']).toContain('50,000');
  });

  it('extracts S.3 (symbol)', () => {
    expect(data.rawFields?.['S.3']).toContain('PERSIJA');
  });
});

// ===========================================================================
// Validation
// ===========================================================================

describe('PERSIJA Validation', () => {
  it('passes all LEI checks with placeholder', () => {
    expect(validation.assertionCounts.lei.failed).toBe(0);
  });

  it('has no duplicate facts', () => {
    expect(validation.assertionCounts.duplicate.failed).toBe(0);
  });

  it('passes all existence assertions', () => {
    expect(validation.assertionCounts.existence.failed).toBe(0);
  });

  it('passes all value assertions', () => {
    expect(validation.assertionCounts.value.failed).toBe(0);
  });
});

// ===========================================================================
// iXBRL Structure
// ===========================================================================

describe('PERSIJA iXBRL Structure', () => {
  it('starts with XML declaration', () => {
    expect(ixbrl.startsWith('<?xml version="1.0"')).toBe(true);
  });

  it('declares all required namespaces', () => {
    for (const ns of expected.iXBRL.requiredNamespaces) {
      expect(ixbrl).toContain(`xmlns:${ns}`);
    }
  });

  it('contains ix:header', () => {
    expect(ixbrl).toContain('<ix:header>');
  });

  it('has sufficient ix:nonNumeric facts', () => {
    const count = (ixbrl.match(/<ix:nonNumeric/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(expected.iXBRL.minNonNumericFacts);
  });

  it('has ix:nonFraction facts', () => {
    const count = (ixbrl.match(/<ix:nonFraction/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(expected.iXBRL.minNonFractionFacts);
  });

  it('contains required content', () => {
    for (const text of expected.iXBRL.mustContain) {
      expect(ixbrl).toContain(text);
    }
  });

  it('does not contain stray undefined/null/NaN', () => {
    for (const text of expected.iXBRL.mustNotContain) {
      const pattern = new RegExp(`(?<![a-zA-Z])${text}(?![a-zA-Z])`, 'i');
      expect(pattern.test(ixbrl)).toBe(false);
    }
  });

  it('uses scenario not segment for dimensions', () => {
    expect(ixbrl).not.toContain('xbrli:segment');
  });

  it('embeds CSS inline', () => {
    expect(ixbrl).toContain('<style');
    expect(ixbrl).not.toMatch(/<link[^>]+rel=["']stylesheet["']/);
  });
});
