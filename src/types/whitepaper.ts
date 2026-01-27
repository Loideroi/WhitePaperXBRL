import { z } from 'zod';
import { LEISchema, TokenTypeSchema } from './xbrl';

/**
 * Management body member
 */
export const ManagementBodyMemberSchema = z.object({
  identity: z.string().min(1, 'Name is required'),
  businessAddress: z.string().min(1, 'Address is required'),
  function: z.string().min(1, 'Function/role is required'),
});

export type ManagementBodyMember = z.infer<typeof ManagementBodyMemberSchema>;

/**
 * Part A: Offeror Information
 */
export const PartASchema = z.object({
  legalName: z.string().min(1, 'Legal name is required'),
  lei: LEISchema,
  registeredAddress: z.string().min(1, 'Registered address is required'),
  country: z.string().length(2, 'Country must be ISO 3166-1 alpha-2 code'),
  website: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
});

export type PartA = z.infer<typeof PartASchema>;

/**
 * Part B: Issuer Information (if different from offeror)
 */
export const PartBSchema = z
  .object({
    legalName: z.string().min(1),
    lei: LEISchema,
    registeredAddress: z.string().min(1),
    country: z.string().length(2),
  })
  .optional();

export type PartB = z.infer<typeof PartBSchema>;

/**
 * Part C: Trading Platform Operator (if applicable)
 */
export const PartCSchema = z
  .object({
    legalName: z.string().min(1),
    lei: LEISchema,
    registeredAddress: z.string().min(1),
    country: z.string().length(2),
  })
  .optional();

export type PartC = z.infer<typeof PartCSchema>;

/**
 * Part D: Project Information
 */
export const PartDSchema = z.object({
  cryptoAssetName: z.string().min(1, 'Crypto-asset name is required'),
  cryptoAssetSymbol: z.string().min(1, 'Symbol is required'),
  totalSupply: z.number().positive('Total supply must be positive'),
  tokenStandard: z.string().optional(),
  blockchainNetwork: z.string().optional(),
  consensusMechanism: z.string().optional(),
  projectDescription: z.string().min(10, 'Project description is required'),
});

export type PartD = z.infer<typeof PartDSchema>;

/**
 * Part E: Offering Details
 */
export const PartESchema = z.object({
  isPublicOffering: z.boolean(),
  publicOfferingStartDate: z.string().optional(),
  publicOfferingEndDate: z.string().optional(),
  tokenPrice: z.number().positive().optional(),
  tokenPriceCurrency: z.string().optional(),
  maxSubscriptionGoal: z.number().positive().optional(),
  distributionDate: z.string().optional(),
  withdrawalRights: z.boolean().optional(),
  paymentMethods: z.array(z.string()).optional(),
});

export type PartE = z.infer<typeof PartESchema>;

/**
 * Part F: Crypto-Asset Characteristics
 */
export const PartFSchema = z.object({
  classification: z.string().min(1, 'Classification is required'),
  rightsDescription: z.string().min(1, 'Rights description is required'),
  technicalSpecifications: z.string().optional(),
});

export type PartF = z.infer<typeof PartFSchema>;

/**
 * Part G: Rights and Obligations
 */
export const PartGSchema = z.object({
  purchaseRights: z.string().optional(),
  ownershipRights: z.string().optional(),
  transferRestrictions: z.string().optional(),
  lockUpPeriod: z.string().optional(),
  dynamicSupplyMechanism: z.string().optional(),
});

export type PartG = z.infer<typeof PartGSchema>;

/**
 * Part H: Underlying Technology
 */
export const PartHSchema = z.object({
  blockchainDescription: z.string().min(1, 'Blockchain description is required'),
  smartContractInfo: z.string().optional(),
  securityAudits: z.array(z.string()).optional(),
  technicalCapacity: z.string().optional(),
});

export type PartH = z.infer<typeof PartHSchema>;

/**
 * Part I: Risk Factors
 */
export const PartISchema = z.object({
  offerRisks: z.array(z.string()).min(1, 'At least one offer risk is required'),
  issuerRisks: z.array(z.string()).min(1, 'At least one issuer risk is required'),
  marketRisks: z.array(z.string()).min(1, 'At least one market risk is required'),
  technologyRisks: z.array(z.string()).min(1, 'At least one technology risk is required'),
  regulatoryRisks: z.array(z.string()).min(1, 'At least one regulatory risk is required'),
});

export type PartI = z.infer<typeof PartISchema>;

/**
 * Part J: Sustainability Indicators
 */
export const PartJSchema = z.object({
  energyConsumption: z.number().optional(),
  energyUnit: z.literal('kWh').optional(),
  consensusMechanismType: z.string().optional(),
  renewableEnergyPercentage: z.number().min(0).max(100).optional(),
  ghgEmissions: z.number().optional(),
});

export type PartJ = z.infer<typeof PartJSchema>;

/**
 * Complete Whitepaper Data
 */
export const WhitepaperDataSchema = z.object({
  tokenType: TokenTypeSchema,
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.string().length(2),

  partA: PartASchema,
  partB: PartBSchema,
  partC: PartCSchema,
  partD: PartDSchema,
  partE: PartESchema,
  partF: PartFSchema,
  partG: PartGSchema,
  partH: PartHSchema,
  partI: PartISchema,
  partJ: PartJSchema,

  managementBodyMembers: z
    .object({
      offeror: z.array(ManagementBodyMemberSchema).optional(),
      issuer: z.array(ManagementBodyMemberSchema).optional(),
      operator: z.array(ManagementBodyMemberSchema).optional(),
    })
    .optional(),

  projectPersons: z
    .array(
      z.object({
        identity: z.string(),
        businessAddress: z.string(),
        role: z.string(),
      })
    )
    .optional(),
});

export type WhitepaperData = z.infer<typeof WhitepaperDataSchema>;

/**
 * Extraction confidence levels
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Mapped field with extraction metadata
 */
export interface MappedField {
  path: string;
  value: unknown;
  source: string;
  confidence: ConfidenceLevel;
}

/**
 * Extraction result with confidence scoring
 */
export interface ExtractionResult {
  data: Partial<WhitepaperData>;
  mappings: MappedField[];
  confidence: {
    overall: number;
    bySection: Record<string, number>;
    lowConfidenceFields: string[];
  };
}
