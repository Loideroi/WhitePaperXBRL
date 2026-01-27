/**
 * Field Mapper
 *
 * Maps extracted PDF content to XBRL taxonomy fields with confidence scoring.
 */

import type { WhitepaperData, ConfidenceLevel, MappedField } from '@/types/whitepaper';
import type { TokenType } from '@/types/taxonomy';
import {
  extractLEI,
  extractMonetaryValue,
  extractDate,
  extractNumber,
  extractTableRows,
  type PdfExtractionResult,
} from './extractor';

/**
 * Field mapping configuration
 */
interface FieldMappingConfig {
  /** Patterns to match field labels */
  patterns: (RegExp | string)[];
  /** Target path in WhitepaperData */
  targetPath: string;
  /** Transform function */
  transform?: (value: string) => unknown;
  /** Base confidence level */
  confidence: ConfidenceLevel;
  /** Which parts this field appears in */
  parts?: string[];
}

/**
 * Field mappings for common whitepaper fields
 */
const FIELD_MAPPINGS: FieldMappingConfig[] = [
  // Part A: Offeror Information
  {
    patterns: [/legal\s*name|company\s*name|entity\s*name|name\s*of\s*(?:the\s*)?offeror/i],
    targetPath: 'partA.legalName',
    confidence: 'high',
    parts: ['A', 'partA'],
  },
  {
    patterns: [/\blei\b|legal\s*entity\s*identifier/i],
    targetPath: 'partA.lei',
    transform: (v) => {
      const lei = extractLEI(v);
      return lei?.value || v.replace(/\s/g, '').toUpperCase();
    },
    confidence: 'high',
    parts: ['A', 'partA'],
  },
  {
    patterns: [/registered\s*address|business\s*address|address\s*of/i],
    targetPath: 'partA.registeredAddress',
    confidence: 'medium',
    parts: ['A', 'partA'],
  },
  {
    patterns: [/country|jurisdiction|home\s*member\s*state/i],
    targetPath: 'partA.country',
    transform: (v) => extractCountryCode(v),
    confidence: 'medium',
    parts: ['A', 'partA'],
  },
  {
    patterns: [/website|url|web\s*address/i],
    targetPath: 'partA.website',
    transform: extractUrl,
    confidence: 'high',
    parts: ['A', 'partA'],
  },
  {
    patterns: [/e-?mail|email\s*address|contact\s*email/i],
    targetPath: 'partA.contactEmail',
    transform: extractEmail,
    confidence: 'high',
    parts: ['A', 'partA'],
  },

  // Part D: Project Information
  {
    patterns: [/crypto[\s-]*asset\s*name|token\s*name|name\s*of\s*(?:the\s*)?crypto/i],
    targetPath: 'partD.cryptoAssetName',
    confidence: 'high',
    parts: ['D', 'partD'],
  },
  {
    patterns: [/ticker|symbol|abbreviation/i],
    targetPath: 'partD.cryptoAssetSymbol',
    transform: (v) => v.replace(/[$]/g, '').toUpperCase().trim(),
    confidence: 'high',
    parts: ['D', 'partD'],
  },
  {
    patterns: [/total\s*supply|maximum\s*supply|token\s*supply/i],
    targetPath: 'partD.totalSupply',
    transform: (v) => {
      const num = extractNumber(v);
      return num?.value || parseInt(v.replace(/[^\d]/g, ''), 10);
    },
    confidence: 'high',
    parts: ['D', 'partD'],
  },
  {
    patterns: [/token\s*standard|protocol|standard/i],
    targetPath: 'partD.tokenStandard',
    confidence: 'medium',
    parts: ['D', 'partD'],
  },
  {
    patterns: [/blockchain|network|chain|distributed\s*ledger/i],
    targetPath: 'partD.blockchainNetwork',
    confidence: 'medium',
    parts: ['D', 'partD'],
  },
  {
    patterns: [/consensus\s*mechanism|consensus\s*algorithm/i],
    targetPath: 'partD.consensusMechanism',
    confidence: 'high',
    parts: ['D', 'partD', 'H', 'partH'],
  },
  {
    patterns: [/project\s*description|description\s*of\s*(?:the\s*)?project/i],
    targetPath: 'partD.projectDescription',
    confidence: 'medium',
    parts: ['D', 'partD'],
  },

  // Part E: Offering Details
  {
    patterns: [/public\s*offering|offer\s*to\s*(?:the\s*)?public/i],
    targetPath: 'partE.isPublicOffering',
    transform: (v) => /yes|true|public/i.test(v),
    confidence: 'high',
    parts: ['E', 'partE'],
  },
  {
    patterns: [/offering\s*start|subscription\s*(?:period\s*)?start|start\s*date/i],
    targetPath: 'partE.publicOfferingStartDate',
    transform: (v) => extractDate(v)?.date || v,
    confidence: 'medium',
    parts: ['E', 'partE'],
  },
  {
    patterns: [/offering\s*end|subscription\s*(?:period\s*)?end|end\s*date/i],
    targetPath: 'partE.publicOfferingEndDate',
    transform: (v) => extractDate(v)?.date || v,
    confidence: 'medium',
    parts: ['E', 'partE'],
  },
  {
    patterns: [/token\s*price|price\s*per\s*token|issue\s*price/i],
    targetPath: 'partE.tokenPrice',
    transform: (v) => extractMonetaryValue(v)?.amount || parseFloat(v.replace(/[^\d.]/g, '')),
    confidence: 'high',
    parts: ['E', 'partE'],
  },
  {
    patterns: [/maximum\s*(?:subscription\s*)?goal|subscription\s*goal|funding\s*goal/i],
    targetPath: 'partE.maxSubscriptionGoal',
    transform: (v) => extractMonetaryValue(v)?.amount || parseFloat(v.replace(/[^\d.]/g, '')),
    confidence: 'medium',
    parts: ['E', 'partE'],
  },
  {
    patterns: [/withdrawal\s*rights?|right\s*(?:of|to)\s*withdraw/i],
    targetPath: 'partE.withdrawalRights',
    transform: (v) => /yes|true|entitled|right/i.test(v),
    confidence: 'high',
    parts: ['E', 'partE'],
  },

  // Part H: Technology
  {
    patterns: [/blockchain\s*(?:platform\s*)?description|technology\s*description/i],
    targetPath: 'partH.blockchainDescription',
    confidence: 'medium',
    parts: ['H', 'partH'],
  },
  {
    patterns: [/smart\s*contract|contract\s*address/i],
    targetPath: 'partH.smartContractInfo',
    confidence: 'medium',
    parts: ['H', 'partH'],
  },
  {
    patterns: [/security\s*audit|audit(?:ed)?\s*by/i],
    targetPath: 'partH.securityAudits',
    transform: (v) => [v],
    confidence: 'medium',
    parts: ['H', 'partH'],
  },

  // Part J: Sustainability
  {
    patterns: [/energy\s*consumption|power\s*consumption/i],
    targetPath: 'partJ.energyConsumption',
    transform: (v) => {
      const num = extractNumber(v);
      return num?.value;
    },
    confidence: 'high',
    parts: ['J', 'partJ'],
  },
];

