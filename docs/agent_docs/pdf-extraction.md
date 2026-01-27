# PDF Extraction Guide - WhitePaper XBRL

## Overview

This document describes the PDF extraction strategy for converting whitepaper PDFs into structured data that can be transformed into iXBRL format.

---

## Extraction Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │───>│   Parse     │───>│   Map       │───>│  Validate   │
│   PDF       │    │   Text      │    │   Fields    │    │  Data       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Step 1: PDF Parsing

### Recommended Library

**pdf-parse** - Simple text extraction, no rendering

```typescript
import pdfParse from 'pdf-parse';

async function extractPdfText(buffer: Buffer): Promise<PdfContent> {
  const data = await pdfParse(buffer);

  return {
    text: data.text,
    pages: data.numpages,
    metadata: data.info,
  };
}
```

### Alternative: pdf.js

For more complex layouts, use pdf.js:

```typescript
import * as pdfjsLib from 'pdfjs-dist';

async function extractWithPdfJs(buffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(text);
  }

  return pages;
}
```

---

## Step 2: Content Parsing

### Section Detection

Whitepapers follow a structured format with Parts A-J. Detect sections using regex patterns:

```typescript
const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /^summary$/im,
  partA: /^part\s*a[:\s]/im,
  partB: /^part\s*b[:\s]/im,
  partC: /^part\s*c[:\s]/im,
  partD: /^part\s*d[:\s]/im,
  partE: /^part\s*e[:\s]/im,
  partF: /^part\s*f[:\s]/im,
  partG: /^part\s*g[:\s]/im,
  partH: /^part\s*h[:\s]/im,
  partI: /^part\s*i[:\s]/im,
  partJ: /^part\s*j[:\s]/im,
};

function detectSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = text.split('\n');

  let currentSection: string | null = null;
  let sectionContent: string[] = [];

  for (const line of lines) {
    for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line)) {
        // Save previous section
        if (currentSection) {
          sections.set(currentSection, sectionContent.join('\n'));
        }
        currentSection = sectionName;
        sectionContent = [];
        break;
      }
    }
    if (currentSection) {
      sectionContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections.set(currentSection, sectionContent.join('\n'));
  }

  return sections;
}
```

### Table Extraction

The example whitepaper uses table format (No. | Field | Content):

```typescript
interface TableRow {
  number: string;
  field: string;
  content: string;
}

function extractTableRows(sectionText: string): TableRow[] {
  const rows: TableRow[] = [];

  // Match numbered rows like "A.1" or "1." followed by field name and content
  const rowPattern = /^([A-Z]?\d+(?:\.\d+)?)\s+(.+?)\s{2,}(.+)$/gm;

  let match;
  while ((match = rowPattern.exec(sectionText)) !== null) {
    rows.push({
      number: match[1],
      field: match[2].trim(),
      content: match[3].trim(),
    });
  }

  return rows;
}
```

---

## Step 3: Field Mapping

### Field Mapping Configuration

