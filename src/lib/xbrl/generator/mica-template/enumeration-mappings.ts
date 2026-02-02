/**
 * MiCA Enumeration Mappings
 *
 * Maps enumeration field values to their ESMA taxonomy URIs.
 * Used for ix:hidden fact generation where enumeration facts contain
 * taxonomy member URIs rather than human-readable values.
 */

const TAXONOMY_BASE = 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/';

/**
 * Enumeration mapping entry
 */
export interface EnumerationMapping {
  /** Human-readable display value */
  humanReadable: string;
  /** Full taxonomy URI for the member */
  taxonomyUri: string;
}

/**
 * Public offering or admission to trading (E.1)
 */
export const PUBLIC_OFFERING_ENUM: Record<string, EnumerationMapping> = {
  publicOffering: {
    humanReadable: 'Public offering',
    taxonomyUri: `${TAXONOMY_BASE}#OfferToThePublic`,
  },
  admissionToTrading: {
    humanReadable: 'Admission to trading',
    taxonomyUri: `${TAXONOMY_BASE}#AdmissionToTrading`,
  },
  both: {
    humanReadable: 'Both public offering and admission to trading',
    taxonomyUri: `${TAXONOMY_BASE}#OfferToThePublicAndAdmissionToTrading`,
  },
};

/**
 * Official currency determining issue price (E.9)
 */
export const CURRENCY_ENUM: Record<string, EnumerationMapping> = {
  EUR: { humanReadable: 'Euro (EUR)', taxonomyUri: `${TAXONOMY_BASE}#EUR` },
  USD: { humanReadable: 'US Dollar (USD)', taxonomyUri: `${TAXONOMY_BASE}#USD` },
  GBP: { humanReadable: 'British Pound (GBP)', taxonomyUri: `${TAXONOMY_BASE}#GBP` },
  CHF: { humanReadable: 'Swiss Franc (CHF)', taxonomyUri: `${TAXONOMY_BASE}#CHF` },
};

/**
 * Targeted holders (E.13)
 */
export const TARGETED_HOLDERS_ENUM: Record<string, EnumerationMapping> = {
  allInvestors: {
    humanReadable: 'All types of investors',
    taxonomyUri: `${TAXONOMY_BASE}#AllTypesOfInvestors`,
  },
  retailInvestors: {
    humanReadable: 'Retail investors',
    taxonomyUri: `${TAXONOMY_BASE}#RetailInvestors`,
  },
  qualifiedInvestors: {
    humanReadable: 'Qualified investors',
    taxonomyUri: `${TAXONOMY_BASE}#QualifiedInvestors`,
  },
};

/**
 * Placement form (E.32)
 */
export const PLACEMENT_FORM_ENUM: Record<string, EnumerationMapping> = {
  direct: {
    humanReadable: 'Direct placement',
    taxonomyUri: `${TAXONOMY_BASE}#DirectPlacement`,
  },
  throughCASP: {
    humanReadable: 'Through CASP',
    taxonomyUri: `${TAXONOMY_BASE}#ThroughCASP`,
  },
};

/**
 * Type of crypto-asset white paper (F.4)
 */
export const WHITE_PAPER_TYPE_ENUM: Record<string, EnumerationMapping> = {
  initial: {
    humanReadable: 'Initial white paper',
    taxonomyUri: `${TAXONOMY_BASE}#InitialWhitePaper`,
  },
  modified: {
    humanReadable: 'Modified white paper',
    taxonomyUri: `${TAXONOMY_BASE}#ModifiedWhitePaper`,
  },
};

/**
 * Type of submission (F.5)
 */
export const SUBMISSION_TYPE_ENUM: Record<string, EnumerationMapping> = {
  notification: {
    humanReadable: 'Notification',
    taxonomyUri: `${TAXONOMY_BASE}#Notification`,
  },
  application: {
    humanReadable: 'Application for admission to trading',
    taxonomyUri: `${TAXONOMY_BASE}#ApplicationForAdmissionToTrading`,
  },
};

/**
 * Home member state (F.18) - EU member states
 */
export const MEMBER_STATE_ENUM: Record<string, EnumerationMapping> = {
  AT: { humanReadable: 'Austria', taxonomyUri: `${TAXONOMY_BASE}#AT` },
  BE: { humanReadable: 'Belgium', taxonomyUri: `${TAXONOMY_BASE}#BE` },
  BG: { humanReadable: 'Bulgaria', taxonomyUri: `${TAXONOMY_BASE}#BG` },
  HR: { humanReadable: 'Croatia', taxonomyUri: `${TAXONOMY_BASE}#HR` },
  CY: { humanReadable: 'Cyprus', taxonomyUri: `${TAXONOMY_BASE}#CY` },
  CZ: { humanReadable: 'Czechia', taxonomyUri: `${TAXONOMY_BASE}#CZ` },
  DK: { humanReadable: 'Denmark', taxonomyUri: `${TAXONOMY_BASE}#DK` },
  EE: { humanReadable: 'Estonia', taxonomyUri: `${TAXONOMY_BASE}#EE` },
  FI: { humanReadable: 'Finland', taxonomyUri: `${TAXONOMY_BASE}#FI` },
  FR: { humanReadable: 'France', taxonomyUri: `${TAXONOMY_BASE}#FR` },
  DE: { humanReadable: 'Germany', taxonomyUri: `${TAXONOMY_BASE}#DE` },
  GR: { humanReadable: 'Greece', taxonomyUri: `${TAXONOMY_BASE}#GR` },
  HU: { humanReadable: 'Hungary', taxonomyUri: `${TAXONOMY_BASE}#HU` },
  IE: { humanReadable: 'Ireland', taxonomyUri: `${TAXONOMY_BASE}#IE` },
  IT: { humanReadable: 'Italy', taxonomyUri: `${TAXONOMY_BASE}#IT` },
  LV: { humanReadable: 'Latvia', taxonomyUri: `${TAXONOMY_BASE}#LV` },
  LT: { humanReadable: 'Lithuania', taxonomyUri: `${TAXONOMY_BASE}#LT` },
  LU: { humanReadable: 'Luxembourg', taxonomyUri: `${TAXONOMY_BASE}#LU` },
  MT: { humanReadable: 'Malta', taxonomyUri: `${TAXONOMY_BASE}#MT` },
  NL: { humanReadable: 'Netherlands', taxonomyUri: `${TAXONOMY_BASE}#NL` },
  PL: { humanReadable: 'Poland', taxonomyUri: `${TAXONOMY_BASE}#PL` },
  PT: { humanReadable: 'Portugal', taxonomyUri: `${TAXONOMY_BASE}#PT` },
  RO: { humanReadable: 'Romania', taxonomyUri: `${TAXONOMY_BASE}#RO` },
  SK: { humanReadable: 'Slovakia', taxonomyUri: `${TAXONOMY_BASE}#SK` },
  SI: { humanReadable: 'Slovenia', taxonomyUri: `${TAXONOMY_BASE}#SI` },
  ES: { humanReadable: 'Spain', taxonomyUri: `${TAXONOMY_BASE}#ES` },
  SE: { humanReadable: 'Sweden', taxonomyUri: `${TAXONOMY_BASE}#SE` },
};

