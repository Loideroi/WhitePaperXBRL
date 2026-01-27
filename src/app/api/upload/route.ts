/**
 * PDF Upload API Endpoint
 *
 * POST /api/upload - Upload a PDF whitepaper for processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSessionId } from '@/lib/utils';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// PDF magic bytes
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

// In-memory session store (replace with Redis/DB in production)
const sessions = new Map<
  string,
  {
    filename: string;
    size: number;
    tokenType?: string;
    uploadedAt: Date;
    expiresAt: Date;
    status: 'pending' | 'processing' | 'complete' | 'failed';
    pdfBuffer?: Buffer;
    extractedText?: string;
    error?: string;
  }
>();

// Clean up expired sessions periodically
setInterval(
  () => {
    const now = new Date();
    for (const [id, session] of sessions.entries()) {
      if (session.expiresAt < now) {
        sessions.delete(id);
      }
    }
  },
  5 * 60 * 1000
); // Every 5 minutes

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
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');
    const tokenType = formData.get('tokenType') as string | null;

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

    // Validate token type if provided
    if (tokenType) {
      const result = UploadQuerySchema.safeParse({ tokenType });
      if (!result.success) {
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
    }

    // Generate session
    const sessionId = generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    // Store session
    sessions.set(sessionId, {
      filename: file.name,
      size: file.size,
      tokenType: tokenType || undefined,
      uploadedAt: now,
      expiresAt,
      status: 'pending',
      pdfBuffer: buffer,
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId,
          filename: file.name,
          size: file.size,
          tokenType: tokenType || undefined,
          uploadedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'pending',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to process upload',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get session by ID (internal use)
 */
export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

/**
 * Update session (internal use)
 */
export function updateSession(
  sessionId: string,
  updates: Partial<{
    status: 'pending' | 'processing' | 'complete' | 'failed';
    extractedText: string;
    error: string;
    tokenType: string;
  }>
) {
  const session = sessions.get(sessionId);
  if (session) {
    sessions.set(sessionId, { ...session, ...updates });
  }
}