```typescript
interface FieldMapping {
  sourcePattern: RegExp | string[];
  targetPath: string;
  transform?: (value: string) => unknown;
  confidence: 'high' | 'medium' | 'low';
}

const FIELD_MAPPINGS: FieldMapping[] = [
  // Part A: Offeror
  {
    sourcePattern: /legal\s*name|company\s*name|entity\s*name/i,
    targetPath: 'partA.legalName',
    confidence: 'high',
  },
  {
    sourcePattern: /lei|legal\s*entity\s*identifier/i,
    targetPath: 'partA.lei',
    transform: (v) => v.replace(/\s/g, '').toUpperCase(),
    confidence: 'high',
  },
  {
    sourcePattern: /registered\s*address|business\s*address/i,
    targetPath: 'partA.registeredAddress',
    confidence: 'medium',
  },
  {
    sourcePattern: /country\s*of\s*registration|home\s*member\s*state/i,
    targetPath: 'partA.country',
    confidence: 'medium',
  },
  {
    sourcePattern: /website|url/i,
    targetPath: 'partA.website',
    transform: extractUrl,
    confidence: 'high',
  },

  // Part D: Project
  {
    sourcePattern: /crypto[\s-]*asset\s*name|token\s*name/i,
    targetPath: 'partD.cryptoAssetName',
    confidence: 'high',
  },
  {
    sourcePattern: /ticker|symbol/i,
    targetPath: 'partD.cryptoAssetSymbol',
    transform: (v) => v.replace(/[$]/g, '').toUpperCase(),
    confidence: 'high',
  },
  {
    sourcePattern: /total\s*supply|maximum\s*supply/i,
    targetPath: 'partD.totalSupply',
    transform: parseNumber,
    confidence: 'high',
  },
  {
    sourcePattern: /token\s*standard|protocol/i,
    targetPath: 'partD.tokenStandard',
    confidence: 'medium',
  },
  {
    sourcePattern: /blockchain|network|chain/i,
    targetPath: 'partD.blockchainNetwork',
    confidence: 'medium',
  },
  {
    sourcePattern: /consensus\s*mechanism/i,
    targetPath: 'partD.consensusMechanism',
    confidence: 'high',
  },

  // Part E: Offering
  {
    sourcePattern: /subscription\s*period|offering\s*period/i,
    targetPath: 'partE.subscriptionPeriod',
    transform: extractDateRange,
    confidence: 'medium',
  },
  {
    sourcePattern: /token\s*price|price\s*per\s*token/i,
    targetPath: 'partE.tokenPrice',
    transform: parseMonetary,
    confidence: 'high',
  },
  {
    sourcePattern: /maximum\s*goal|subscription\s*goal/i,
    targetPath: 'partE.maxSubscriptionGoal',
    transform: parseMonetary,
    confidence: 'medium',
  },

  // Part J: Sustainability
  {
    sourcePattern: /energy\s*consumption/i,
    targetPath: 'partJ.energyConsumption',
    transform: parseEnergy,
    confidence: 'high',
  },
];
```

### Mapping Engine

```typescript
interface MappedField {
  path: string;
  value: unknown;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

function mapFields(
  sections: Map<string, string>,
  mappings: FieldMapping[]
): MappedField[] {
  const results: MappedField[] = [];

  for (const [sectionName, sectionText] of sections) {
    const rows = extractTableRows(sectionText);

    for (const row of rows) {
      for (const mapping of mappings) {
        if (matchesPattern(row.field, mapping.sourcePattern)) {
          const value = mapping.transform
            ? mapping.transform(row.content)
            : row.content;

          results.push({
            path: mapping.targetPath,
            value,
            source: `${sectionName}: ${row.field}`,
            confidence: mapping.confidence,
          });
        }
      }
    }
  }

  return results;
}

function matchesPattern(
  text: string,
  pattern: RegExp | string[]
): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(text);
  }
  return pattern.some(p =>
    text.toLowerCase().includes(p.toLowerCase())
  );
}
```

---

## Step 4: Value Transformers

### Number Parsing

```typescript
function parseNumber(value: string): number | null {
  // Remove thousand separators and normalize decimals
  const cleaned = value
    .replace(/,/g, '')      // Remove commas
    .replace(/\s/g, '')     // Remove spaces
    .replace(/[^\d.-]/g, ''); // Keep only digits, dots, minus

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
```

### Monetary Value Parsing

```typescript
interface MonetaryValue {
  amount: number;
  currency: string;
}

function parseMonetary(value: string): MonetaryValue | null {
  // Match patterns like "CHF 25,000" or "€50,000" or "50,000 USD"
  const patterns = [
    /([A-Z]{3})\s*([\d,]+(?:\.\d{2})?)/i,   // CHF 25,000
    /€\s*([\d,]+(?:\.\d{2})?)/,              // €50,000
    /\$\s*([\d,]+(?:\.\d{2})?)/,             // $50,000
    /([\d,]+(?:\.\d{2})?)\s*([A-Z]{3})/i,    // 50,000 USD
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const amount = parseNumber(match[1] || match[2]);
      const currency = (match[2] || match[1] || 'EUR').toUpperCase();

      if (amount !== null) {
        return { amount, currency };
      }
    }
  }

  return null;
}
```

### Date Parsing

