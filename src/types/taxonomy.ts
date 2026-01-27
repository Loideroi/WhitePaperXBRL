import { z } from 'zod';

/**
 * XBRL Data Types supported by the MiCA taxonomy
 */
export const XBRLDataTypeSchema = z.enum([
  // Base XBRL types
  'stringItemType',
  'booleanItemType',
  'dateItemType',
  'monetaryItemType',
  'decimalItemType',
  'integerItemType',
  // DTR types
  'textBlockItemType',
  'percentItemType',
  'energyItemType',
  'ghgEmissionsItemType',
  'massItemType',
  'volumeItemType',
  // Enumeration types
  'enumerationItemType',
  'enumerationSetItemType',
  // LEI type
  'leiItemType',
  // Domain type
  'domainItemType',
]);

export type XBRLDataType = z.infer<typeof XBRLDataTypeSchema>;

/**
 * Period type for XBRL elements
 */
export const PeriodTypeSchema = z.enum(['instant', 'duration']);
export type PeriodType = z.infer<typeof PeriodTypeSchema>;

/**
 * Token type for entry point selection
 */
export const TokenTypeSchema = z.enum(['OTHR', 'ART', 'EMT']);
export type TokenType = z.infer<typeof TokenTypeSchema>;

/**
 * Whitepaper parts (A-J)
 */
export const WhitepaperPartSchema = z.enum([
  'A', // Offeror
  'B', // Issuer
  'C', // Trading Platform Operator
  'D', // Project Information
  'E', // Offering Details
  'F', // Crypto-Asset Characteristics
  'G', // Rights and Obligations
  'H', // Underlying Technology
  'I', // Risk Factors
  'J', // Sustainability
]);

export type WhitepaperPart = z.infer<typeof WhitepaperPartSchema>;

/**
 * Taxonomy element - a single reportable or abstract element
 */
export interface TaxonomyElement {
  /** Unique element name (e.g., 'mica:OfferorLegalEntityIdentifier') */
  name: string;
  /** Local name without namespace prefix */
  localName: string;
  /** Namespace prefix (typically 'mica') */
  prefix: string;
  /** Human-readable label */
  label: string;
  /** Extended documentation/description */
  documentation?: string;
  /** XBRL data type */
  dataType: XBRLDataType;
  /** Period type (instant or duration) */
  periodType: PeriodType;
  /** Whether this is an abstract element (not taggable) */
  abstract: boolean;
  /** Whether this element is nillable */
  nillable: boolean;
  /** Substitution group */
  substitutionGroup?: string;
  /** Which whitepaper part this belongs to */
  part?: WhitepaperPart;
  /** Which token types this element applies to */
  tokenTypes: TokenType[];
  /** Display order within its section */
  order: number;
  /** Whether this field is required */
  required: boolean;
  /** Parent element name (for hierarchy) */
  parent?: string;
  /** For enumeration types, the domain reference */
  enumDomain?: string;
}

/**
 * Taxonomy table (hypercube) definition
 */
export interface TaxonomyTable {
  /** Table identifier (e.g., 'table2', 'table2a') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the table's purpose */
  description: string;
  /** Token type this table belongs to */
  tokenType: TokenType;
  /** Elements included in this table */
  elements: string[];
  /** Extended link role URI */
  linkRole: string;
  /** Whether this is a sub-table (e.g., table2a, table2b) */
  isSubTable: boolean;
  /** Parent table ID if this is a sub-table */
  parentTable?: string;
}

/**
 * Enumeration option (domain member)
 */
export interface EnumerationOption {
  /** Member value/code */
  value: string;
  /** Human-readable label */
  label: string;
  /** Extended description */
  description?: string;
  /** Display order */
  order: number;
}

/**
 * Enumeration domain definition
 */
export interface EnumerationDomain {
  /** Domain identifier */
  id: string;
  /** Domain name */
  name: string;
  /** Available options */
  options: EnumerationOption[];
  /** Whether multiple selections are allowed */
  multiSelect: boolean;
}

