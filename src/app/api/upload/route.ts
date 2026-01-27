/**
 * PDF Upload API Endpoint
 *
 * POST /api/upload - Upload and process a PDF whitepaper in one step
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
import { extractPdfText } from '@/lib/pdf/extractor';
import { mapPdfToWhitepaper } from '@/lib/pdf/field-mapper';
import type { TokenType } from '@/types/taxonomy';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// PDF magic bytes
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

const UploadQuerySchema = z.object({
  tokenType: z.enum(['OTHR', 'ART', 'EMT']).optional(),
});

/**
 * Validate that the buffer contains PDF magic bytes
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return PDF_MAGIC_BYTES.every((byte, index) => buffer[index] === byte);
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
            message: 'A PDF file is required',
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

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes
    if (!isPdfBuffer(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Only PDF files are accepted',
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

    // Process the PDF immediately (serverless-friendly)
    const extraction = await extractPdfText(buffer);
    const effectiveTokenType = tokenType as TokenType;
    const mapping = mapPdfToWhitepaper(extraction, effectiveTokenType);

    // Return complete processing result
    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId,
          filename: file.name,
          size: file.size,
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
    console.error('Upload/process error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: error instanceof Error ? error.message : 'Failed to process PDF',
        },
      },
      { status: 500 }
    );
  }
}
