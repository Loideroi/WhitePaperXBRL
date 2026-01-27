/**
 * iXBRL Generation API Endpoint
 *
 * POST /api/generate - Generate iXBRL document from whitepaper data
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WhitepaperDataSchema, type WhitepaperData } from '@/types/whitepaper';
import { generateIXBRLDocument } from '@/lib/xbrl/generator';

/**
 * Basic validation errors
 */
interface ValidationError {
  field: string;
  message: string;
}

/**
 * Request body schema - accepts partial whitepaper data
 */
const GenerateRequestSchema = z.object({
  data: z.record(z.unknown()),
  format: z.enum(['ixbrl', 'json']).optional().default('ixbrl'),
  filename: z.string().optional(),
});

/**
 * Validate required fields are present
 */
function validateRequiredFields(data: Partial<WhitepaperData>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields for valid iXBRL
  if (!data.partA?.lei) {
    errors.push({ field: 'partA.lei', message: 'Legal Entity Identifier (LEI) is required' });
  } else if (!/^[A-Z0-9]{20}$/.test(data.partA.lei)) {
    errors.push({ field: 'partA.lei', message: 'LEI must be 20 uppercase alphanumeric characters' });
  }

  if (!data.partA?.legalName) {
    errors.push({ field: 'partA.legalName', message: 'Legal name is required' });
  }

  if (!data.partD?.cryptoAssetName) {
    errors.push({ field: 'partD.cryptoAssetName', message: 'Crypto-asset name is required' });
  }

  if (!data.tokenType) {
    errors.push({ field: 'tokenType', message: 'Token type is required' });
  }

  return errors;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json();
    const validation = GenerateRequestSchema.safeParse(body);

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

    const { data, format, filename } = validation.data;
    const whitepaperData = data as Partial<WhitepaperData>;

    // Validate required fields
    const validationErrors = validateRequiredFields(whitepaperData);

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Required fields are missing or invalid',
            details: validationErrors,
          },
        },
        { status: 400 }
      );
    }

    // Set defaults
    if (!whitepaperData.documentDate) {
      whitepaperData.documentDate = new Date().toISOString().split('T')[0];
    }
    if (!whitepaperData.language) {
      whitepaperData.language = 'en';
    }

    // Generate output based on format
    if (format === 'json') {
      // Return structured JSON (for debugging/preview)
      return NextResponse.json({
        success: true,
        data: {
          format: 'json',
          content: whitepaperData,
        },
      });
    }

    // Generate iXBRL document
    const ixbrlContent = generateIXBRLDocument(whitepaperData);

    // Generate filename
    const outputFilename = filename ||
      `whitepaper-${whitepaperData.partD?.cryptoAssetSymbol?.toLowerCase() || 'crypto'}-${whitepaperData.documentDate}.xhtml`;

    // Return as downloadable file
    return new NextResponse(ixbrlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xhtml+xml',
        'Content-Disposition': `attachment; filename="${outputFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate document',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for preview (returns HTML preview)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Use POST to generate iXBRL document',
    endpoints: {
      generate: {
        method: 'POST',
        body: {
          data: 'Whitepaper data object',
          format: 'ixbrl (default) | json',
          filename: 'Optional output filename',
        },
      },
    },
  });
}
