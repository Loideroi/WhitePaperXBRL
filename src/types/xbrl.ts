import { z } from 'zod';

/**
 * LEI (Legal Entity Identifier) schema
 * Format: 20 alphanumeric characters
 */
export const LEISchema = z
  .string()
  .length(20)
  .regex(/^[A-Z0-9]{20}$/, 'LEI must be 20 uppercase alphanumeric characters');

export type LEI = z.infer<typeof LEISchema>;

/**
 * Token type classification
 */
export const TokenTypeSchema = z.enum(['OTHR', 'ART', 'EMT']);
export type TokenType = z.infer<typeof TokenTypeSchema>;

/**
 * XBRL Period - either instant or duration
 */
export const XBRLPeriodSchema = z.union([
  z.object({
    instant: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be yyyy-mm-dd format'),
  }),
  z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

export type XBRLPeriod = z.infer<typeof XBRLPeriodSchema>;

/**
 * XBRL Entity identification
 */
export const XBRLEntitySchema = z.object({
  identifier: LEISchema,
  scheme: z.literal('http://standards.iso.org/iso/17442'),
});

export type XBRLEntity = z.infer<typeof XBRLEntitySchema>;

/**
 * XBRL Context
 */
export const XBRLContextSchema = z.object({
  id: z.string(),
  entity: XBRLEntitySchema,
  period: XBRLPeriodSchema,
  scenario: z
    .object({
      explicitMember: z
        .object({
          dimension: z.string(),
          value: z.string(),
        })
        .optional(),
      typedMember: z
        .object({
          dimension: z.string(),
          value: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type XBRLContext = z.infer<typeof XBRLContextSchema>;

/**
 * XBRL Unit
 */
export const XBRLUnitSchema = z.object({
  id: z.string(),
  measure: z.string(),
});

export type XBRLUnit = z.infer<typeof XBRLUnitSchema>;

/**
 * XBRL Fact
 */
export const XBRLFactSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  contextRef: z.string(),
  unitRef: z.string().optional(),
  decimals: z.number().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  escape: z.boolean().optional(),
});

export type XBRLFact = z.infer<typeof XBRLFactSchema>;

/**
 * Complete iXBRL Document structure
 */
export interface IXBRLDocument {
  contexts: XBRLContext[];
  units: XBRLUnit[];
  facts: XBRLFact[];
  language: string;
  taxonomyRef: string;
}

/**
 * Validation severity levels
 */
export type ValidationSeverity = 'ERROR' | 'WARNING';

/**
 * Validation result
 */
export interface ValidationError {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  element?: string;
  fieldPath?: string;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalAssertions: number;
    passed: number;
    errors: number;
    warnings: number;
  };
}
