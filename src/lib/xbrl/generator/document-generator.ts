/**
 * Full-Document iXBRL Generator
 *
 * Generates a complete MiCA-compliant iXBRL document that IS the whitepaper.
 * Per ITS (EU) 2024/2984 Article 2: the Inline XBRL instance document
 * containing the crypto-asset white paper shall be submitted as a single XHTML file.
 *
 * Output structure matches the ESMA/SPURS reference pattern:
 * - Full XHTML document with embedded CSS
 * - Cover page, table of contents, and MiCA-template numbered tables
 * - ix:header at end of body with contexts, units, and hidden facts
 * - Inline XBRL tags wrapping visible content
 */

import type { XBRLContext, XBRLUnit, IXBRLDocument } from '@/types/xbrl';
import type { WhitepaperData } from '@/types/whitepaper';
import type { WhitepaperPart, XBRLDataType } from '@/types/taxonomy';
import { buildAllContexts, getContextId } from './context-builder';
import { STANDARD_UNITS } from './fact-builder';
import { generateCSSStylesheet } from './template/css-styles';
import { renderCoverPage, renderTableOfContents, wrapInPage } from './template/page-layout';
import {
  renderSection,
  renderDimensionalSection,
  resetFactIdCounter,
  type FactValue,
} from './template/section-renderer';
import { generateHiddenBlock, type HiddenFactEntry } from './template/hidden-facts';
import { escapeHtml, getUnitRefForType } from './template/inline-tagger';
import {
  getFieldsForSection,
  OTHR_FIELD_DEFINITIONS,
} from './mica-template/field-definitions';
import {
  getEnumerationUri,
  getEnumerationLabel,
} from './mica-template/enumeration-mappings';
import { detectDuplicateFacts, type DuplicateFactResult } from '../validator/duplicate-detector';

/**
 * XBRL Namespaces for the document root element
 */
const NAMESPACES: Record<string, string> = {
  xbrli: 'http://www.xbrl.org/2003/instance',
  ix: 'http://www.xbrl.org/2013/inlineXBRL',
  ixt: 'http://www.xbrl.org/inlineXBRL/transformation/2020-02-12',
  ixt4: 'http://www.xbrl.org/inlineXBRL/transformation/2020-02-12',
  link: 'http://www.xbrl.org/2003/linkbase',
  xlink: 'http://www.w3.org/1999/xlink',
  xbrldi: 'http://xbrl.org/2006/xbrldi',
  mica: 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
  iso4217: 'http://www.xbrl.org/2003/iso4217',
  utr: 'http://www.xbrl.org/2009/utr',
};

/**
 * Taxonomy reference - specific OTHR entry point
 */
const TAXONOMY_REF = 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/mica_entry_table_2.xsd';

/**
 * XBRL element names for country enumeration fields.
 * Used to identify country fields in the rawFields fallback path.
 */
const COUNTRY_ENUM_ELEMENTS = new Set([
  'mica:OfferorsRegisteredCountry',
  'mica:OfferorsHeadOfficeCountry',
  'mica:IssuersRegisteredCountry',
  'mica:IssuersHeadOfficeCountry',
  'mica:OperatorsRegisteredCountry',
  'mica:OperatorsHeadOfficeCountry',
  'mica:DomicileOfCompanyOfPersonInvolvedInImplementationOfOtherToken',
]);

/**
 * Try to extract an ISO 3166-1 alpha-2 country code from address-like text.
 * Used when rawFields contain full addresses instead of just country codes.
 */
