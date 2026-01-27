/**
 * XBRL Context Builder
 *
 * Generates XBRL contexts for whitepaper facts.
 */

import type { XBRLContext, XBRLEntity, XBRLPeriod } from '@/types/xbrl';
import type { WhitepaperData } from '@/types/whitepaper';

const ENTITY_SCHEME = 'http://standards.iso.org/iso/17442';

/**
 * Context configuration for different scenarios
 */
export interface ContextConfig {
  /** Document date (instant period) */
  documentDate: string;
  /** Entity LEI */
  lei: string;
  /** Optional duration period (for certain facts) */
  durationPeriod?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Generate a unique context ID
 */
function generateContextId(type: string, index?: number): string {
  const suffix = index !== undefined ? `_${index}` : '';
  return `ctx_${type}${suffix}`;
}

/**
 * Create entity element for context
 */
function createEntity(lei: string): XBRLEntity {
  return {
    identifier: lei,
    scheme: ENTITY_SCHEME,
  };
}

/**
 * Create instant period
 */
function createInstantPeriod(date: string): XBRLPeriod {
  return { instant: date };
}

/**
 * Create duration period
 */
function createDurationPeriod(startDate: string, endDate: string): XBRLPeriod {
  return { startDate, endDate };
}

/**
 * Build all contexts needed for a whitepaper document
 */
export function buildContexts(config: ContextConfig): XBRLContext[] {
  const contexts: XBRLContext[] = [];
  const entity = createEntity(config.lei);

  // Main instant context (for most facts)
  contexts.push({
    id: generateContextId('instant'),
    entity,
    period: createInstantPeriod(config.documentDate),
  });

  // Duration context if needed (for facts that require period information)
  if (config.durationPeriod) {
    contexts.push({
      id: generateContextId('duration'),
      entity,
      period: createDurationPeriod(
        config.durationPeriod.startDate,
        config.durationPeriod.endDate
      ),
    });
  }

  return contexts;
}

/**
 * Build context for offeror dimension (typed dimension)
 */
export function buildOfferorContext(config: ContextConfig): XBRLContext {
  const entity = createEntity(config.lei);

  return {
    id: generateContextId('offeror'),
    entity,
    period: createInstantPeriod(config.documentDate),
    scenario: {
      typedMember: {
        dimension: 'mica:OfferorDimension',
        value: config.lei,
      },
    },
  };
}

/**
 * Build context for issuer dimension (if different from offeror)
 */
export function buildIssuerContext(config: ContextConfig, issuerLei: string): XBRLContext {
  const entity = createEntity(config.lei);

  return {
    id: generateContextId('issuer'),
    entity,
    period: createInstantPeriod(config.documentDate),
    scenario: {
      typedMember: {
        dimension: 'mica:IssuerDimension',
        value: issuerLei,
      },
    },
  };
}

/**
 * Build context for management body member (typed dimension)
 */
export function buildManagementMemberContext(
  config: ContextConfig,
  memberIndex: number,
  entityType: 'offeror' | 'issuer' | 'operator'
): XBRLContext {
  const entity = createEntity(config.lei);

  const dimensionMap = {
    offeror: 'mica:OfferorManagementBodyMemberDimension',
    issuer: 'mica:IssuerManagementBodyMemberDimension',
    operator: 'mica:OperatorManagementBodyMemberDimension',
  };

  return {
    id: generateContextId(`mgmt_${entityType}`, memberIndex),
    entity,
    period: createInstantPeriod(config.documentDate),
    scenario: {
      typedMember: {
        dimension: dimensionMap[entityType],
        value: `member_${memberIndex}`,
      },
    },
  };
}

/**
 * Build all contexts from whitepaper data
 */
export function buildAllContexts(data: Partial<WhitepaperData>): XBRLContext[] {
  const documentDate = data.documentDate || new Date().toISOString().split('T')[0] || '';
  const lei = data.partA?.lei || '';

  if (!lei) {
    throw new Error('LEI is required for context generation');
  }

  const config: ContextConfig = {
    documentDate,
    lei,
  };

  const contexts: XBRLContext[] = [...buildContexts(config)];

  // Add offeror context
  contexts.push(buildOfferorContext(config));

  // Add issuer context if different from offeror
  if (data.partB?.lei && data.partB.lei !== lei) {
    contexts.push(buildIssuerContext(config, data.partB.lei));
  }

  // Add management body member contexts
  if (data.managementBodyMembers?.offeror) {
    data.managementBodyMembers.offeror.forEach((_, index) => {
      contexts.push(buildManagementMemberContext(config, index, 'offeror'));
    });
  }

  if (data.managementBodyMembers?.issuer) {
    data.managementBodyMembers.issuer.forEach((_, index) => {
      contexts.push(buildManagementMemberContext(config, index, 'issuer'));
    });
  }

  if (data.managementBodyMembers?.operator) {
    data.managementBodyMembers.operator.forEach((_, index) => {
      contexts.push(buildManagementMemberContext(config, index, 'operator'));
    });
  }

  return contexts;
}

/**
 * Get the appropriate context ID for a fact
 */
export function getContextId(
  factType: 'instant' | 'duration' | 'offeror' | 'issuer' | 'management',
  memberIndex?: number,
  entityType?: 'offeror' | 'issuer' | 'operator'
): string {
  if (factType === 'management' && memberIndex !== undefined && entityType) {
    return generateContextId(`mgmt_${entityType}`, memberIndex);
  }
  return generateContextId(factType);
}
