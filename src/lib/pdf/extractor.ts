/**
 * PDF Text Extraction Service
 *
 * Extracts text content from PDF files for processing.
 */

import pdf from 'pdf-parse';

export interface PdfExtractionResult {
  /** Full extracted text */
  text: string;
  /** Number of pages */
  pages: number;
  /** PDF metadata */
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  /** Detected sections */
  sections: Map<string, string>;
}

/**
 * Section patterns for MiCA whitepaper structure
 */
const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /^summary$/im,
  disclaimer: /^(disclaimer|important\s*notice)/im,
  partA: /^part\s*a[:\s]|^a\.\s*information/im,
  partB: /^part\s*b[:\s]|^b\.\s*information/im,
  partC: /^part\s*c[:\s]|^c\.\s*information/im,
  partD: /^part\s*d[:\s]|^d\.\s*(project|detailed)/im,
  partE: /^part\s*e[:\s]|^e\.\s*(public\s*offer|offer)/im,
  partF: /^part\s*f[:\s]|^f\.\s*(description|characteristics)/im,
  partG: /^part\s*g[:\s]|^g\.\s*(rights|obligations)/im,
  partH: /^part\s*h[:\s]|^h\.\s*(underlying\s*technology|technology)/im,
  partI: /^part\s*i[:\s]|^i\.\s*(risks|risk\s*factors)/im,
  partJ: /^part\s*j[:\s]|^j\.\s*(sustainability|environmental)/im,
};

/**
 * Extract text from a PDF buffer
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  try {
    const data = await pdf(buffer);

    const sections = detectSections(data.text);

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
        modificationDate: data.info?.ModDate,
      },
      sections,
    };
  } catch (error) {
    throw new Error(
      `Failed to extract PDF text: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Detect document sections based on patterns
 */
function detectSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = text.split('\n');

  let currentSection: string | null = null;
  let sectionContent: string[] = [];
  const sectionPositions: { section: string; index: number }[] = [];

  // First pass: find section start positions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const [sectionName, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line.trim())) {
        sectionPositions.push({ section: sectionName, index: i });
        break;
      }
    }
  }

  // Second pass: extract content between sections
  for (let i = 0; i < sectionPositions.length; i++) {
    const current = sectionPositions[i];
    const next = sectionPositions[i + 1];

    if (current) {
      const startIndex = current.index;
      const endIndex = next ? next.index : lines.length;

      const content = lines.slice(startIndex, endIndex).join('\n').trim();
      sections.set(current.section, content);
    }
  }

  // If no sections found, treat entire text as content
  if (sections.size === 0) {
    sections.set('content', text);
  }

  return sections;
}

/**
 * Extract table data from section text
 * Attempts to parse table-like structures (No. | Field | Content)
 */
export interface TableRow {
  number: string;
  field: string;
  content: string;
}

export function extractTableRows(sectionText: string): TableRow[] {
  const rows: TableRow[] = [];

  // Pattern for numbered rows like "A.1", "B.2", "1.", etc.
  const patterns = [
    // Format: "A.1    Field Name    Content"
    /^([A-Z]?\d+(?:\.\d+)?)\s{2,}([^\t\n]+?)\s{2,}(.+)$/gm,
    // Format: "A.1 | Field Name | Content"
    /^([A-Z]?\d+(?:\.\d+)?)\s*\|\s*([^|]+)\s*\|\s*(.+)$/gm,
    // Format: "1. Field Name: Content"
    /^(\d+)\.\s*([^:]+):\s*(.+)$/gm,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(sectionText)) !== null) {
      if (match[1] && match[2] && match[3]) {
        rows.push({
          number: match[1].trim(),
          field: match[2].trim(),
          content: match[3].trim(),
        });
      }
    }
  }

  return rows;
}

/**
 * Clean and normalize extracted text
 */
export function normalizeText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim()
  );
}

/**
 * Extract specific field value patterns from text
 */
export interface FieldExtraction {
  /** Extracted value */
  value: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Source text where found */
  source: string;
}

/**
 * Extract LEI from text
 */
export function extractLEI(text: string): FieldExtraction | null {
  // LEI pattern: 20 alphanumeric characters
  const leiPattern = /\b([A-Z0-9]{20})\b/g;
  const matches = [...text.matchAll(leiPattern)];

  if (matches.length > 0 && matches[0]) {
    return {
      value: matches[0][1] || '',
      confidence: 0.9,
      source: matches[0][0],
    };
  }

  return null;
}

/**
 * Extract monetary values from text
 */
export function extractMonetaryValue(
  text: string
): { amount: number; currency: string; confidence: number } | null {
  const patterns = [
    // EUR 1,000,000 or € 1,000,000
    /(?:EUR|€)\s*([\d,]+(?:\.\d{2})?)/i,
    // USD 1,000,000 or $ 1,000,000
    /(?:USD|\$)\s*([\d,]+(?:\.\d{2})?)/i,
    // CHF 1,000,000
    /CHF\s*([\d,]+(?:\.\d{2})?)/i,
    // 1,000,000 EUR
    /([\d,]+(?:\.\d{2})?)\s*(?:EUR|USD|CHF)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);

      if (!isNaN(amount)) {
        // Detect currency
        let currency = 'EUR';
        if (text.includes('USD') || text.includes('$')) currency = 'USD';
        if (text.includes('CHF')) currency = 'CHF';

        return {
          amount,
          currency,
          confidence: 0.85,
        };
      }
    }
  }

  return null;
}

/**
 * Extract date from text
 */
export function extractDate(text: string): { date: string; confidence: number } | null {
  const patterns = [
    // December 17, 2025
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    // 17 December 2025
    /(\d{1,2})\s+(\w+)\s+(\d{4})/,
    // 2025-12-17
    /(\d{4})-(\d{2})-(\d{2})/,
    // 17/12/2025
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return {
            date: date.toISOString().split('T')[0] || '',
            confidence: 0.8,
          };
        }
      } catch {
        // Continue to next pattern
      }
    }
  }

  return null;
}

/**
 * Extract number (integer or decimal) from text
 */
export function extractNumber(text: string): { value: number; confidence: number } | null {
  // Pattern for numbers with optional commas and decimals
  const pattern = /([\d,]+(?:\.\d+)?)/;
  const match = text.match(pattern);

  if (match && match[1]) {
    const numStr = match[1].replace(/,/g, '');
    const value = parseFloat(numStr);

    if (!isNaN(value)) {
      return {
        value,
        confidence: 0.7,
      };
    }
  }

  return null;
}