/**
 * Person involved type (C.16b)
 */
export const PERSON_TYPE_ENUM: Record<string, EnumerationMapping> = {
  advisor: {
    humanReadable: 'Advisor',
    taxonomyUri: `${TAXONOMY_BASE}#Advisor`,
  },
  auditor: {
    humanReadable: 'Auditor',
    taxonomyUri: `${TAXONOMY_BASE}#Auditor`,
  },
  otherPerson: {
    humanReadable: 'Other person',
    taxonomyUri: `${TAXONOMY_BASE}#OtherPerson`,
  },
};

/**
 * Competent authority for credit institutions (A.20)
 */
export const COMPETENT_AUTHORITY_ENUM: Record<string, EnumerationMapping> = {
  ecb: {
    humanReadable: 'European Central Bank',
    taxonomyUri: `${TAXONOMY_BASE}#ECB`,
  },
  nca: {
    humanReadable: 'National Competent Authority',
    taxonomyUri: `${TAXONOMY_BASE}#NCA`,
  },
};

/**
 * All enumeration mappings indexed by XBRL element name
 */
export const ENUMERATION_MAPPINGS: Record<string, Record<string, EnumerationMapping>> = {
  'mica:PublicOfferingOrAdmissionToTrading': PUBLIC_OFFERING_ENUM,
  'mica:OfficialCurrencyDeterminingIssuePrice': CURRENCY_ENUM,
  'mica:TargetedHoldersForOtherToken': TARGETED_HOLDERS_ENUM,
  'mica:PlacementFormForOtherToken': PLACEMENT_FORM_ENUM,
  'mica:OtherTokenTypeOfWhitePaper': WHITE_PAPER_TYPE_ENUM,
  'mica:OtherTokenTypeOfSubmission': SUBMISSION_TYPE_ENUM,
  'mica:OtherTokenHomeMemberState': MEMBER_STATE_ENUM,
  'mica:OtherTokenHostMemberStates': MEMBER_STATE_ENUM,
  'mica:OfferorsRegisteredCountry': MEMBER_STATE_ENUM,
  'mica:OfferorsHeadOfficeCountry': MEMBER_STATE_ENUM,
  'mica:IssuersRegisteredCountry': MEMBER_STATE_ENUM,
  'mica:IssuersHeadOfficeCountry': MEMBER_STATE_ENUM,
  'mica:OperatorsRegisteredCountry': MEMBER_STATE_ENUM,
  'mica:OperatorsHeadOfficeCountry': MEMBER_STATE_ENUM,
  'mica:TypeOfPersonInvolvedInImplementationOfOtherToken': PERSON_TYPE_ENUM,
  'mica:CompetentAuthorityForCreditInstitutions': COMPETENT_AUTHORITY_ENUM,
  'mica:DomicileOfCompanyOfPersonInvolvedInImplementationOfOtherToken': MEMBER_STATE_ENUM,
  'mica:RedemptionCurrency': CURRENCY_ENUM,
};

/**
 * Get the taxonomy URI for an enumeration value
 */
export function getEnumerationUri(
  xbrlElement: string,
  valueKey: string
): string | undefined {
  const mapping = ENUMERATION_MAPPINGS[xbrlElement];
  return mapping?.[valueKey]?.taxonomyUri;
}

/**
 * Get the human-readable value for an enumeration key
 */
export function getEnumerationLabel(
  xbrlElement: string,
  valueKey: string
): string | undefined {
  const mapping = ENUMERATION_MAPPINGS[xbrlElement];
  return mapping?.[valueKey]?.humanReadable;
}

/**
 * Find an enumeration key by its human-readable value
 */
export function findEnumerationKey(
  xbrlElement: string,
  humanReadable: string
): string | undefined {
  const mapping = ENUMERATION_MAPPINGS[xbrlElement];
  if (!mapping) return undefined;

  const lowerSearch = humanReadable.toLowerCase();
  for (const [key, entry] of Object.entries(mapping)) {
    if (entry.humanReadable.toLowerCase() === lowerSearch) {
      return key;
    }
  }
  return undefined;
}
