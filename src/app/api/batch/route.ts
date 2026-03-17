/**
 * Batch Processing API
 *
 * POST /api/batch - Process multiple whitepaper datasets in a single request.
 * Returns an array of results (one per input), each with success/error status.
 *
 * Max batch size: 5 items per request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type WhitepaperData } from '@/types/whitepaper';
import { generateIXBRLDocument } from '@/lib/xbrl/generator';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/security';

const MAX_BATCH_SIZE = 5;

const BatchItemSchema = z.object({
  data: z.record(z.unknown()),
  filename: z.string().optional(),
});

const BatchRequestSchema = z.object({
  items: z.array(BatchItemSchema).min(1).max(MAX_BATCH_SIZE),
});

interface BatchResult {
  index: number;
  success: boolean;
  filename?: string;
  content?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting — batch counts as multiple requests
  const clientId = getClientIdentifier(request);
  const rateLimit = await checkRateLimit(`generate:${clientId}`, RATE_LIMITS.generate);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limited. Try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    );
  }

  try {
    const body = await request.json();
    const validation = BatchRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { items } = validation.data;
    const results: BatchResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const whitepaperData = item.data as Partial<WhitepaperData>;

      try {
        // Set defaults
        if (!whitepaperData.documentDate) {
          whitepaperData.documentDate = new Date().toISOString().split('T')[0];
        }
        if (!whitepaperData.language) {
          whitepaperData.language = 'en';
        }

        const content = generateIXBRLDocument(whitepaperData);
        const filename = item.filename ||
          `whitepaper-${whitepaperData.partD?.cryptoAssetSymbol?.toLowerCase() || 'crypto'}-${i + 1}.xhtml`;

        results.push({ index: i, success: true, filename, content });
      } catch (err) {
        results.push({
          index: i,
          success: false,
          error: err instanceof Error ? err.message : 'Generation failed',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount === items.length,
      total: items.length,
      succeeded: successCount,
      failed: items.length - successCount,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Batch processing failed' },
      { status: 500 }
    );
  }
}
