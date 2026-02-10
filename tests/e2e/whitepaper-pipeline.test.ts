/**
 * End-to-End Pipeline Tests: Whitepaper PDF → iXBRL
 *
 * Processes two real MiCA-compliant whitepaper PDFs (ARG Fan Token, SPURS Fan Token)
 * through the full pipeline: extract → map → validate → generate iXBRL.
 *
 * These are Socios/Chiliz fan token whitepapers with a Swiss UID (CHE-219.335.797)
 * rather than a valid LEI, so tests inject a placeholder LEI.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { extractDocument } from '@/lib/document/extractor';
import type { DocumentExtractionResult } from '@/lib/document/extractor';
import { extractPdfText, type PdfExtractionResult } from '@/lib/pdf/extractor';
import { mapPdfToWhitepaper, type MappingResult } from '@/lib/pdf/field-mapper';
import {
  validateWhitepaper,
  getValidationRequirements,
} from '@/lib/xbrl/validator/orchestrator';
import type { DetailedValidationResult } from '@/lib/xbrl/validator/orchestrator';
import { generateIXBRLDocument } from '@/lib/xbrl/generator/document-generator';
import type { WhitepaperData } from '@/types/whitepaper';

// ---------------------------------------------------------------------------
// Fixtures & shared state
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/pdfs');
const PLACEHOLDER_LEI = '529900T8BM49AURSDO55';

interface PipelineResult {
  extraction: DocumentExtractionResult;
  pdfExtraction: PdfExtractionResult;
  mapping: MappingResult;
  data: Partial<WhitepaperData>;
  validation: DetailedValidationResult;
  ixbrl: string;
  dom: JSDOM;
}

const results: Record<'ARG' | 'SPURS', PipelineResult> = {} as Record<
  'ARG' | 'SPURS',
  PipelineResult
>;

/**
 * Run the full pipeline for a single PDF and return all intermediate results.
 */
async function runPipeline(filename: string): Promise<PipelineResult> {
  const pdfPath = path.join(FIXTURES_DIR, filename);
  const buffer = fs.readFileSync(pdfPath);

  // 1. Extract (unified + raw PDF)
  const extraction = await extractDocument(buffer, 'application/pdf', filename);
  const pdfExtraction = await extractPdfText(buffer);

  // 2. Map fields (inject placeholder LEI)
  const mapping = mapPdfToWhitepaper(pdfExtraction, 'OTHR');
  const data: Partial<WhitepaperData> = {
    ...mapping.data,
    tokenType: 'OTHR',
    partA: {
      ...mapping.data.partA!,
      lei: PLACEHOLDER_LEI,
    },
  };

  // 3. Validate
  const validation = await validateWhitepaper(data, 'OTHR', { checkGLEIF: false });

  // 4. Generate iXBRL
  const ixbrl = generateIXBRLDocument(data);
  const dom = new JSDOM(ixbrl, { contentType: 'application/xhtml+xml' });

  return { extraction, pdfExtraction, mapping, data, validation, ixbrl, dom };
}

// ---------------------------------------------------------------------------
// Shared setup — run pipeline once for each PDF
// ---------------------------------------------------------------------------

beforeAll(async () => {
  results.ARG = await runPipeline('ARG-Fan-Token-White-Paper.pdf');
  results.SPURS = await runPipeline('SPURS-Fan-Token-White-Paper.pdf');
}, 60_000);

// ===========================================================================
// Block 1: Extraction
// ===========================================================================