function tryExtractCountryCode(text: string): string | null {
  const countryMap: Record<string, string> = {
    switzerland: 'CH', malta: 'MT', germany: 'DE', france: 'FR',
    ireland: 'IE', netherlands: 'NL', luxembourg: 'LU', austria: 'AT',
    belgium: 'BE', spain: 'ES', italy: 'IT', portugal: 'PT', poland: 'PL',
    'united kingdom': 'GB', singapore: 'SG', indonesia: 'ID',
    iceland: 'IS', liechtenstein: 'LI', norway: 'NO',
    'united states': 'US', canada: 'CA', australia: 'AU', japan: 'JP',
    brazil: 'BR', 'united arab emirates': 'AE', israel: 'IL',
    'south korea': 'KR', india: 'IN', china: 'CN', turkey: 'TR',
    'south africa': 'ZA', 'new zealand': 'NZ', gibraltar: 'GI',
    sweden: 'SE', denmark: 'DK', finland: 'FI', greece: 'GR',
    hungary: 'HU', romania: 'RO', bulgaria: 'BG', croatia: 'HR',
    cyprus: 'CY', czechia: 'CZ', estonia: 'EE', latvia: 'LV',
    lithuania: 'LT', slovakia: 'SK', slovenia: 'SI',
  };
  // Try last comma-separated component first (common address format)
  const parts = text.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase();
    for (const [name, code] of Object.entries(countryMap)) {
      if (last.includes(name)) return code;
    }
  }
  // Try full text
  const lower = text.toLowerCase();
  for (const [name, code] of Object.entries(countryMap)) {
    if (lower.includes(name)) return code;
  }
  return null;
}

const NUMERIC_DATA_TYPES: XBRLDataType[] = [
  'monetaryItemType',
  'decimalItemType',
  'integerItemType',
  'percentItemType',
];

/**
 * Get default decimals value for a numeric data type.
 */
function getDefaultDecimals(dataType: XBRLDataType): number | undefined {
  switch (dataType) {
    case 'integerItemType':
      return 0;
    case 'monetaryItemType':
    case 'decimalItemType':
      return 2;
    case 'percentItemType':
      return 4;
    default:
      return undefined;
  }
}

/**
 * Attempt to extract a numeric value from narrative text for numeric field types.
 * E.g., "(Days) Response time: 7 days." → "7"
 *       "600,000 tokens" → "600000"
 *       "81%" → "81"
 * Returns the original text if no number can be extracted.
 */
function tryExtractNumericValue(text: string, dataType: XBRLDataType): string {
  if (!NUMERIC_DATA_TYPES.includes(dataType)) return text;

  // If text indicates "not applicable", return empty string (skip the field)
  if (/not\s+applicable|n\/a|none|nil/i.test(text)) {
    return '';
  }

  // 1. Prefer numbers adjacent to currency symbols or units (search original text)
  const currencyAdjacentMatch = text.match(
    /(?:EUR|USD|CHF|€|\$)\s*([\d,]+(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:EUR|USD|CHF|kWh|%)/i
  );
  if (currencyAdjacentMatch) {
    const num = (currencyAdjacentMatch[1] || currencyAdjacentMatch[2] || '').replace(/,/g, '');
    if (num && isFinite(Number(num))) return num;
  }

  // 2. Strip dates, times, and currency/percent before looking for standalone numbers
  let cleaned = text;
  // Remove ISO dates (2023-10-04), slash dates (04/10/2023), and long dates (October 4, 2023)
  cleaned = cleaned.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, '');
  cleaned = cleaned.replace(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/g, '');
  // Remove time patterns (11:00, 14:30:00)
  cleaned = cleaned.replace(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:CET|UTC|GMT|[AP]M)?/gi, '');
  // Strip currency symbols, commas, percent signs
  cleaned = cleaned.replace(/[,$€£%]/g, '').trim();

  // Find remaining numbers
  const numberMatches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)/g)];
  for (const m of numberMatches) {
    const num = m[1];
    if (num && isFinite(Number(num))) {
      // Skip obvious year values (4-digit numbers 1900-2099)
      const numVal = Number(num);
      if (numVal >= 1900 && numVal <= 2099 && num.length === 4) continue;
      return num;
    }
  }

  // No valid number found — return empty string (better no value than wrong value)
  return '';
}

/**
 * Map whitepaper data to fact values for each field definition.
 * Returns a Map keyed by xbrlElement name.
 *
 * Note: Duplicates are inherently prevented for non-dimensional facts because
 * `values` is a Map keyed by `xbrlElement`. The `values.set()` call overwrites
 * any prior entry for the same element, and the rawFields loop explicitly checks
 * `values.has(fieldDef.xbrlElement)` before setting to avoid overwriting typed
 * extractions. For additional safety, the duplicate detector
 * (`detectDuplicateFacts`) is run post-generation to catch any edge cases.
 */
