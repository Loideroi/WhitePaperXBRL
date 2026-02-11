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

/**
 * All 192 editor fields from the transform page SECTIONS constant.
 * Duplicated here as a static list to avoid importing from a 'use client' module.
 */
const EDITOR_FIELDS: { path: string; type: string; section: string }[] = [
  // Part A (21 fields)
  { path: 'partA.legalName', type: 'text', section: 'partA' },
  { path: 'rawFields.A.2', type: 'text', section: 'partA' },
  { path: 'partA.registeredAddress', type: 'textblock', section: 'partA' },
  { path: 'partA.country', type: 'enumeration', section: 'partA' },
  { path: 'rawFields.A.3s', type: 'text', section: 'partA' },
  { path: 'rawFields.A.4', type: 'text', section: 'partA' },
  { path: 'rawFields.A.4c', type: 'enumeration', section: 'partA' },
  { path: 'rawFields.A.5', type: 'date', section: 'partA' },
  { path: 'partA.lei', type: 'text', section: 'partA' },
  { path: 'rawFields.A.7', type: 'text', section: 'partA' },
  { path: 'partA.contactPhone', type: 'text', section: 'partA' },
  { path: 'partA.contactEmail', type: 'text', section: 'partA' },
  { path: 'rawFields.A.10', type: 'number', section: 'partA' },
  { path: 'rawFields.A.11', type: 'text', section: 'partA' },
  { path: 'rawFields.A.13', type: 'textblock', section: 'partA' },
  { path: 'rawFields.A.14', type: 'textblock', section: 'partA' },
  { path: 'rawFields.A.15', type: 'boolean', section: 'partA' },
  { path: 'rawFields.A.16a', type: 'textblock', section: 'partA' },
  { path: 'rawFields.A.16b', type: 'textblock', section: 'partA' },
  { path: 'rawFields.A.17', type: 'textblock', section: 'partA' },
  { path: 'partA.website', type: 'text', section: 'partA' },
  // Part B (14 fields)
  { path: 'rawFields.B.1', type: 'boolean', section: 'partB' },
  { path: 'partB.legalName', type: 'text', section: 'partB' },
  { path: 'rawFields.B.3', type: 'text', section: 'partB' },
  { path: 'partB.registeredAddress', type: 'text', section: 'partB' },
  { path: 'rawFields.B.4c', type: 'enumeration', section: 'partB' },
  { path: 'rawFields.B.5', type: 'text', section: 'partB' },
  { path: 'rawFields.B.5c', type: 'enumeration', section: 'partB' },
  { path: 'rawFields.B.6', type: 'date', section: 'partB' },
  { path: 'partB.lei', type: 'text', section: 'partB' },
  { path: 'rawFields.B.8', type: 'text', section: 'partB' },
  { path: 'rawFields.B.9', type: 'text', section: 'partB' },
  { path: 'rawFields.B.11', type: 'textblock', section: 'partB' },
  { path: 'rawFields.B.12', type: 'textblock', section: 'partB' },
  { path: 'rawFields.B.13', type: 'textblock', section: 'partB' },
  // Part C (18 fields)
  { path: 'partC.legalName', type: 'text', section: 'partC' },
  { path: 'rawFields.C.2', type: 'text', section: 'partC' },
  { path: 'partC.registeredAddress', type: 'text', section: 'partC' },
  { path: 'rawFields.C.3c', type: 'enumeration', section: 'partC' },
  { path: 'rawFields.C.4', type: 'text', section: 'partC' },
  { path: 'rawFields.C.4c', type: 'enumeration', section: 'partC' },
  { path: 'rawFields.C.5', type: 'date', section: 'partC' },
  { path: 'partC.lei', type: 'text', section: 'partC' },
  { path: 'rawFields.C.7', type: 'text', section: 'partC' },
  { path: 'rawFields.C.8', type: 'text', section: 'partC' },
  { path: 'rawFields.C.10', type: 'number', section: 'partC' },
  { path: 'rawFields.C.11', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.12a', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.12b', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.13a', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.13b', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.14', type: 'textblock', section: 'partC' },
  { path: 'rawFields.C.15', type: 'textblock', section: 'partC' },
  // Part D (16 fields)
  { path: 'partD.cryptoAssetName', type: 'text', section: 'partD' },
  { path: 'partD.cryptoAssetSymbol', type: 'text', section: 'partD' },
  { path: 'partD.projectDescription', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.5', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.6', type: 'boolean', section: 'partD' },
  { path: 'rawFields.D.7', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.8', type: 'date', section: 'partD' },
  { path: 'rawFields.D.9', type: 'boolean', section: 'partD' },
  { path: 'rawFields.D.10', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.11', type: 'boolean', section: 'partD' },
  { path: 'rawFields.D.12', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.13', type: 'textblock', section: 'partD' },
  { path: 'rawFields.D.14', type: 'textblock', section: 'partD' },
  { path: 'partD.totalSupply', type: 'number', section: 'partD' },
  { path: 'partD.tokenStandard', type: 'text', section: 'partD' },
  { path: 'partD.blockchainNetwork', type: 'text', section: 'partD' },
  { path: 'partD.consensusMechanism', type: 'text', section: 'partD' },
  // Part E (40 fields)
  { path: 'rawFields.E.1', type: 'enumeration', section: 'partE' },
  { path: 'rawFields.E.2', type: 'textblock', section: 'partE' },
  { path: 'partE.maxSubscriptionGoal', type: 'monetary', section: 'partE' },
  { path: 'rawFields.E.3a', type: 'number', section: 'partE' },
  { path: 'rawFields.E.4', type: 'monetary', section: 'partE' },
  { path: 'rawFields.E.5', type: 'monetary', section: 'partE' },
  { path: 'rawFields.E.6', type: 'boolean', section: 'partE' },
  { path: 'rawFields.E.7', type: 'textblock', section: 'partE' },
  { path: 'partE.tokenPrice', type: 'monetary', section: 'partE' },
  { path: 'rawFields.E.9', type: 'enumeration', section: 'partE' },
  { path: 'rawFields.E.9a', type: 'text', section: 'partE' },
  { path: 'rawFields.E.10', type: 'monetary', section: 'partE' },
  { path: 'rawFields.E.11', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.12', type: 'number', section: 'partE' },
  { path: 'rawFields.E.13', type: 'enumeration', section: 'partE' },
  { path: 'rawFields.E.14', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.15', type: 'boolean', section: 'partE' },
  { path: 'rawFields.E.16', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.17', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.18', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.19', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.20', type: 'boolean', section: 'partE' },
  { path: 'partE.publicOfferingStartDate', type: 'date', section: 'partE' },
  { path: 'partE.publicOfferingEndDate', type: 'date', section: 'partE' },
  { path: 'rawFields.E.23', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.24', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.25', type: 'textblock', section: 'partE' },
  { path: 'partE.withdrawalRights', type: 'boolean', section: 'partE' },
  { path: 'rawFields.E.27', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.28', type: 'text', section: 'partE' },
  { path: 'rawFields.E.29', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.30', type: 'text', section: 'partE' },
  { path: 'rawFields.E.31', type: 'text', section: 'partE' },
  { path: 'rawFields.E.32', type: 'enumeration', section: 'partE' },
  { path: 'rawFields.E.33', type: 'text', section: 'partE' },
  { path: 'rawFields.E.34', type: 'text', section: 'partE' },
  { path: 'rawFields.E.35', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.36', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.37', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.38', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.39', type: 'textblock', section: 'partE' },
  { path: 'rawFields.E.40', type: 'textblock', section: 'partE' },
  // Part F (19 fields)
  { path: 'partF.classification', type: 'text', section: 'partF' },
  { path: 'rawFields.F.2', type: 'textblock', section: 'partF' },
  { path: 'rawFields.F.3', type: 'textblock', section: 'partF' },
  { path: 'rawFields.F.4', type: 'enumeration', section: 'partF' },
  { path: 'rawFields.F.5', type: 'enumeration', section: 'partF' },
  { path: 'rawFields.F.6', type: 'textblock', section: 'partF' },
  { path: 'rawFields.F.7', type: 'text', section: 'partF' },
  { path: 'rawFields.F.8', type: 'text', section: 'partF' },
  { path: 'rawFields.F.9', type: 'date', section: 'partF' },
  { path: 'rawFields.F.10', type: 'date', section: 'partF' },
  { path: 'rawFields.F.11', type: 'textblock', section: 'partF' },
  { path: 'rawFields.F.12', type: 'text', section: 'partF' },
  { path: 'rawFields.F.13', type: 'text', section: 'partF' },
  { path: 'rawFields.F.14', type: 'text', section: 'partF' },
  { path: 'rawFields.F.15', type: 'boolean', section: 'partF' },
  { path: 'rawFields.F.16', type: 'boolean', section: 'partF' },
  { path: 'rawFields.F.17', type: 'boolean', section: 'partF' },
  { path: 'rawFields.F.18', type: 'enumeration', section: 'partF' },
  { path: 'partF.rightsDescription', type: 'textblock', section: 'partF' },
  // Part G (19 fields)
  { path: 'partG.purchaseRights', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.2', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.3', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.4', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.5', type: 'number', section: 'partG' },
  { path: 'rawFields.G.6', type: 'boolean', section: 'partG' },
  { path: 'rawFields.G.7', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.8', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.9', type: 'boolean', section: 'partG' },
  { path: 'rawFields.G.10', type: 'textblock', section: 'partG' },
  { path: 'partG.transferRestrictions', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.12', type: 'boolean', section: 'partG' },
  { path: 'partG.dynamicSupplyMechanism', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.14', type: 'boolean', section: 'partG' },
  { path: 'rawFields.G.15', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.16', type: 'boolean', section: 'partG' },
  { path: 'rawFields.G.17', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.18', type: 'textblock', section: 'partG' },
  { path: 'rawFields.G.19', type: 'textblock', section: 'partG' },
  // Part H (10 fields)
  { path: 'partH.blockchainDescription', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.2', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.3', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.4', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.5', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.6', type: 'boolean', section: 'partH' },
  { path: 'rawFields.H.7', type: 'textblock', section: 'partH' },
  { path: 'rawFields.H.8', type: 'boolean', section: 'partH' },
  { path: 'rawFields.H.9', type: 'textblock', section: 'partH' },
  { path: 'partH.smartContractInfo', type: 'textblock', section: 'partH' },
  // Part I (10 fields)
  { path: 'rawFields.I.1', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.2', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.02a', type: 'boolean', section: 'partI' },
  { path: 'rawFields.I.02b', type: 'boolean', section: 'partI' },
  { path: 'rawFields.I.03', type: 'boolean', section: 'partI' },
  { path: 'rawFields.I.3', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.4', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.5', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.6', type: 'textblock', section: 'partI' },
  { path: 'rawFields.I.07', type: 'textblock', section: 'partI' },
  // Part J (4 fields)
  { path: 'rawFields.J.1', type: 'textblock', section: 'partJ' },
  { path: 'partJ.energyConsumption', type: 'number', section: 'partJ' },
  { path: 'partJ.consensusMechanismType', type: 'text', section: 'partJ' },
  { path: 'partJ.renewableEnergyPercentage', type: 'number', section: 'partJ' },
  // Sustainability (20 fields)
  { path: 'rawFields.S.1', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.2', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.3', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.4', type: 'textblock', section: 'sustainability' },
  { path: 'rawFields.S.5', type: 'textblock', section: 'sustainability' },
  { path: 'rawFields.S.6', type: 'date', section: 'sustainability' },
  { path: 'rawFields.S.7', type: 'date', section: 'sustainability' },
  { path: 'rawFields.S.8', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.9', type: 'textblock', section: 'sustainability' },
  { path: 'rawFields.S.10', type: 'number', section: 'sustainability' },
  { path: 'rawFields.S.11', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.12', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.13', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.14', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.15', type: 'textblock', section: 'sustainability' },
  { path: 'rawFields.S.16', type: 'textblock', section: 'sustainability' },
  { path: 'rawFields.S.17', type: 'number', section: 'sustainability' },
  { path: 'rawFields.S.18', type: 'text', section: 'sustainability' },
  { path: 'rawFields.S.19', type: 'number', section: 'sustainability' },
  { path: 'rawFields.S.20', type: 'text', section: 'sustainability' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  // rawFields keys contain dots (e.g., "A.2", "E.14") — treat as single key
  if (dotPath.startsWith('rawFields.')) {
    const rawFieldKey = dotPath.slice('rawFields.'.length);
    const rawFields = obj.rawFields as Record<string, unknown> | undefined;
    return rawFields?.[rawFieldKey];
  }

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

function checkFieldCoverage(data: Partial<WhitepaperData>): void {
  const total = EDITOR_FIELDS.length;
  let populated = 0;
  let typeMismatch = 0;
  let missing = 0;

  const sectionStats: Record<string, { populated: number; mismatch: number; missing: number; total: number }> = {};
  const missingPaths: string[] = [];

  for (const field of EDITOR_FIELDS) {
    if (!sectionStats[field.section]) {
      sectionStats[field.section] = { populated: 0, mismatch: 0, missing: 0, total: 0 };
    }
    sectionStats[field.section].total++;

    const value = getNestedValue(data as Record<string, unknown>, field.path);

    if (value === undefined || value === null || value === '') {
      missing++;
      sectionStats[field.section].missing++;
      missingPaths.push(field.path);
      continue;
    }

    // Check for type mismatches — only for typed paths, not rawFields.
    // rawFields are always strings (z.record(z.string(), z.string()));
    // the UI layer handles coercion to boolean/number/monetary at render time.
    let isMismatch = false;
    if (!field.path.startsWith('rawFields.')) {
      if (field.type === 'boolean' && typeof value === 'string') isMismatch = true;
      if (field.type === 'number' && typeof value === 'string') isMismatch = true;
      if (field.type === 'monetary' && typeof value === 'string') isMismatch = true;
    }

    if (isMismatch) {
      typeMismatch++;
      sectionStats[field.section].mismatch++;
    } else {
      populated++;
      sectionStats[field.section].populated++;
    }
  }

  console.log('  FIELD COVERAGE:');
  console.log(`  Populated:     ${populated}/${total} (${Math.round((populated / total) * 100)}%)`);
  if (typeMismatch > 0) {
    console.log(`  Type mismatch: ${typeMismatch}/${total} (${Math.round((typeMismatch / total) * 100)}%) — raw strings needing coercion`);
  }
  console.log(`  Missing:       ${missing}/${total} (${Math.round((missing / total) * 100)}%)`);
  console.log('');

  // Section breakdown
  const sectionLabels: Record<string, string> = {
    partA: 'Part A', partB: 'Part B', partC: 'Part C', partD: 'Part D',
    partE: 'Part E', partF: 'Part F', partG: 'Part G', partH: 'Part H',
    partI: 'Part I', partJ: 'Part J', sustainability: 'Annex S',
  };

  console.log('  By section:');
  for (const [section, stats] of Object.entries(sectionStats)) {
    const label = pad(sectionLabels[section] || section, 10);
    const parts: string[] = [`${stats.populated}/${stats.total} populated`];
    if (stats.mismatch > 0) parts.push(`${stats.mismatch} mismatch`);
    parts.push(`${stats.missing} missing`);
    console.log(`    ${label} ${parts.join(', ')}`);
  }
  console.log('');

  if (missingPaths.length > 0 && missingPaths.length <= 30) {
    console.log('  Missing fields (no extracted content):');
    console.log(`    ${missingPaths.join(', ')}`);
    console.log('');
  }
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

  // --- Stage 4b: Field Coverage (informational) ---
  checkFieldCoverage(data);

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
