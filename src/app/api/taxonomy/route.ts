/**
 * Taxonomy Browsing API
 *
 * GET /api/taxonomy?tokenType=OTHR&part=A&search=legal&dataType=stringItemType
 *
 * Returns taxonomy elements filtered by query parameters.
 * All parameters are optional — omit to get all elements.
 */

import { NextResponse } from 'next/server';
import { TaxonomyRegistry } from '@/lib/xbrl/taxonomy/registry';
import bundleData from '@/lib/xbrl/taxonomy/data/taxonomy-bundle.json';
import type { TokenType, WhitepaperPart, XBRLDataType } from '@/types/taxonomy';

let registry: TaxonomyRegistry | null = null;

function getRegistry(): TaxonomyRegistry {
  if (!registry) {
    registry = new TaxonomyRegistry(bundleData as unknown as ConstructorParameters<typeof TaxonomyRegistry>[0]);
  }
  return registry;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenType = searchParams.get('tokenType') as TokenType | null;
  const part = searchParams.get('part') as WhitepaperPart | null;
  const search = searchParams.get('search');
  const dataType = searchParams.get('dataType') as XBRLDataType | null;
  const abstractOnly = searchParams.get('abstract') === 'true';

  const reg = getRegistry();

  let elements = reg.getAllElements();

  // Filter by token type
  if (tokenType) {
    elements = elements.filter((el) => el.tokenTypes.includes(tokenType));
  }

  // Filter by part
  if (part) {
    elements = elements.filter((el) => el.part === part);
  }

  // Filter by data type
  if (dataType) {
    elements = elements.filter((el) => el.dataType === dataType);
  }

  // Filter abstract
  if (!abstractOnly) {
    elements = elements.filter((el) => !el.abstract);
  }

  // Search by name or label
  if (search) {
    const lower = search.toLowerCase();
    elements = elements.filter(
      (el) =>
        el.name.toLowerCase().includes(lower) ||
        el.label.toLowerCase().includes(lower) ||
        (el.documentation?.toLowerCase().includes(lower) ?? false)
    );
  }

  // Return summary data (not the full element objects)
  const result = elements.map((el) => ({
    name: el.name,
    label: el.label,
    dataType: el.dataType,
    periodType: el.periodType,
    part: el.part,
    tokenTypes: el.tokenTypes,
    required: el.required,
    abstract: el.abstract,
  }));

  return NextResponse.json({
    version: reg.version,
    count: result.length,
    elements: result,
  });
}
