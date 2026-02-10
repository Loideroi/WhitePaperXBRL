/**
 * LEI Lookup API Endpoint
 *
 * POST /api/lei-lookup - Look up an LEI code against the GLEIF registry
 *
 * Performs local checksum validation first, then queries the GLEIF API
 * for entity information. Falls back gracefully if the API is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { lookupLEI } from '@/lib/xbrl/validator/gleif-lookup';
import { validateLEI } from '@/lib/xbrl/validator/lei-validator';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security';

/**
 * Request body schema - LEI must be exactly 20 characters
 */
const RequestSchema = z.object({
  lei: z.string().length(20, 'LEI must be 20 characters'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting (reuse validate limits since this is a validation-adjacent operation)
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(`lei-lookup:${clientId}`, RATE_LIMITS.validate);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many lookup requests. Please try again later.',
        },
      },
      {
        status: 429,
        headers: rateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: parsed.error.errors[0]?.message ?? 'Invalid request',
          },
        },
        { status: 400 }
      );
    }

    const { lei } = parsed.data;

    // First do local checksum validation
    const localResult = validateLEI(lei);

    // validateLEI returns synchronously when checkGLEIF is not set
    if ('valid' in localResult && !localResult.valid) {
      return NextResponse.json(
        {
          success: false,
          data: {
            isValid: false,
            localValidation: localResult,
            gleifLookup: null,
          },
        },
        { headers: rateLimitHeaders(rateLimit) }
      );
    }

    // Then do GLEIF lookup
    const gleifResult = await lookupLEI(lei);

    return NextResponse.json(
      {
        success: true,
        data: {
          // Consider valid if GLEIF confirms OR if GLEIF was unreachable (fall back to local)
          isValid: gleifResult.isValid || !gleifResult.lookupPerformed,
          localValidation: localResult,
          gleifLookup: gleifResult,
        },
      },
      { headers: rateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: err.errors[0]?.message ?? 'Invalid request',
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LOOKUP_FAILED',
          message: 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}