function mapDataToFactValues(
  data: Partial<WhitepaperData>,
  durationContextId: string,
  instantContextId: string
): Map<string, FactValue> {
  const values = new Map<string, FactValue>();
  const dataObj = data as Record<string, unknown>;

  // Helper to resolve nested data paths
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

  // Map data fields to their XBRL elements
  // Part A mappings
  setValueIfPresent('mica:NameOfOtherTokenOfferor', getNestedValue(dataObj, 'partA.legalName'));
  setValueIfPresent('mica:OfferorsLegalEntityIdentifier', getNestedValue(dataObj, 'partA.lei'));
  setValueIfPresent('mica:OfferorsRegisteredAddress', getNestedValue(dataObj, 'partA.registeredAddress'));
  setValueIfPresent('mica:OfferorsEmailAddress', getNestedValue(dataObj, 'partA.contactEmail'));
  setValueIfPresent('mica:OfferorsContactTelephoneNumber', getNestedValue(dataObj, 'partA.contactPhone'));
  setValueIfPresent('mica:OtherTokenIssuersWebsite', getNestedValue(dataObj, 'partA.website'));

  // Map country to enumeration
  const country = getNestedValue(dataObj, 'partA.country') as string | undefined;
  if (country) {
    const countryUri = getEnumerationUri('mica:OfferorsRegisteredCountry', country);
    if (countryUri) {
      setEnumValue('mica:OfferorsRegisteredCountry', country, countryUri,
        getEnumerationLabel('mica:OfferorsRegisteredCountry', country) || country);
      // Also set head office country to same value if not explicitly different
      if (!values.has('mica:OfferorsHeadOfficeCountry')) {
        setEnumValue('mica:OfferorsHeadOfficeCountry', country, countryUri,
          getEnumerationLabel('mica:OfferorsHeadOfficeCountry', country) || country);
      }
    }
  }

  // Part B mappings
  if (data.partB) {
    setValueIfPresent('mica:IssuerDifferentFromOfferrorOrPersonSeekingAdmissionToTrading', 'true');
    setValueIfPresent('mica:NameOfOtherTokenIssuer', getNestedValue(dataObj, 'partB.legalName'));
    setValueIfPresent('mica:IssuersLegalEntityIdentifier', getNestedValue(dataObj, 'partB.lei'));
    setValueIfPresent('mica:IssuersRegisteredAddress', getNestedValue(dataObj, 'partB.registeredAddress'));
  }

  // Part C mappings
  if (data.partC) {
    setValueIfPresent('mica:NameOfOtherTokenOperator', getNestedValue(dataObj, 'partC.legalName'));
    setValueIfPresent('mica:OperatorsLegalEntityIdentifier', getNestedValue(dataObj, 'partC.lei'));
    setValueIfPresent('mica:OperatorsRegisteredAddress', getNestedValue(dataObj, 'partC.registeredAddress'));
  }

  // Part D mappings
  setValueIfPresent('mica:NameOfOtherTokenProject', getNestedValue(dataObj, 'partD.cryptoAssetName'));
  setValueIfPresent('mica:NameOfOtherToken', getNestedValue(dataObj, 'partD.cryptoAssetName'));
  setValueIfPresent('mica:OtherTokenProjectAbbreviation', getNestedValue(dataObj, 'partD.cryptoAssetSymbol'));
  setValueIfPresent('mica:DescriptionOfOtherTokenProjectExplanatory', getNestedValue(dataObj, 'partD.projectDescription'));

  // Part E mappings
  const isPublicOffering = getNestedValue(dataObj, 'partE.isPublicOffering');
  if (isPublicOffering !== undefined) {
    const offerKey = isPublicOffering ? 'publicOffering' : 'admissionToTrading';
    const uri = getEnumerationUri('mica:PublicOfferingOrAdmissionToTrading', offerKey);
    const label = getEnumerationLabel('mica:PublicOfferingOrAdmissionToTrading', offerKey);
    if (uri && label) {
      setEnumValue('mica:PublicOfferingOrAdmissionToTrading', offerKey, uri, label);
    }
  }

  setValueIfPresent('mica:SubscriptionPeriodBeginning', getNestedValue(dataObj, 'partE.publicOfferingStartDate'), 'instant');
  setValueIfPresent('mica:SubscriptionPeriodEnd', getNestedValue(dataObj, 'partE.publicOfferingEndDate'), 'instant');

  const tokenPrice = getNestedValue(dataObj, 'partE.tokenPrice');
  if (tokenPrice !== undefined && tokenPrice !== null) {
    const currency = (getNestedValue(dataObj, 'partE.tokenPriceCurrency') as string) || 'USD';
    values.set('mica:IssuePrice', {
      value: String(tokenPrice),
      contextRef: durationContextId,
      unitRef: `unit_${currency}`,
      decimals: 2,
    });
    // Set the currency enumeration
    const currUri = getEnumerationUri('mica:OfficialCurrencyDeterminingIssuePrice', currency);
    if (currUri) {
      setEnumValue('mica:OfficialCurrencyDeterminingIssuePrice', currency, currUri,
        getEnumerationLabel('mica:OfficialCurrencyDeterminingIssuePrice', currency) || currency);
    }
  }

  const maxSubscription = getNestedValue(dataObj, 'partE.maxSubscriptionGoal');
  if (maxSubscription !== undefined && maxSubscription !== null) {
    const currency = (getNestedValue(dataObj, 'partE.tokenPriceCurrency') as string) || 'USD';
    values.set('mica:MaximumSubscriptionGoalsExpressedInCurrency', {
      value: String(maxSubscription),
      contextRef: durationContextId,
      unitRef: `unit_${currency}`,
      decimals: 0,
    });
  }

  const totalSupply = getNestedValue(dataObj, 'partD.totalSupply');
  if (totalSupply !== undefined && totalSupply !== null) {
    values.set('mica:TotalNumberOfOfferedOrTradedOtherTokens', {
      value: String(Math.round(Number(totalSupply))),
      contextRef: instantContextId,
      unitRef: 'unit_pure',
      decimals: 0,
    });
  }

  const withdrawalRights = getNestedValue(dataObj, 'partE.withdrawalRights');
  if (withdrawalRights !== undefined) {
    setValueIfPresent('mica:RighOfWithdrawalExplanatory',
      withdrawalRights ? 'The purchaser has a right of withdrawal within 14 calendar days.' : 'No right of withdrawal.');
  }

  // Part F mappings
  setValueIfPresent('mica:OtherTokenType', getNestedValue(dataObj, 'partD.tokenStandard'));
  setValueIfPresent('mica:DescriptionOfOtherTokenCharacteristicsExplanatory', getNestedValue(dataObj, 'partF.classification'));
  setValueIfPresent('mica:InformationAboutLanguagesUsedInOtherTokenWhitePaper', data.language || 'en');

  // Part G mappings
  setValueIfPresent('mica:InformationAboutPurchaserRightsAndObligationsExplanatory', getNestedValue(dataObj, 'partG.purchaseRights'));
  setValueIfPresent('mica:OtherTokensTransferRestrictionsExplanatory', getNestedValue(dataObj, 'partG.transferRestrictions'));
  setValueIfPresent('mica:SupplyAdjustmentMechanismsExplanatory', getNestedValue(dataObj, 'partG.dynamicSupplyMechanism'));

  // Part H mappings
  setValueIfPresent('mica:DistributedLedgerTechnologyForOtherTokenExplanatory', getNestedValue(dataObj, 'partH.blockchainDescription'));
  setValueIfPresent('mica:ProtocolsAndTechnicalStandardsForOtherTokenExplanatory', getNestedValue(dataObj, 'partH.smartContractInfo'));
  setValueIfPresent('mica:ConsensusMechanismForOtherTokenExplanatory', getNestedValue(dataObj, 'partD.consensusMechanism'));
  setValueIfPresent('mica:UseOfDistributedLedgerTechnologyIndicatorForOtherToken', 'true');

  const hasAudits = (data.partH?.securityAudits?.length ?? 0) > 0;
  if (hasAudits) {
    setValueIfPresent('mica:AuditIndicatorForOtherToken', 'true');
    setValueIfPresent('mica:AuditOutcomeForOtherTokenExplanatory',
      data.partH?.securityAudits?.join('; '));
  }

  // Part I mappings
  const partI = data.partI;
  if (partI) {
    setValueIfPresent('mica:DescriptionOfOfferrelatedRisksForOtherTokenExplanatory',
      partI.offerRisks?.join('\n\n'));
    setValueIfPresent('mica:DescriptionOfIssuerrelatedRisksForOtherTokenExplanatory',
      partI.issuerRisks?.join('\n\n'));
    setValueIfPresent('mica:OtherTokensrelatedRisksExplanatory',
      partI.marketRisks?.join('\n\n'));
    setValueIfPresent('mica:DescriptionOfTechnologyrelatedRisksForOtherTokenExplanatory',
      partI.technologyRisks?.join('\n\n'));
    setValueIfPresent('mica:ProjectImplementationrelatedRisksExplanatory',
      partI.regulatoryRisks?.join('\n\n'));
  }

  // Part J / Sustainability mappings
  setValueIfPresent('mica:InformationOnAdverseImpactsOnClimateAndOtherEnvironmentrelatedAdverseImpactsForOtherTokenTokenExplanatory',
    getNestedValue(dataObj, 'partJ.consensusMechanismType'));
  setValueIfPresent('mica:ConsensusMechanismSustainabilityExplanatory',
    getNestedValue(dataObj, 'partJ.consensusMechanismType'));

  const energyConsumption = getNestedValue(dataObj, 'partJ.energyConsumption');
  if (energyConsumption !== undefined && energyConsumption !== null) {
    setValueIfPresent('mica:EnergyConsumption', `${energyConsumption} kWh`);
  }

  const renewablePercent = getNestedValue(dataObj, 'partJ.renewableEnergyPercentage');
  if (renewablePercent !== undefined && renewablePercent !== null) {
    values.set('mica:RenewableEnergyConsumptionPercentage', {
      value: String(renewablePercent),
      contextRef: durationContextId,
      unitRef: 'unit_pure',
      decimals: 2,
    });
  }

  // Helper function to set a value
  function setValueIfPresent(
    element: string,
    value: unknown,
    periodOverride?: 'instant' | 'duration'
  ): void {
    if (value === undefined || value === null || value === '') return;
    const ctxRef = periodOverride === 'instant' ? instantContextId : durationContextId;
    values.set(element, {
      value: String(value).trim(),
      contextRef: ctxRef,
    });
  }

  // Helper function to set an enumeration value
  function setEnumValue(
    element: string,
    key: string,
    taxonomyUri: string,
    humanReadable: string
  ): void {
    values.set(element, {
      value: key,
      contextRef: durationContextId,
      taxonomyUri,
      humanReadable,
    });
  }

  // Fill in from rawFields for any field not already mapped via typed extraction
  const rawFields = getNestedValue(dataObj, 'rawFields') as Record<string, string> | undefined;
  if (rawFields) {
    for (const fieldDef of OTHR_FIELD_DEFINITIONS) {
      // Skip if already mapped
      if (values.has(fieldDef.xbrlElement)) continue;
      // Skip dimensional fields (management body members etc.)
      if (fieldDef.isDimensional) continue;

      // Look up by exact field number
      let content = rawFields[fieldDef.number];

      // For sub-fields with letter suffix (A.3s, A.12a etc.), try the parent number
      if (!content && /[a-z]$/.test(fieldDef.number)) {
        const parentNum = fieldDef.number.replace(/[a-z]$/, '');
        content = rawFields[parentNum];
      }

      if (content && content.trim().length > 0) {
        const ctxRef = fieldDef.periodType === 'instant' ? instantContextId : durationContextId;
        const trimmedContent = content.trim();

        // For enumeration fields, try to resolve to taxonomy URI
        if (fieldDef.isHidden && fieldDef.dataType === 'enumerationItemType') {
          // Try to get the enumeration URI directly (works when value is already a code like "CH")
          let enumKey = trimmedContent;
          let enumUri = getEnumerationUri(fieldDef.xbrlElement, enumKey);

          // For country fields, try extracting a country code from address-like text
          if (!enumUri && COUNTRY_ENUM_ELEMENTS.has(fieldDef.xbrlElement)) {
            const extracted = tryExtractCountryCode(trimmedContent);
            if (extracted) {
              enumKey = extracted;
              enumUri = getEnumerationUri(fieldDef.xbrlElement, enumKey);
            }
          }

          if (enumUri) {
            const humanLabel = getEnumerationLabel(fieldDef.xbrlElement, enumKey) || enumKey;
            values.set(fieldDef.xbrlElement, {
              value: enumKey,
              contextRef: ctxRef,
              taxonomyUri: enumUri,
              humanReadable: humanLabel,
            });
          } else {
            // No URI mapping - display as regular text with human-readable value
            values.set(fieldDef.xbrlElement, {
              value: trimmedContent,
              contextRef: ctxRef,
              humanReadable: trimmedContent,
            });
          }
        } else {
          // Regular field — for numeric types, attempt numeric extraction and add unitRef/decimals
          const processedValue = tryExtractNumericValue(trimmedContent, fieldDef.dataType);
          const unitRef = getUnitRefForType(fieldDef.dataType);
          const decimals = getDefaultDecimals(fieldDef.dataType);
          values.set(fieldDef.xbrlElement, {
            value: processedValue,
            contextRef: ctxRef,
            ...(unitRef && { unitRef }),
            ...(decimals !== undefined && { decimals }),
          });
        }
      }
    }
  }

  return values;
}