```typescript
function parseDate(value: string): string | null {
  // Common date formats
  const patterns = [
    // December 17, 2025
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    // 17 December 2025
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    // 2025-12-17
    /(\d{4})-(\d{2})-(\d{2})/,
    // 17/12/2025 or 17.12.2025
    /(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      // Convert to ISO format
      const date = new Date(match[0]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

function extractDateRange(value: string): {
  start: string;
  end: string;
} | null {
  // Match patterns like "December 17-19, 2025" or "17/12/2025 - 19/12/2025"
  const dates = value.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}|\w+\s+\d{1,2},?\s+\d{4}/g);

  if (dates && dates.length >= 2) {
    return {
      start: parseDate(dates[0]) || '',
      end: parseDate(dates[1]) || '',
    };
  }

  return null;
}
```

### Energy Parsing

```typescript
function parseEnergy(value: string): number | null {
  // Match patterns like "86.68 kWh" or "86,680 Wh"
  const match = value.match(/([\d,.]+)\s*(kWh|Wh|MWh)/i);

  if (match) {
    let amount = parseNumber(match[1]);
    const unit = match[2].toLowerCase();

    if (amount !== null) {
      // Convert to kWh
      if (unit === 'wh') amount /= 1000;
      if (unit === 'mwh') amount *= 1000;

      return amount;
    }
  }

  return null;
}
```

### URL Extraction

```typescript
function extractUrl(value: string): string | null {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
  const match = value.match(urlPattern);
  return match ? match[0] : null;
}
```

---

## Step 5: Confidence Scoring

### Scoring Logic

```typescript
interface ExtractionResult {
  data: WhitepaperData;
  mappings: MappedField[];
  confidence: {
    overall: number;      // 0-100
    bySection: Record<string, number>;
    lowConfidenceFields: string[];
  };
}

function calculateConfidence(mappings: MappedField[]): {
  overall: number;
  bySection: Record<string, number>;
  lowConfidenceFields: string[];
} {
  const weights = { high: 1.0, medium: 0.7, low: 0.4 };

  let totalWeight = 0;
  let weightedSum = 0;
  const lowConfidenceFields: string[] = [];
  const sectionScores: Record<string, { sum: number; count: number }> = {};

  for (const mapping of mappings) {
    const weight = weights[mapping.confidence];
    totalWeight += 1;
    weightedSum += weight;

    if (mapping.confidence === 'low') {
      lowConfidenceFields.push(mapping.path);
    }

    // Track by section
    const section = mapping.path.split('.')[0];
    if (!sectionScores[section]) {
      sectionScores[section] = { sum: 0, count: 0 };
    }
    sectionScores[section].sum += weight;
    sectionScores[section].count += 1;
  }

  const bySection: Record<string, number> = {};
  for (const [section, scores] of Object.entries(sectionScores)) {
    bySection[section] = Math.round((scores.sum / scores.count) * 100);
  }

  return {
    overall: Math.round((weightedSum / totalWeight) * 100),
    bySection,
    lowConfidenceFields,
  };
}
```

---

## Step 6: Management Body Extraction

### Pattern Recognition

```typescript
interface ManagementBodyEntry {
  identity: string;
  businessAddress: string;
  function: string;
}

function extractManagementBody(
  sectionText: string
): ManagementBodyEntry[] {
  const entries: ManagementBodyEntry[] = [];

  // Pattern for table rows with name, address, function
  const pattern = /^(\d+)\s+([^\t\n]+)\s+([^\t\n]+)\s+([^\t\n]+)$/gm;

  let match;
  while ((match = pattern.exec(sectionText)) !== null) {
    entries.push({
      identity: match[2].trim(),
      businessAddress: match[3].trim(),
      function: match[4].trim(),
    });
  }

  // Alternative: Look for structured blocks
  if (entries.length === 0) {
    const blockPattern = /Identity:\s*([^\n]+)\n.*?Address:\s*([^\n]+)\n.*?Function:\s*([^\n]+)/gi;

    while ((match = blockPattern.exec(sectionText)) !== null) {
      entries.push({
        identity: match[1].trim(),
        businessAddress: match[2].trim(),
        function: match[3].trim(),
      });
    }
  }

  return entries;
}
```

---

## Handling Edge Cases

### Multi-Language Documents

```typescript
// Detect document language
function detectLanguage(text: string): string {
  // Simple heuristic based on common words
  const languageIndicators: Record<string, RegExp[]> = {
    en: [/\bthe\b/i, /\band\b/i, /\bof\b/i],
    de: [/\bund\b/i, /\bder\b/i, /\bdie\b/i],
    fr: [/\ble\b/i, /\bla\b/i, /\bet\b/i],
    // Add more languages
  };

  const scores: Record<string, number> = {};

  for (const [lang, patterns] of Object.entries(languageIndicators)) {
    scores[lang] = patterns.filter(p => p.test(text)).length;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0][0];
}
```

