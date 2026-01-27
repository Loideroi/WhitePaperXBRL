/**
 * XBRL Fact Builder
 *
 * Generates XBRL facts from whitepaper data with proper formatting.
 */

import type { XBRLFact, XBRLUnit } from '@/types/xbrl';
import type { WhitepaperData } from '@/types/whitepaper';
import { getContextId } from './context-builder';

/**
 * Standard units
 */
export const STANDARD_UNITS: XBRLUnit[] = [
  { id: 'unit_EUR', measure: 'iso4217:EUR' },
  { id: 'unit_USD', measure: 'iso4217:USD' },
  { id: 'unit_GBP', measure: 'iso4217:GBP' },
  { id: 'unit_CHF', measure: 'iso4217:CHF' },
  { id: 'unit_pure', measure: 'xbrli:pure' },
];

/**
 * Currency to unit ID mapping
 */
const CURRENCY_UNIT_MAP: Record<string, string> = {
  EUR: 'unit_EUR',
  USD: 'unit_USD',
  GBP: 'unit_GBP',
  CHF: 'unit_CHF',
};

let factCounter = 0;

/**
 * Generate unique fact ID
 */
function generateFactId(): string {
  return `f_${++factCounter}`;
}

/**
 * Reset fact counter (for testing)
 */
export function resetFactCounter(): void {
  factCounter = 0;
}

/**
 * Build a string fact (nonNumeric)
 */
export function buildStringFact(
  name: string,
  value: string,
  contextRef: string,
  escape = true
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    value,
    escape,
  };
}

/**
 * Build a boolean fact
 */
export function buildBooleanFact(
  name: string,
  value: boolean,
  contextRef: string
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    value: value ? 'true' : 'false',
  };
}

/**
 * Build a monetary fact (nonFraction)
 */
export function buildMonetaryFact(
  name: string,
  value: number,
  currency: string,
  contextRef: string,
  decimals = 2
): XBRLFact {
  const unitRef = CURRENCY_UNIT_MAP[currency] || 'unit_EUR';

  return {
    id: generateFactId(),
    name,
    contextRef,
    unitRef,
    decimals,
    value,
  };
}

/**
 * Build an integer fact (nonFraction)
 */
export function buildIntegerFact(
  name: string,
  value: number,
  contextRef: string
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    unitRef: 'unit_pure',
    decimals: 0,
    value: Math.round(value),
  };
}

/**
 * Build a decimal fact (nonFraction)
 */
export function buildDecimalFact(
  name: string,
  value: number,
  contextRef: string,
  decimals = 2
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    unitRef: 'unit_pure',
    decimals,
    value,
  };
}

/**
 * Build a date fact (dateItemType)
 */
export function buildDateFact(
  name: string,
  value: string,
  contextRef: string
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    value,
  };
}

/**
 * Build a text block fact (for large text content)
 */
export function buildTextBlockFact(
  name: string,
  value: string,
  contextRef: string
): XBRLFact {
  return {
    id: generateFactId(),
    name,
    contextRef,
    value,
    escape: true,
  };
}

/**
 * Fact mapping configuration
 */
interface FactMapping {
  elementName: string;
  dataPath: string;
  type: 'string' | 'boolean' | 'monetary' | 'integer' | 'decimal' | 'date' | 'textblock';
  contextType?: 'instant' | 'duration' | 'offeror' | 'issuer';
}

/**
 * Field to XBRL element mappings
 */