/**
 * Typed dimension definition (for repeating groups like management body members)
 */
export interface TypedDimension {
  /** Dimension identifier */
  id: string;
  /** Dimension name */
  name: string;
  /** Axis element name */
  axis: string;
  /** Elements that can be reported along this dimension */
  elements: string[];
  /** Description */
  description: string;
}

/**
 * Label types in the taxonomy
 */
export const LabelRoleSchema = z.enum([
  'label',
  'terseLabel',
  'verboseLabel',
  'documentation',
]);

export type LabelRole = z.infer<typeof LabelRoleSchema>;

/**
 * Label entry with language support
 */
export interface TaxonomyLabel {
  /** Element name this label belongs to */
  elementName: string;
  /** Label role */
  role: LabelRole;
  /** Language code (ISO 639-1) */
  language: string;
  /** The label text */
  text: string;
}

/**
 * Complete taxonomy package
 */
export interface TaxonomyPackage {
  /** Package version */
  version: string;
  /** Publication date */
  publicationDate: string;
  /** Namespace URI */
  namespace: string;
  /** All elements */
  elements: Map<string, TaxonomyElement>;
  /** All tables */
  tables: Map<string, TaxonomyTable>;
  /** All enumeration domains */
  enumerations: Map<string, EnumerationDomain>;
  /** All typed dimensions */
  typedDimensions: Map<string, TypedDimension>;
  /** Labels by language */
  labels: Map<string, Map<string, TaxonomyLabel>>;
}

/**
 * Bundled taxonomy data (JSON serializable)
 */
export interface BundledTaxonomyData {
  version: string;
  publicationDate: string;
  namespace: string;
  elements: TaxonomyElement[];
  tables: TaxonomyTable[];
  enumerations: EnumerationDomain[];
  typedDimensions: TypedDimension[];
  labels: {
    language: string;
    entries: Omit<TaxonomyLabel, 'language'>[];
  }[];
}

/**
 * Entry point configuration
 */
export interface EntryPoint {
  /** Entry point identifier */
  id: string;
  /** Token type */
  tokenType: TokenType;
  /** Schema file name */
  schemaFile: string;
  /** Tables included */
  tables: string[];
  /** Total assertion count */
  assertionCount: {
    existence: number;
    value: number;
  };
}

/**
 * Predefined entry points for MiCA taxonomy
 */
export const ENTRY_POINTS: EntryPoint[] = [
  {
    id: 'table2',
    tokenType: 'OTHR',
    schemaFile: 'mica_entry_table_2.xsd',
    tables: ['table2', 'table2a', 'table2b', 'table2c', 'table2d'],
    assertionCount: { existence: 72, value: 139 },
  },
  {
    id: 'table3',
    tokenType: 'ART',
    schemaFile: 'mica_entry_table_3.xsd',
    tables: ['table3', 'table3a', 'table3b', 'table3c'],
    assertionCount: { existence: 103, value: 62 },
  },
  {
    id: 'table4',
    tokenType: 'EMT',
    schemaFile: 'mica_entry_table_4.xsd',
    tables: ['table4', 'table4a', 'table4b'],
    assertionCount: { existence: 82, value: 22 },
  },
];

/**
 * Get entry point by token type
 */
export function getEntryPoint(tokenType: TokenType): EntryPoint {
  const entry = ENTRY_POINTS.find((e) => e.tokenType === tokenType);
  if (!entry) {
    throw new Error(`Unknown token type: ${tokenType}`);
  }
  return entry;
}

/**
 * MiCA Taxonomy constants
 */
export const MICA_TAXONOMY = {
  VERSION: '2025-03-31',
  NAMESPACE: 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
  PREFIX: 'mica',
  ENTRY_POINT_BASE: 'https://www.esma.europa.eu/taxonomy/2025-03-31/mica/',
} as const;

/**
 * Supported languages for labels
 */
export const SUPPORTED_LANGUAGES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr',
  'ga', 'hr', 'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt',
  'ro', 'sk', 'sl', 'sv',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
