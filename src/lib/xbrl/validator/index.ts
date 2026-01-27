/**
 * XBRL Validator exports
 */

// LEI Validator
export {
  isValidLEIFormat,
  validateLEIChecksum,
  validateLEI,
  validateAllLEIs,
  validateLEIWithGLEIF,
} from './lei-validator';
export type { LEIValidationResult } from './lei-validator';

// Existence Engine
export {
  validateExistenceAssertions,
  getExistenceAssertions,
  getAssertionSummary,
} from './existence-engine';
export type { ExistenceAssertion } from './existence-engine';

// Value Engine
export {
  validateValueAssertions,
  getValueAssertions,
  getValueAssertionSummary,
} from './value-engine';
export type { ValueAssertion } from './value-engine';

// Orchestrator
export {
  validateWhitepaper,
  quickValidate,
  validateField,
  getValidationRequirements,
} from './orchestrator';
export type { ValidationOptions, DetailedValidationResult } from './orchestrator';
