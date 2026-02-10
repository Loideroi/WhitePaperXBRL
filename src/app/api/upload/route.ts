/**
 * Document Upload API Endpoint
 *
 * POST /api/upload - Upload and process a whitepaper document
 *
 * Supports multiple formats: PDF, DOCX, ODT, RTF
 *
 * In serverless environments, we process immediately instead of storing
 * the file for later processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSessionId } from '@/lib/utils';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security';
import {
  extractDocument,
  detectFormat,
  isSupportedFormat,
  type SupportedFormat,
} from '@/lib/document/extractor';
import { mapPdfToWhitepaper } from '@/lib/pdf/field-mapper';
import type { TokenType } from '@/types/taxonomy';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// File magic bytes for validation
const MAGIC_BYTES: Record<SupportedFormat, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  docx: [[0x50, 0x4b, 0x03, 0x04]], // PK.. (ZIP)
  odt: [[0x50, 0x4b, 0x03, 0x04]], // PK.. (ZIP)
  rtf: [[0x7b, 0x5c, 0x72, 0x74, 0x66]], // {\rtf
};

const UploadQuerySchema = z.object({
  tokenType: z.enum(['OTHR', 'ART', 'EMT']).optional(),
});

/**
 * Validate that the buffer starts with expected magic bytes
 */
function validateMagicBytes(buffer: Buffer, format: SupportedFormat): boolean {
  if (buffer.length < 4) return false;

  const expectedBytes = MAGIC_BYTES[format];
  if (!expectedBytes) return false;

  return expectedBytes.some((bytes) =>
    bytes.every((byte, index) => buffer[index] === byte)
  );
}

/**
 * Get human-readable format name
 */
function getFormatName(format: SupportedFormat): string {
  const names: Record<SupportedFormat, string> = {
    pdf: 'PDF',
    docx: 'Microsoft Word (DOCX)',
    odt: 'OpenDocument Text (ODT)',
    rtf: 'Rich Text Format (RTF)',
  };
  return names[format] || format.toUpperCase();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`upload:${clientId}`, RATE_LIMITS.upload);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many upload requests. Please try again later.',
        },
      },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const tokenType = (formData.get('tokenType') as string | null) || 'OTHR';

    // Validate file presence
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'A document file is required (PDF, DOCX, ODT, or RTF)',
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          },
        },
        { status: 413 }
      );
    }

    // Detect format from MIME type and filename
    const format = detectFormat(file.type, file.name);

    if (!isSupportedFormat(format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: 'Unsupported file format. Accepted formats: PDF, DOCX, ODT, RTF',
          },
        },
        { status: 415 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate magic bytes
    if (!validateMagicBytes(buffer, format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `File content does not match ${getFormatName(format)} format`,
          },
        },
        { status: 415 }
      );
    }

    // Validate token type
    const tokenTypeResult = UploadQuerySchema.safeParse({ tokenType });
    if (!tokenTypeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Token type must be OTHR, ART, or EMT',
          },
        },
        { status: 400 }
      );
    }

    // Generate session ID for tracking
    const sessionId = generateSessionId();
    const now = new Date();

    // Extract document content
    const extraction = await extractDocument(buffer, file.type, file.name);
    const effectiveTokenType = tokenType as TokenType;

    // Map to whitepaper fields (uses same mapper for all formats)
    const mapping = mapPdfToWhitepaper(
      {
        text: extraction.text,
        pages: extraction.pages || 0,
        metadata: extraction.metadata,
        sections: extraction.sections,
      },
      effectiveTokenType
    );

    // Return complete processing result
    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId,
          filename: file.name,
          size: file.size,
          format: extraction.format,
          tokenType: effectiveTokenType,
          uploadedAt: now.toISOString(),
          status: 'complete',
          extraction: {
            pages: extraction.pages,
            metadata: {
              title: extraction.metadata.title,
              author: extraction.metadata.author,
              creationDate: extraction.metadata.creationDate,
            },
          },
          mapping,
        },
      },
      {
        status: 200,
        headers: rateLimitHeaders(rateLimit),
      }
    );
  } catch (error) {
    console.error('Upload/process error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: error instanceof Error ? error.message : 'Failed to process document',
        },
      },
      { status: 500 }
    );
  }
}
