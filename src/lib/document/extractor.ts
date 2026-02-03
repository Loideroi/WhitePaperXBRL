/**
 * Unified Document Extractor
 *
 * Extracts text content from multiple document formats:
 * - PDF (.pdf)
 * - Microsoft Word (.docx)
 * - OpenDocument Text (.odt)
 * - Rich Text Format (.rtf)
 *
 * Uses officeparser for Office formats which preserves formatting better
 * than raw PDF extraction.
 */

import { parseOffice } from 'officeparser';
import { extractPdfText, type PdfExtractionResult } from '../pdf/extractor';

/**
 * Supported document formats
 */
export type SupportedFormat = 'pdf' | 'docx' | 'odt' | 'rtf';

/**
 * MIME type to format mapping
 */
export const MIME_TO_FORMAT: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx', // Legacy .doc might be uploaded
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
};

/**
 * File extension to format mapping
 */
export const EXTENSION_TO_FORMAT: Record<string, SupportedFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'docx',
  '.odt': 'odt',
  '.rtf': 'rtf',
};

/**
 * Document extraction result
 */
export interface DocumentExtractionResult {
  /** Full extracted text */
  text: string;
  /** Document format */
  format: SupportedFormat;
  /** Number of pages (if available) */
  pages?: number;
  /** Document metadata */
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    creationDate?: string;
    modificationDate?: string;
  };
  /** Detected sections */
  sections: Map<string, string>;
}

/**
 * Detect document format from MIME type or filename
 */
export function detectFormat(mimeType?: string, filename?: string): SupportedFormat | null {
  // Try MIME type first
  if (mimeType && MIME_TO_FORMAT[mimeType]) {
    return MIME_TO_FORMAT[mimeType];
  }

  // Fall back to file extension
  if (filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_TO_FORMAT[ext]) {
      return EXTENSION_TO_FORMAT[ext];
    }
  }

  return null;
}

/**
 * Check if a format is supported
 */
export function isSupportedFormat(format: string | null): format is SupportedFormat {
  return format !== null && ['pdf', 'docx', 'odt', 'rtf'].includes(format);
}

/**
 * Extract text from an Office document (docx, odt, rtf) using officeparser
 */
async function extractOfficeDocument(
  buffer: Buffer,
  format: SupportedFormat
): Promise<DocumentExtractionResult> {
  try {
    // officeparser returns structured content
    const result = await parseOffice(buffer);

    // Extract text from the parsed result
    // officeparser v6+ returns an AST structure
    let text = '';
    const metadata: DocumentExtractionResult['metadata'] = {};

    if (typeof result === 'string') {
      // Older versions return plain text
      text = result;
    } else if (result && typeof result === 'object') {
      // v6+ returns structured data
      // Handle both AST and legacy formats
      if ('text' in result && typeof result.text === 'string') {
        text = result.text;
      } else if ('body' in result && Array.isArray(result.body)) {
        // AST format - extract text from paragraphs
        text = extractTextFromAST(result.body);
      } else {
        // Try to stringify and extract
        text = JSON.stringify(result);
      }

      // Extract metadata if available
      if ('metadata' in result && result.metadata) {
        const meta = result.metadata as Record<string, unknown>;
        metadata.title = meta.title as string | undefined;
        metadata.author = meta.author as string | undefined;
        metadata.creator = meta.creator as string | undefined;
      }
    }

    return {
      text,
      format,
      metadata,
      sections: new Map(),
    };
  } catch (error) {
    throw new Error(
      `Failed to extract ${format.toUpperCase()} content: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Extract text from officeparser AST structure
 */
function extractTextFromAST(body: unknown[]): string {
  const paragraphs: string[] = [];

  function processNode(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;

    // Check for text content
    if ('text' in obj && typeof obj.text === 'string') {
      paragraphs.push(obj.text);
    }

    // Check for children
    if ('children' in obj && Array.isArray(obj.children)) {
      for (const child of obj.children) {
        processNode(child);
      }
    }

    // Check for content array
    if ('content' in obj && Array.isArray(obj.content)) {
      for (const item of obj.content) {
        processNode(item);
      }
    }
  }

  for (const item of body) {
    processNode(item);
  }

  // Join with double newlines for paragraph separation
  return paragraphs.join('\n\n');
}

/**
 * Extract text and metadata from a document buffer
 *
 * Supports PDF, DOCX, ODT, and RTF formats.
 */
export async function extractDocument(
  buffer: Buffer,
  mimeType?: string,
  filename?: string
): Promise<DocumentExtractionResult> {
  const format = detectFormat(mimeType, filename);

  if (!format) {
    throw new Error(
      `Unsupported document format. Supported formats: PDF, DOCX, ODT, RTF`
    );
  }

  if (format === 'pdf') {
    // Use existing PDF extractor
    const pdfResult = await extractPdfText(buffer);
    return {
      text: pdfResult.text,
      format: 'pdf',
      pages: pdfResult.pages,
      metadata: pdfResult.metadata,
      sections: pdfResult.sections,
    };
  }

  // Use officeparser for Office formats
  return extractOfficeDocument(buffer, format);
}

/**
 * Get accepted file types for upload components
 */
export function getAcceptedFileTypes(): string {
  return '.pdf,.docx,.doc,.odt,.rtf';
}

/**
 * Get accepted MIME types for validation
 */
export function getAcceptedMimeTypes(): string[] {
  return Object.keys(MIME_TO_FORMAT);
}