### Corrupted or Scanned PDFs

```typescript
async function extractWithFallback(buffer: Buffer): Promise<PdfContent> {
  // Try standard extraction first
  try {
    const result = await extractPdfText(buffer);
    if (result.text.length > 100) {
      return result;
    }
  } catch (error) {
    console.warn('Standard extraction failed:', error);
  }

  // Fallback: The PDF might be image-based
  // In production, you might use OCR here
  throw new Error(
    'PDF appears to be image-based or corrupted. ' +
    'Please upload a text-based PDF.'
  );
}
```

### Large Documents

```typescript
// Stream processing for large PDFs
async function extractLargePdf(
  buffer: Buffer,
  onProgress: (percent: number) => void
): Promise<PdfContent> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const totalPages = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item: any) => item.str).join(' ')
    );

    onProgress(Math.round((i / totalPages) * 100));
  }

  return {
    text: pages.join('\n\n'),
    pages: totalPages,
    metadata: {},
  };
}
```

---

## Testing Extraction

### Test Fixtures

Store sample PDFs in `tests/fixtures/pdfs/`:

```
tests/fixtures/pdfs/
├── persija-whitepaper.pdf       # Full example
├── minimal-othr.pdf             # Minimal valid OTHR
├── minimal-art.pdf              # Minimal valid ART
├── minimal-emt.pdf              # Minimal valid EMT
├── multi-language.pdf           # Multi-language content
├── complex-tables.pdf           # Complex table layouts
└── edge-cases.pdf               # Edge cases
```

### Test Cases

```typescript
describe('PDF Extraction', () => {
  it('should extract all required fields from PERSIJA whitepaper', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/persija-whitepaper.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.partA.legalName).toBe('Socios Technologies AG');
    expect(result.data.partA.lei).toMatch(/^[A-Z0-9]{20}$/);
    expect(result.data.partD.cryptoAssetName).toBe('$PERSIJA');
    expect(result.data.partD.totalSupply).toBe(10000000);
    expect(result.confidence.overall).toBeGreaterThan(70);
  });

  it('should handle missing optional fields gracefully', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/minimal-othr.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.partA.legalName).toBeDefined();
    expect(result.data.partB).toBeUndefined(); // Optional
    expect(result.confidence.lowConfidenceFields.length).toBeGreaterThan(0);
  });

  it('should extract management body members correctly', async () => {
    const buffer = await fs.readFile('tests/fixtures/pdfs/persija-whitepaper.pdf');
    const result = await extractWhitepaper(buffer);

    expect(result.data.managementBodyMembers?.offeror).toBeDefined();
    expect(result.data.managementBodyMembers?.offeror.length).toBeGreaterThan(0);
    expect(result.data.managementBodyMembers?.offeror[0].identity).toBeDefined();
    expect(result.data.managementBodyMembers?.offeror[0].function).toBeDefined();
  });
});
```

---

## Performance Optimization

### Caching Parsed Content

```typescript
const extractionCache = new Map<string, ExtractionResult>();

async function extractWithCache(
  buffer: Buffer,
  sessionId: string
): Promise<ExtractionResult> {
  const cached = extractionCache.get(sessionId);
  if (cached) {
    return cached;
  }

  const result = await extractWhitepaper(buffer);
  extractionCache.set(sessionId, result);

  // Auto-cleanup after 1 hour
  setTimeout(() => {
    extractionCache.delete(sessionId);
  }, 3600000);

  return result;
}
```

### Parallel Processing

```typescript
async function extractParallel(buffer: Buffer): Promise<ExtractionResult> {
  // Parse PDF and detect sections in parallel
  const [text, metadata] = await Promise.all([
    extractPdfText(buffer),
    extractPdfMetadata(buffer),
  ]);

  const sections = detectSections(text.text);

  // Map fields from each section in parallel
  const sectionPromises = Array.from(sections.entries()).map(
    async ([name, content]) => {
      return {
        name,
        fields: await mapSectionFields(content),
      };
    }
  );

  const sectionResults = await Promise.all(sectionPromises);

  return assembleResult(sectionResults, metadata);
}
```