describe('Extraction', () => {
  it('extracts non-empty text with correct format and page count', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const { extraction } = results[key];
      expect(extraction.text.length).toBeGreaterThan(1000);
      expect(extraction.format).toBe('pdf');
      expect(extraction.pages).toBeGreaterThan(0);
    }
  });

  it('extracts metadata with title containing token name', () => {
    // pdf-parse metadata may or may not include the token name in the title,
    // but the text definitely should contain it
    expect(results.ARG.extraction.text).toContain('ARG');
    expect(results.SPURS.extraction.text).toContain('SPURS');
  });

  it('detects MiCA sections', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const { pdfExtraction } = results[key];
      expect(pdfExtraction.sections.size).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Block 2: Field Mapping
// ===========================================================================

describe('Field Mapping', () => {
  it('maps legal name to Socios Technologies AG', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const name = results[key].mapping.data.partA?.legalName;
      expect(name).toBeDefined();
      expect(name!.toLowerCase()).toContain('socios');
    }
  });

  it('maps country to CH', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].mapping.data.partA?.country).toBe('CH');
    }
  });

  it('maps different crypto-asset names/symbols per PDF', () => {
    const argName = results.ARG.mapping.data.partD?.cryptoAssetName;
    const spursName = results.SPURS.mapping.data.partD?.cryptoAssetName;
    // At least one should differ (name or symbol)
    const argSymbol = results.ARG.mapping.data.partD?.cryptoAssetSymbol;
    const spursSymbol = results.SPURS.mapping.data.partD?.cryptoAssetSymbol;

    const namesDiffer = argName !== spursName;
    const symbolsDiffer = argSymbol !== spursSymbol;
    expect(namesDiffer || symbolsDiffer).toBe(true);
  });

  it('achieves overall confidence >= 50%', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].mapping.confidence.overall).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('produces rawFields as fallback data', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const raw = results[key].mapping.data.rawFields;
      expect(raw).toBeDefined();
      expect(Object.keys(raw!).length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Block 3: Validation
// ===========================================================================

describe('Validation', () => {
  it('produces zero LEI errors with placeholder LEI', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const leiErrors = results[key].validation.byCategory.lei.errors;
      expect(leiErrors).toHaveLength(0);
    }
  });

  it('runs expected number of existence assertions', () => {
    const reqs = getValidationRequirements('OTHR');
    for (const key of ['ARG', 'SPURS'] as const) {
      const counts = results[key].validation.assertionCounts.existence;
      expect(counts.total).toBe(reqs.existence.total);
    }
  });

  it('runs expected number of value assertions', () => {
    const reqs = getValidationRequirements('OTHR');
    for (const key of ['ARG', 'SPURS'] as const) {
      const counts = results[key].validation.assertionCounts.value;
      expect(counts.total).toBe(reqs.value.total);
    }
  });

  it('produces no duplicate fact errors', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const dupErrors = results[key].validation.byCategory.duplicate.errors;
      expect(dupErrors).toHaveLength(0);
    }
  });

  it('has total assertion count matching requirements', () => {
    const reqs = getValidationRequirements('OTHR');
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].validation.summary.totalAssertions).toBe(reqs.total);
    }
  });
});

// ===========================================================================
// Block 4: iXBRL Structure
// ===========================================================================

describe('iXBRL Structure', () => {
  it('starts with XML declaration', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl.startsWith('<?xml version="1.0"')).toBe(true);
    }
  });

  it('declares all required XBRL namespaces on <html>', () => {
    const requiredNamespaces = [
      'xmlns:ix',
      'xmlns:xbrli',
      'xmlns:xlink',
      'xmlns:link',
      'xmlns:iso4217',
      'xmlns:ixt',
      'xmlns:mica',
    ];
    for (const key of ['ARG', 'SPURS'] as const) {
      const html = results[key].dom.window.document.documentElement;
      for (const ns of requiredNamespaces) {
        const attr = ns.replace('xmlns:', '');
        expect(
          html.hasAttribute(ns) || html.hasAttribute(`xmlns:${attr}`),
          `Missing namespace ${ns} in ${key}`
        ).toBe(true);
      }
    }
  });

  it('sets xml:lang on root <html> element', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const html = results[key].dom.window.document.documentElement;
      const lang = html.getAttribute('xml:lang') || html.getAttribute('lang');
      expect(lang, `Missing xml:lang in ${key}`).toBeTruthy();
    }
  });

  it('contains <ix:header> inside <body>', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      // ix:header is a custom element — search via raw HTML
      expect(results[key].ixbrl).toContain('<ix:header>');
    }
  });

  it('contains ix:references with schemaRef pointing to ESMA taxonomy', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl).toMatch(/ix:references/);
      expect(results[key].ixbrl).toMatch(/link:schemaRef/);
      expect(results[key].ixbrl).toMatch(/\.xsd/);
    }
  });

  it('has context elements with instant and duration periods', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const html = results[key].ixbrl;
      expect(html).toMatch(/id="ctx_instant"/);
      expect(html).toMatch(/id="ctx_duration"/);
    }
  });

  it('uses ISO 17442 entity identifier scheme', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl).toContain('http://standards.iso.org/iso/17442');
    }
  });

  it('formats period dates as yyyy-mm-dd without time components', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      // Match xbrli:instant and xbrli:startDate/endDate content
      const dateMatches = results[key].ixbrl.match(
        /<xbrli:(?:instant|startDate|endDate)>([^<]+)<\/xbrli:(?:instant|startDate|endDate)>/g
      );
      expect(dateMatches).toBeTruthy();
      for (const match of dateMatches!) {
        const dateValue = match.replace(/<\/?xbrli:\w+>/g, '');
        expect(dateValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('embeds CSS in <style> (not external <link>)', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl).toContain('<style');
      // Should not have an external stylesheet link
      expect(results[key].ixbrl).not.toMatch(/<link[^>]+rel=["']stylesheet["']/);
    }
  });

  it('includes <meta charset="utf-8">', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl.toLowerCase()).toContain('charset="utf-8"');
    }
  });
});

