/**
 * Validation API Endpoint
 *
 * POST /api/validate - Validate whitepaper data against ESMA MiCA requirements
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { WhitepaperData } from '@/types/whitepaper';
import type { TokenType } from '@/types/taxonomy';
import {
  validateWhitepaper,
  quickValidate,
  validateField,
  getValidationRequirements,
} from '@/lib/xbrl/validator';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security';

/**
 * Request body schema
 */
const ValidateRequestSchema = z.object({
  data: z.record(z.unknown()),
  tokenType: z.enum(['OTHR', 'ART', 'EMT']),
  options: z
    .object({
      checkGLEIF: z.boolean().optional(),
      skipRules: z.array(z.string()).optional(),
      quickMode: z.boolean().optional(),
      fieldPath: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`validate:${clientId}`, RATE_LIMITS.validate);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many validation requests. Please try again later.',
        },
      },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const validation = ValidateRequestSchema.safeParse(body);

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

    const { data, tokenType, options } = validation.data;
    const whitepaperData = data as Partial<WhitepaperData>;

    // Single field validation
    if (options?.fieldPath) {
      const fieldErrors = validateField(whitepaperData, options.fieldPath, tokenType);

      return NextResponse.json({
        success: true,
        data: {
          field: options.fieldPath,
          valid: fieldErrors.filter((e) => e.severity === 'ERROR').length === 0,
          errors: fieldErrors.filter((e) => e.severity === 'ERROR'),
          warnings: fieldErrors.filter((e) => e.severity === 'WARNING'),
        },
      });
    }

    // Quick validation (existence + LEI only)
    if (options?.quickMode) {
      const quickResult = quickValidate(whitepaperData, tokenType);

      return NextResponse.json({
        success: true,
        data: {
          mode: 'quick',
          valid: quickResult.valid,
          errorCount: quickResult.errorCount,
          errors: quickResult.errors,
        },
      });
    }

    // Full validation
    const result = await validateWhitepaper(whitepaperData, tokenType, {
      checkGLEIF: options?.checkGLEIF,
      skipRules: options?.skipRules,
    });

    return NextResponse.json({
      success: true,
      data: {
        mode: 'full',
        valid: result.valid,
        summary: result.summary,
        errors: result.errors,
        warnings: result.warnings,
        byCategory: result.byCategory,
        assertionCounts: result.assertionCounts,
      },
    });
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Validation failed',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/validate - Get validation requirements for a token type
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const tokenType = request.nextUrl.searchParams.get('tokenType') as TokenType | null;

  if (!tokenType || !['OTHR', 'ART', 'EMT'].includes(tokenType)) {
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

  const requirements = getValidationRequirements(tokenType);

  return NextResponse.json({
    success: true,
    data: {
      tokenType,
      requirements: {
        existence: {
          total: requirements.existence.total,
          required: requirements.existence.required,
          recommended: requirements.existence.recommended,
          byPart: requirements.existence.byPart,
        },
        value: {
          total: requirements.value.total,
          required: requirements.value.required,
          recommended: requirements.value.recommended,
        },
        lei: {
          total: 6,
          description: 'Format, checksum, and GLEIF verification',
        },
        totalAssertions: requirements.total,
      },
    },
  });
}
