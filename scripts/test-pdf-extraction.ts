/**
 * Test script for PDF extraction and iXBRL generation
 *
 * Run with: npx tsx scripts/test-pdf-extraction.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { extractPdfText } from '../src/lib/pdf/extractor';
import { mapPdfToWhitepaper } from '../src/lib/pdf/field-mapper';
import { generateIXBRLDocument } from '../src/lib/xbrl/generator/document-generator';
import type { WhitepaperData } from '../src/types/whitepaper';

async function main() {
  const pdfPath = process.argv[2] || '/Users/markverdegaal/Downloads/$SPURS Fan Token White Paper Fake (1).pdf';

  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found:', pdfPath);
    process.exit(1);
  }

  console.log('Testing extraction on:', pdfPath);
  console.log('---');

  // Read PDF
  const buffer = fs.readFileSync(pdfPath);

  // Extract text
  console.log('Extracting PDF text...');
  const extraction = await extractPdfText(buffer);
  console.log(`Extracted ${extraction.pages} pages, ${extraction.text.length} characters`);
  console.log('---');

  // Map to whitepaper
  console.log('Mapping to whitepaper fields...');
  const mapping = mapPdfToWhitepaper(extraction, 'OTHR');

  // Output extraction results
  console.log('\n=== TYPED FIELD MAPPINGS ===');
  console.log('Total mappings:', mapping.mappings.length);
  for (const m of mapping.mappings.slice(0, 20)) {
    console.log(`  ${m.path}: ${JSON.stringify(m.value).slice(0, 80)} [${m.confidence}]`);
  }
  if (mapping.mappings.length > 20) {
    console.log(`  ... and ${mapping.mappings.length - 20} more`);
  }

  console.log('\n=== RAW FIELDS EXTRACTED ===');
  const rawFields = mapping.data.rawFields || {};
  const fieldKeys = Object.keys(rawFields).sort((a, b) => {
    // Sort by section, then by number
    const [aLetter, aNum] = a.split('.').map(x => x || '');
    const [bLetter, bNum] = b.split('.').map(x => x || '');
    if (aLetter !== bLetter) return aLetter.localeCompare(bLetter);
    return parseInt(aNum || '0', 10) - parseInt(bNum || '0', 10);
  });

  console.log('Total raw fields:', fieldKeys.length);

  console.log('\n=== CONFIDENCE ===');
  console.log('Overall:', mapping.confidence.overall + '%');
  console.log('By section:', mapping.confidence.bySection);

  // Generate iXBRL
  console.log('\n=== GENERATING iXBRL ===');
  const ixbrl = generateIXBRLDocument(mapping.data as Partial<WhitepaperData>);
  console.log(`Generated iXBRL document: ${ixbrl.length} characters`);

  // Write output file
  const outputPath = '/Users/markverdegaal/Downloads/whitepaper-spurs-test.xhtml';
  fs.writeFileSync(outputPath, ixbrl, 'utf-8');
  console.log(`Written to: ${outputPath}`);

  // Quick check - count how many fields have content
  const fieldContentCount = (ixbrl.match(/<ix:nonNumeric[^>]*>[^<]+<\/ix:nonNumeric>/g) || []).length;
  console.log(`\nInline XBRL fact count: ${fieldContentCount}`);

  // Check for specific fields in output
  const checkFields = ['A.1', 'A.3', 'B.1', 'C.1', 'D.1', 'E.1', 'F.1', 'G.1', 'H.1', 'I.1', 'S.1'];
  console.log('\n=== FIELD PRESENCE CHECK ===');
  for (const field of checkFields) {
    const hasField = ixbrl.includes(`<td>${field}</td>`);
    const nextTdMatch = ixbrl.match(new RegExp(`<td>${field.replace('.', '\\.')}</td>\\s*<td>[^<]+</td>\\s*<td>([^<]{1,50})`));
    const preview = nextTdMatch ? nextTdMatch[1].slice(0, 40) : '(empty)';
    console.log(`  ${field}: ${hasField ? '✓' : '✗'} ${preview}`);
  }
}

main().catch(console.error);
