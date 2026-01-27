/**
 * PDF Processing API Endpoint
 *
 * POST /api/process - Process uploaded PDF and extract whitepaper fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, updateSession } from '../upload/route';
import { extractPdfText } from '@/lib/pdf/extractor';
import { mapPdfToWhitepaper, type MappingResult } from '@/lib/pdf/field-mapper';
import type { TokenType } from '@/types/taxonomy';

const ProcessRequestSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  tokenType: z.enum(['OTHR', 'ART', 'EMT']).optional(),
});

export interface ProcessResponse {
  success: boolean;
  data?: {
    sessionId: string;
    filename: string;
    extraction: {
      pages: number;
      metadata: {
        title?: string;
        author?: string;
        creationDate?: string;
      };
    };
    mapping: MappingResult;
    status: 'complete' | 'failed';
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ProcessResponse>> {
  try {
    // Parse request body
    const body = await request.json();
    const validation = ProcessRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: validation.error.errors[0]?.message || 'Invalid request',
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, tokenType } = validation.data;

    // Get session
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Upload session not found or expired',
          },
        },
        { status: 404 }
      );
    }

    // Check if PDF buffer exists
    if (!session.pdfBuffer) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_PDF_DATA',
            message: 'No PDF data found in session',
          },
        },
        { status: 400 }
      );
    }

    // Update session status
    updateSession(sessionId, { status: 'processing' });

    try {
      // Extract text from PDF
      const extraction = await extractPdfText(session.pdfBuffer);

      // Use token type from request or session
      const effectiveTokenType = (tokenType || session.tokenType || 'OTHR') as TokenType;

      // Map extracted content to whitepaper fields
      const mapping = mapPdfToWhitepaper(extraction, effectiveTokenType);

      // Update session with extracted text
      updateSession(sessionId, {
        status: 'complete',
        extractedText: extraction.text,
        tokenType: effectiveTokenType,
      });

      return NextResponse.json({
        success: true,
        data: {
          sessionId,
          filename: session.filename,
          extraction: {
            pages: extraction.pages,
            metadata: {
              title: extraction.metadata.title,
              author: extraction.metadata.author,
              creationDate: extraction.metadata.creationDate,
            },
          },
          mapping,
          status: 'complete',
        },
      });
    } catch (extractionError) {
      updateSession(sessionId, {
        status: 'failed',
        error:
          extractionError instanceof Error ? extractionError.message : 'Extraction failed',
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EXTRACTION_FAILED',
            message:
              extractionError instanceof Error
                ? extractionError.message
                : 'Failed to extract PDF content',
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROCESS_FAILED',
          message: 'Failed to process request',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/process?sessionId=xxx - Get processing status/results
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_ID_REQUIRED',
          message: 'Session ID is required',
        },
      },
      { status: 400 }
    );
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      sessionId,
      filename: session.filename,
      status: session.status,
      tokenType: session.tokenType,
      uploadedAt: session.uploadedAt.toISOString(),
      error: session.error,
    },
  });
}