/**
 * Render XML for a context element
 */
function renderContextXml(context: XBRLContext): string {
  let periodXml: string;

  if ('instant' in context.period) {
    periodXml = `<xbrli:instant>${context.period.instant}</xbrli:instant>`;
  } else {
    periodXml = `
          <xbrli:startDate>${context.period.startDate}</xbrli:startDate>
          <xbrli:endDate>${context.period.endDate}</xbrli:endDate>`;
  }

  let scenarioXml = '';
  if (context.scenario) {
    if (context.scenario.explicitMember) {
      scenarioXml = `
        <xbrli:scenario>
          <xbrldi:explicitMember dimension="${context.scenario.explicitMember.dimension}">${context.scenario.explicitMember.value}</xbrldi:explicitMember>
        </xbrli:scenario>`;
    } else if (context.scenario.typedMember) {
      scenarioXml = `
        <xbrli:scenario>
          <xbrldi:typedMember dimension="${context.scenario.typedMember.dimension}">
            <mica:value>${escapeHtml(context.scenario.typedMember.value)}</mica:value>
          </xbrldi:typedMember>
        </xbrli:scenario>`;
    }
  }

  return `
        <xbrli:context id="${context.id}">
          <xbrli:entity>
            <xbrli:identifier scheme="${context.entity.scheme}">${context.entity.identifier}</xbrli:identifier>
          </xbrli:entity>
          <xbrli:period>${periodXml}
          </xbrli:period>${scenarioXml}
        </xbrli:context>`;
}