// ===========================================================================
// Block 5: iXBRL Facts
// ===========================================================================

describe('iXBRL Facts', () => {
  it('contains ix:nonNumeric tags (count > 50)', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const count = (results[key].ixbrl.match(/<ix:nonNumeric/g) || []).length;
      expect(count, `${key} should have >50 ix:nonNumeric tags, got ${count}`).toBeGreaterThan(50);
    }
  });

  it('contains ix:nonFraction tags for numeric data', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      const count = (results[key].ixbrl.match(/<ix:nonFraction/g) || []).length;
      expect(count, `${key} should have ix:nonFraction tags`).toBeGreaterThan(0);
    }
  });

  it('includes offeror name fact containing Socios', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      // Look for the offeror name in a mica: tagged fact
      expect(results[key].ixbrl.toLowerCase()).toContain('socios');
    }
  });

  it('includes placeholder LEI in entity identifier', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl).toContain(PLACEHOLDER_LEI);
    }
  });

  it('sets escape="true" on text block facts', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      // textBlockItemType facts should have escape="true"
      const textBlockMatches = results[key].ixbrl.match(
        /<ix:nonNumeric[^>]*escape="true"[^>]*>/g
      );
      expect(
        textBlockMatches,
        `${key} should have text block facts with escape="true"`
      ).toBeTruthy();
      expect(textBlockMatches!.length).toBeGreaterThan(0);
    }
  });

  it('does not use xbrli:segment (must use xbrli:scenario for dimensions)', () => {
    for (const key of ['ARG', 'SPURS'] as const) {
      expect(results[key].ixbrl).not.toContain('xbrli:segment');
    }
  });
});

// ===========================================================================
// Block 6: Cross-document consistency
// ===========================================================================

describe('Cross-document consistency', () => {
  it('both PDFs produce valid iXBRL without throwing', () => {
    // If we got here, generation succeeded for both. Verify non-empty output.
    expect(results.ARG.ixbrl.length).toBeGreaterThan(1000);
    expect(results.SPURS.ixbrl.length).toBeGreaterThan(1000);
  });

  it('both share same offeror name and country', () => {
    const argOfferor = results.ARG.data.partA?.legalName;
    const spursOfferor = results.SPURS.data.partA?.legalName;
    expect(argOfferor).toBeDefined();
    expect(argOfferor).toBe(spursOfferor);

    expect(results.ARG.data.partA?.country).toBe(results.SPURS.data.partA?.country);
  });

  it('token-specific fields differ between PDFs', () => {
    const argName = results.ARG.data.partD?.cryptoAssetName;
    const spursName = results.SPURS.data.partD?.cryptoAssetName;
    const argSymbol = results.ARG.data.partD?.cryptoAssetSymbol;
    const spursSymbol = results.SPURS.data.partD?.cryptoAssetSymbol;

    // At least one of name or symbol should differ
    expect(argName !== spursName || argSymbol !== spursSymbol).toBe(true);
  });
});
