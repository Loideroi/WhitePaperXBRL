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
import type { WhitepaperPart } from '@/types/taxonomy';
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
import { escapeHtml } from './template/inline-tagger';
import {
  getFieldsForSection,
} from './mica-template/field-definitions';
import {
  getEnumerationUri,
  getEnumerationLabel,
} from './mica-template/enumeration-mappings';

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
 * Map whitepaper data to fact values for each field definition.
 * Returns a Map keyed by xbrlElement name.
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
      value: String(value),
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
${css}
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
      <ix:references>
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
 * Create an IXBRLDocument object (for programmatic use)
 */
export function createIXBRLDocument(data: Partial<WhitepaperData>): IXBRLDocument {
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

  const units = getUsedUnits(factValues);

  return {
    contexts,
    units,
    facts,
    language: data.language || 'en',
    taxonomyRef: TAXONOMY_REF,
  };
}