/**
 * Render XML for a unit element
 */
function renderUnitXml(unit: XBRLUnit): string {
  return `
        <xbrli:unit id="${unit.id}">
          <xbrli:measure>${unit.measure}</xbrli:measure>
        </xbrli:unit>`;
}

/**
 * Determine which units are used based on fact values
 */
function getUsedUnits(values: Map<string, FactValue>): XBRLUnit[] {
  const usedUnitIds = new Set<string>();
  for (const factValue of values.values()) {
    if (factValue.unitRef) {
      usedUnitIds.add(factValue.unitRef);
    }
  }
  return STANDARD_UNITS.filter(u => usedUnitIds.has(u.id));
}

/**
 * Generate the complete iXBRL document.
 *
 * This produces the full MiCA-template whitepaper as a single XHTML file
 * with inline XBRL tags embedded in the visible content.
 */
export function generateIXBRLDocument(data: Partial<WhitepaperData>): string {
  // Reset fact counter for deterministic output
  resetFactIdCounter();

  // Build contexts
  const contexts = buildAllContexts(data);
  const durationCtxId = getContextId('duration');
  const instantCtxId = getContextId('instant');

  // Map data to fact values
  const factValues = mapDataToFactValues(data, durationCtxId, instantCtxId);

  // Collect hidden facts (enumerations)
  const hiddenFacts: HiddenFactEntry[] = [];

  // Determine which units are needed
  const units = getUsedUnits(factValues);

  // Determine which sections have content
  const allSections: (WhitepaperPart | 'summary' | 'S')[] = [
    'summary', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'S',
  ];

  // Render all section content
  const sectionPages: string[] = [];

  for (const sectionKey of allSections) {
    const fields = getFieldsForSection(sectionKey);
    if (fields.length === 0) continue;

    const sectionHtml = renderSection(sectionKey, fields, factValues, hiddenFacts);

    // Render dimensional tables for this section
    let dimensionalHtml = '';

    if (sectionKey === 'A' && data.managementBodyMembers?.offeror?.length) {
      dimensionalHtml += renderDimensionalSection(
        'Offeror Management Body Members',
        data.managementBodyMembers.offeror.map((m, i) => ({
          identity: m.identity,
          businessAddress: m.businessAddress,
          functionOrType: m.function,
          contextRef: getContextId('management', i, 'offeror'),
        })),
        {
          identityElement: 'mica:IdentityOfOfferorsManagementBodyMemberForOtherToken',
          addressElement: 'mica:BusinessAddressOfOfferorsManagementBodyMemberForOtherToken',
          functionElement: 'mica:FunctionOfOfferorsManagementBodyMemberForOtherToken',
        },
        hiddenFacts
      );
    }

    if (sectionKey === 'B' && data.managementBodyMembers?.issuer?.length) {
      dimensionalHtml += renderDimensionalSection(
        'Issuer Management Body Members',
        data.managementBodyMembers.issuer.map((m, i) => ({
          identity: m.identity,
          businessAddress: m.businessAddress,
          functionOrType: m.function,
          contextRef: getContextId('management', i, 'issuer'),
        })),
        {
          identityElement: 'mica:IdentityOfIssuersManagementBodyMemberForOtherToken',
          addressElement: 'mica:BusinessAddressOfIssuersManagementBodyMemberForOtherToken',
          functionElement: 'mica:FunctionOfIssuersManagementBodyMemberForOtherToken',
        },
        hiddenFacts
      );
    }

    if (sectionKey === 'C') {
      if (data.managementBodyMembers?.operator?.length) {
        dimensionalHtml += renderDimensionalSection(
          'Operator Management Body Members',
          data.managementBodyMembers.operator.map((m, i) => ({
            identity: m.identity,
            businessAddress: m.businessAddress,
            functionOrType: m.function,
            contextRef: getContextId('management', i, 'operator'),
          })),
          {
            identityElement: 'mica:IdentityOfOperatorsManagementBodyMemberForOtherToken',
            addressElement: 'mica:BusinessAddressOfOperatorsManagementBodyMemberForOtherToken',
            functionElement: 'mica:FunctionOfOperatorsManagementBodyMemberForOtherToken',
          },
          hiddenFacts
        );
      }

      if (data.projectPersons?.length) {
        dimensionalHtml += renderDimensionalSection(
          'Persons Involved in Implementation',
          data.projectPersons.map((p, i) => ({
            identity: p.identity,
            businessAddress: p.businessAddress,
            functionOrType: p.role,
            contextRef: getContextId('person_involved', i),
          })),
          {
            identityElement: 'mica:NameOfPersonInvolvedInImplementationOfOtherToken',
            addressElement: 'mica:BusinessAddressOfPersonInvolvedInImplementationOfOtherToken',
            functionElement: 'mica:TypeOfPersonInvolvedInImplementationOfOtherToken',
          },
          hiddenFacts
        );
      }
    }

    sectionPages.push(wrapInPage(
      sectionHtml + dimensionalHtml,
      `section-${sectionKey}`
    ));
  }

  // Generate namespace declarations
  const nsDeclarations = Object.entries(NAMESPACES)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join('\n    ');

  // Generate contexts XML
  const contextsXml = contexts.map(renderContextXml).join('\n');

  // Generate units XML
  const unitsXml = units.map(renderUnitXml).join('\n');

  // Generate hidden facts block
  const hiddenBlockXml = generateHiddenBlock(hiddenFacts);

  // Generate cover page
  const coverPage = renderCoverPage({
    projectName: data.partD?.cryptoAssetName || 'Crypto-Asset',
    cryptoAssetName: data.partD?.cryptoAssetName || 'Unknown Token',
    symbol: data.partD?.cryptoAssetSymbol || '???',
    offerorName: data.partA?.legalName || 'Unknown Offeror',
    documentDate: data.documentDate || new Date().toISOString().split('T')[0] || '',
    language: data.language || 'en',
  });

  // Generate table of contents
  const tocPage = renderTableOfContents(allSections);

  // Generate CSS
  const css = generateCSSStylesheet();

  // Assemble the complete document
  const document = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"
    ${nsDeclarations}
    xml:lang="${data.language || 'en'}">
<head>
  <meta charset="utf-8" />
  <title>MiCA Crypto-Asset White Paper - ${escapeHtml(data.partD?.cryptoAssetName || 'Unknown')}</title>
  <style type="text/css">
/* <![CDATA[ */
${css}
/* ]]> */
  </style>
</head>
<body>

${coverPage}

${tocPage}

${sectionPages.join('\n')}

  <!-- ix:header at END of body (ESMA placement pattern) -->
  <div style="display:none">
    <ix:header>
${hiddenBlockXml}
      <ix:references xml:lang="${data.language || 'en'}">
        <link:schemaRef xlink:href="${TAXONOMY_REF}" xlink:type="simple" />
      </ix:references>
      <ix:resources>
${contextsXml}
${unitsXml}
      </ix:resources>
    </ix:header>
  </div>

</body>
</html>`;

  return document;
}

/**
 * Create an IXBRLDocument object (for programmatic use).
 *
 * After building facts, runs duplicate detection and logs warnings if any
 * duplicate facts are found. The duplicate result is also attached to the
 * returned document for downstream consumers.
 */
export function createIXBRLDocument(
  data: Partial<WhitepaperData>
): IXBRLDocument & { duplicateCheck?: DuplicateFactResult } {
  const contexts = buildAllContexts(data);
  const durationCtxId = getContextId('duration');
  const instantCtxId = getContextId('instant');
  const factValues = mapDataToFactValues(data, durationCtxId, instantCtxId);

  // Convert fact values to XBRLFact array
  const facts = Array.from(factValues.entries()).map(([element, fv]) => ({
    name: element,
    contextRef: fv.contextRef,
    value: fv.value,
    unitRef: fv.unitRef,
    decimals: fv.decimals,
    isHidden: fv.taxonomyUri !== undefined,
    humanReadableValue: fv.humanReadable,
  }));

  // Run duplicate fact detection as a post-generation safety check
  const duplicateCheck = detectDuplicateFacts(
    facts.map((f) => ({
      name: f.name,
      contextRef: f.contextRef,
      value: String(f.value),
      unitRef: f.unitRef,
    }))
  );

  if (duplicateCheck.hasDuplicates) {
    console.warn(
      `[iXBRL Generator] Duplicate facts detected: ${duplicateCheck.duplicates.length} duplicate group(s) found across ${duplicateCheck.totalFacts} facts.`
    );
    for (const dup of duplicateCheck.duplicates) {
      console.warn(
        `  - "${dup.elementName}" (context: ${dup.contextRef}${dup.unitRef ? `, unit: ${dup.unitRef}` : ''}) appears ${dup.count} times`
      );
    }
  }

  const units = getUsedUnits(factValues);

  return {
    contexts,
    units,
    facts,
    language: data.language || 'en',
    taxonomyRef: TAXONOMY_REF,
    duplicateCheck,
  };
}