const FACT_MAPPINGS: FactMapping[] = [
  // Part A: Offeror
  { elementName: 'mica:OfferorLegalName', dataPath: 'partA.legalName', type: 'string' },
  { elementName: 'mica:OfferorLegalEntityIdentifier', dataPath: 'partA.lei', type: 'string' },
  { elementName: 'mica:OfferorRegisteredAddress', dataPath: 'partA.registeredAddress', type: 'textblock' },
  { elementName: 'mica:OfferorCountry', dataPath: 'partA.country', type: 'string' },
  { elementName: 'mica:OfferorWebsite', dataPath: 'partA.website', type: 'string' },
  { elementName: 'mica:OfferorContactEmail', dataPath: 'partA.contactEmail', type: 'string' },

  // Part B: Issuer (if different)
  { elementName: 'mica:IssuerLegalName', dataPath: 'partB.legalName', type: 'string', contextType: 'issuer' },
  { elementName: 'mica:IssuerLegalEntityIdentifier', dataPath: 'partB.lei', type: 'string', contextType: 'issuer' },

  // Part D: Project
  { elementName: 'mica:CryptoAssetName', dataPath: 'partD.cryptoAssetName', type: 'string' },
  { elementName: 'mica:CryptoAssetSymbol', dataPath: 'partD.cryptoAssetSymbol', type: 'string' },
  { elementName: 'mica:TotalSupply', dataPath: 'partD.totalSupply', type: 'integer' },
  { elementName: 'mica:TokenStandard', dataPath: 'partD.tokenStandard', type: 'string' },
  { elementName: 'mica:BlockchainNetwork', dataPath: 'partD.blockchainNetwork', type: 'string' },
  { elementName: 'mica:ConsensusMechanism', dataPath: 'partD.consensusMechanism', type: 'string' },
  { elementName: 'mica:ProjectDescription', dataPath: 'partD.projectDescription', type: 'textblock' },

  // Part E: Offering
  { elementName: 'mica:IsPublicOffering', dataPath: 'partE.isPublicOffering', type: 'boolean' },
  { elementName: 'mica:PublicOfferingStartDate', dataPath: 'partE.publicOfferingStartDate', type: 'date' },
  { elementName: 'mica:PublicOfferingEndDate', dataPath: 'partE.publicOfferingEndDate', type: 'date' },
  { elementName: 'mica:TokenPrice', dataPath: 'partE.tokenPrice', type: 'monetary' },
  { elementName: 'mica:MaxSubscriptionGoal', dataPath: 'partE.maxSubscriptionGoal', type: 'monetary' },
  { elementName: 'mica:WithdrawalRights', dataPath: 'partE.withdrawalRights', type: 'boolean' },

  // Part H: Technology
  { elementName: 'mica:BlockchainDescription', dataPath: 'partH.blockchainDescription', type: 'textblock' },
  { elementName: 'mica:SmartContractInfo', dataPath: 'partH.smartContractInfo', type: 'textblock' },

  // Part J: Sustainability
  { elementName: 'mica:EnergyConsumption', dataPath: 'partJ.energyConsumption', type: 'decimal' },
  { elementName: 'mica:ConsensusMechanismType', dataPath: 'partJ.consensusMechanismType', type: 'string' },
  { elementName: 'mica:RenewableEnergyPercentage', dataPath: 'partJ.renewableEnergyPercentage', type: 'decimal' },
];

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Build all facts from whitepaper data
 */
export function buildAllFacts(data: Partial<WhitepaperData>): XBRLFact[] {
  resetFactCounter();
  const facts: XBRLFact[] = [];
  const dataObj = data as Record<string, unknown>;

  // Token type fact
  if (data.tokenType) {
    facts.push(buildStringFact('mica:TokenType', data.tokenType, getContextId('instant')));
  }

  // Document date fact
  if (data.documentDate) {
    facts.push(buildDateFact('mica:DocumentDate', data.documentDate, getContextId('instant')));
  }

  // Language fact
  if (data.language) {
    facts.push(buildStringFact('mica:DocumentLanguage', data.language, getContextId('instant')));
  }

  // Process mapped facts
  for (const mapping of FACT_MAPPINGS) {
    const value = getNestedValue(dataObj, mapping.dataPath);

    if (value === undefined || value === null || value === '') {
      continue;
    }

    const contextRef = getContextId(mapping.contextType || 'instant');

    switch (mapping.type) {
      case 'string':
        facts.push(buildStringFact(mapping.elementName, String(value), contextRef));
        break;

      case 'boolean':
        facts.push(buildBooleanFact(mapping.elementName, Boolean(value), contextRef));
        break;

      case 'monetary': {
        const currency = (dataObj as Record<string, Record<string, string>>)[mapping.dataPath.split('.')[0] || '']?.tokenPriceCurrency || 'EUR';
        facts.push(buildMonetaryFact(mapping.elementName, Number(value), currency, contextRef));
        break;
      }

      case 'integer':
        facts.push(buildIntegerFact(mapping.elementName, Number(value), contextRef));
        break;

      case 'decimal':
        facts.push(buildDecimalFact(mapping.elementName, Number(value), contextRef));
        break;

      case 'date':
        facts.push(buildDateFact(mapping.elementName, String(value), contextRef));
        break;

      case 'textblock':
        facts.push(buildTextBlockFact(mapping.elementName, String(value), contextRef));
        break;
    }
  }

  return facts;
}

/**
 * Get all required units for the facts
 */
export function getRequiredUnits(facts: XBRLFact[]): XBRLUnit[] {
  const usedUnitIds = new Set<string>();

  for (const fact of facts) {
    if (fact.unitRef) {
      usedUnitIds.add(fact.unitRef);
    }
  }

  return STANDARD_UNITS.filter((unit) => usedUnitIds.has(unit.id));
}