/**
 * Extract country code from text
 */
function extractCountryCode(text: string): string {
  // Common country name to code mappings
  const countryMap: Record<string, string> = {
    switzerland: 'CH',
    malta: 'MT',
    germany: 'DE',
    france: 'FR',
    ireland: 'IE',
    netherlands: 'NL',
    luxembourg: 'LU',
    austria: 'AT',
    belgium: 'BE',
    spain: 'ES',
    italy: 'IT',
    portugal: 'PT',
    poland: 'PL',
    'united kingdom': 'GB',
    uk: 'GB',
    'united states': 'US',
    usa: 'US',
  };

  const lowerText = text.toLowerCase();

  for (const [name, code] of Object.entries(countryMap)) {
    if (lowerText.includes(name)) {
      return code;
    }
  }

  // Check if it's already a 2-letter code
  const codeMatch = text.match(/\b([A-Z]{2})\b/);
  if (codeMatch) {
    return codeMatch[1] || text;
  }

  return text;
}

/**
 * Extract URL from text
 */
function extractUrl(text: string): string | undefined {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
  const match = text.match(urlPattern);
  return match ? match[0] : undefined;
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | undefined {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailPattern);
  return match ? match[0] : undefined;
}

/**
 * Check if text matches any pattern in the list
 */
function matchesPatterns(text: string, patterns: (RegExp | string)[]): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(text);
  });
}

/**
 * Set nested object value by path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part && !(part in current)) {
      current[part] = {};
    }
    if (part) {
      current = current[part] as Record<string, unknown>;
    }
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    current[lastPart] = value;
  }
}

/**
 * Map extraction result to whitepaper fields
 */
export interface MappingResult {
  /** Partially filled whitepaper data */
  data: Partial<WhitepaperData>;
  /** Mapping details */
  mappings: MappedField[];
  /** Confidence summary */
  confidence: {
    overall: number;
    bySection: Record<string, number>;
    lowConfidenceFields: string[];
  };
}

/**
 * Map extracted PDF content to whitepaper fields
 */
export function mapPdfToWhitepaper(
  extraction: PdfExtractionResult,
  tokenType?: TokenType
): MappingResult {
  const data: Record<string, unknown> = {};
  const mappings: MappedField[] = [];
  const confidenceScores: Record<string, number[]> = {};

  // Process each section
  for (const [sectionName, sectionContent] of extraction.sections) {
    // Extract table rows from section
    const rows = extractTableRows(sectionContent);

    // Map table rows
    for (const row of rows) {
      for (const mapping of FIELD_MAPPINGS) {
        // Check if this mapping applies to this section
        if (mapping.parts && !mapping.parts.some((p) => sectionName.includes(p))) {
          continue;
        }

        if (matchesPatterns(row.field, mapping.patterns)) {
          const value = mapping.transform ? mapping.transform(row.content) : row.content;

          if (value !== undefined && value !== null && value !== '') {
            setNestedValue(data, mapping.targetPath, value);

            const confidenceValue =
              mapping.confidence === 'high' ? 0.9 : mapping.confidence === 'medium' ? 0.7 : 0.5;

            mappings.push({
              path: mapping.targetPath,
              value,
              source: `${sectionName}: ${row.field}`,
              confidence: mapping.confidence,
            });

            // Track confidence by section
            const section = mapping.targetPath.split('.')[0] || 'unknown';
            if (!confidenceScores[section]) {
              confidenceScores[section] = [];
            }
            confidenceScores[section].push(confidenceValue);
          }
        }
      }
    }

    // Also try to extract from raw section content for fields not in tables
    for (const mapping of FIELD_MAPPINGS) {
      // Skip if already mapped
      const existingMapping = mappings.find((m) => m.path === mapping.targetPath);
      if (existingMapping) continue;

      // Check if this mapping applies to this section
      if (mapping.parts && !mapping.parts.some((p) => sectionName.includes(p))) {
        continue;
      }

      // Try to find field label in content
      for (const pattern of mapping.patterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        const match = sectionContent.match(regex);

        if (match) {
          // Try to extract value after the match
          const afterMatch = sectionContent.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 500);
          const lines = afterMatch.split('\n').filter((l) => l.trim());

          if (lines.length > 0 && lines[0]) {
            const rawValue = lines[0].trim();
            const value = mapping.transform ? mapping.transform(rawValue) : rawValue;

            if (value !== undefined && value !== null && value !== '') {
              setNestedValue(data, mapping.targetPath, value);

              // Lower confidence for non-table extraction
              const baseConfidence =
                mapping.confidence === 'high' ? 0.9 : mapping.confidence === 'medium' ? 0.7 : 0.5;
              const adjustedConfidence = baseConfidence * 0.8;

              mappings.push({
                path: mapping.targetPath,
                value,
                source: `${sectionName}: pattern match`,
                confidence: adjustedConfidence < 0.6 ? 'low' : mapping.confidence,
              });

              const section = mapping.targetPath.split('.')[0] || 'unknown';
              if (!confidenceScores[section]) {
                confidenceScores[section] = [];
              }
              confidenceScores[section].push(adjustedConfidence);
            }
          }
        }
      }
    }
  }

  // Calculate confidence summary
  const bySection: Record<string, number> = {};
  let totalScore = 0;
  let totalCount = 0;

  for (const [section, scores] of Object.entries(confidenceScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    bySection[section] = Math.round(avg * 100);
    totalScore += avg * scores.length;
    totalCount += scores.length;
  }

  const overall = totalCount > 0 ? Math.round((totalScore / totalCount) * 100) : 0;

  const lowConfidenceFields = mappings
    .filter((m) => m.confidence === 'low')
    .map((m) => m.path);

  // Set token type and defaults
  if (tokenType) {
    data.tokenType = tokenType;
  }
  data.language = 'en';
  data.documentDate = new Date().toISOString().split('T')[0];

  return {
    data: data as Partial<WhitepaperData>,
    mappings,
    confidence: {
      overall,
      bySection,
      lowConfidenceFields,
    },
  };
}
