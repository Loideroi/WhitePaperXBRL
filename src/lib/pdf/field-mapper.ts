/**
 * Field Mapper
 *
 * Maps extracted PDF content to XBRL taxonomy fields with confidence scoring.
 * Optimized for ESMA MiCA whitepaper format with numbered sections (A.1, D.4, E.28, etc.)
 */

import type { WhitepaperData, ConfidenceLevel, MappedField } from '@/types/whitepaper';
import type { TokenType } from '@/types/taxonomy';
import {
  extractLEI,
  extractMonetaryValue,
  extractDate,
  extractNumber,
  type PdfExtractionResult,
} from './extractor';

/**
 * MiCA Section number to field mapping
 */
interface MiCASectionMapping {
  /** Section numbers (e.g., "A.1", "A.2") */
  sectionNumbers: string[];
  /** Alternative patterns for the field */
  patterns: RegExp[];
  /** Target path in WhitepaperData */
  targetPath: string;
  /** Transform function */
  transform?: (value: string, fullText: string) => unknown;
  /** Base confidence level */
  confidence: ConfidenceLevel;
  /** Whether to capture multiple lines */
  multiLine?: boolean;
}

/**
 * MiCA whitepaper section mappings
 * Based on ESMA MiCA Implementing Regulation structure
 */
const MICA_SECTION_MAPPINGS: MiCASectionMapping[] = [
  // Part A: Offeror Information
  {
    sectionNumbers: ['A.1', 'A.2'],
    patterns: [/legal\s*name|name\s*of\s*(?:the\s*)?offeror|company\s*name/i],
    targetPath: 'partA.legalName',
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.3', 'A.4'],
    patterns: [/\bLEI\b|legal\s*entity\s*identifier/i],
    targetPath: 'partA.lei',
    transform: extractLEIValue,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.5', 'A.6', 'A.7'],
    patterns: [/registered\s*(?:office\s*)?address|business\s*address/i],
    targetPath: 'partA.registeredAddress',
    multiLine: true,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.8', 'A.9'],
    patterns: [/country|jurisdiction|member\s*state/i],
    targetPath: 'partA.country',
    transform: extractCountryCode,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['A.10', 'A.11'],
    patterns: [/website|web\s*address|url/i],
    targetPath: 'partA.website',
    transform: extractUrl,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.12', 'A.13'],
    patterns: [/e-?mail|contact.*email/i],
    targetPath: 'partA.contactEmail',
    transform: extractEmail,
    confidence: 'high',
  },

  // Part D: Crypto-asset Project Information
  {
    sectionNumbers: ['D.1', 'D.2', 'D.3'],
    patterns: [/name\s*of\s*(?:the\s*)?crypto|crypto[\s-]*asset\s*name|token\s*name/i],
    targetPath: 'partD.cryptoAssetName',
    confidence: 'high',
  },
  {
    sectionNumbers: ['D.3', 'D.4'],
    patterns: [/ticker|symbol|abbreviation/i],
    targetPath: 'partD.cryptoAssetSymbol',
    transform: (v) => v.replace(/[$]/g, '').replace(/[^\w]/g, '').toUpperCase().slice(0, 10),
    confidence: 'high',
  },
  {
    sectionNumbers: ['D.4', 'D.5'],
    patterns: [/description\s*of\s*(?:the\s*)?(?:crypto|project)|project\s*description/i],
    targetPath: 'partD.projectDescription',
    multiLine: true,
    confidence: 'medium',
  },

  // Part F: Token characteristics
  {
    sectionNumbers: ['F.1', 'F.2'],
    patterns: [/token\s*standard|protocol\s*standard|technical\s*standard/i],
    targetPath: 'partD.tokenStandard',
    confidence: 'high',
  },
  {
    sectionNumbers: ['F.5', 'F.6'],
    patterns: [/total\s*(?:token\s*)?supply|maximum\s*supply|supply\s*cap/i],
    targetPath: 'partD.totalSupply',
    transform: extractTotalSupply,
    confidence: 'high',
  },

  // Part E: Offering Details
  {
    sectionNumbers: ['E.1', 'E.2', 'E.3'],
    patterns: [/public\s*offer|offer\s*to\s*(?:the\s*)?public/i],
    targetPath: 'partE.isPublicOffering',
    transform: (v) => {
      // Check if it's explicitly stating public offer
      return /yes|public\s*offer|offer\s*to\s*(?:the\s*)?public/i.test(v);
    },
    confidence: 'high',
  },
  {
    sectionNumbers: ['E.25', 'E.26', 'E.27'],
    patterns: [/start\s*(?:date|of)|subscription\s*(?:period\s*)?(?:start|begin)|opens?\s*on/i],
    targetPath: 'partE.publicOfferingStartDate',
    transform: extractDateValue,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.28', 'E.29', 'E.30'],
    patterns: [/end\s*(?:date|of)|subscription\s*(?:period\s*)?end|closes?\s*on|close\s*date/i],
    targetPath: 'partE.publicOfferingEndDate',
    transform: extractDateValue,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.8', 'E.9', 'E.10'],
    patterns: [/token\s*price|price\s*per\s*(?:token|unit)|issue\s*price|offering\s*price/i],
    targetPath: 'partE.tokenPrice',
    transform: (v) => {
      const monetary = extractMonetaryValue(v);
      return monetary?.amount || parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
    },
    confidence: 'high',
  },
  {
    sectionNumbers: ['E.9', 'E.12', 'E.13'],
    patterns: [/maximum\s*(?:amount|subscription|tokens?\s*offered)|subscription\s*goal|funding\s*(?:goal|target)/i],
    targetPath: 'partE.maxSubscriptionGoal',
    transform: (v) => {
      const monetary = extractMonetaryValue(v);
      return monetary?.amount || parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
    },
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.20', 'E.21', 'E.22'],
    patterns: [/withdrawal\s*right|right\s*(?:of|to)\s*withdraw/i],
    targetPath: 'partE.withdrawalRights',
    transform: (v) => /yes|entitled|right|can\s*withdraw|14\s*(?:calendar\s*)?days?/i.test(v),
    confidence: 'high',
  },

  // Part H: Technology
  {
    sectionNumbers: ['H.1', 'H.2', 'H.3'],
    patterns: [/consensus\s*mechanism|consensus\s*(?:algorithm|protocol)/i],
    targetPath: 'partD.consensusMechanism',
    confidence: 'high',
  },
  {
    sectionNumbers: ['H.1', 'H.2'],
    patterns: [/blockchain|distributed\s*ledger|DLT|network/i],
    targetPath: 'partD.blockchainNetwork',
    confidence: 'medium',
  },
  {
    sectionNumbers: ['H.3', 'H.4', 'H.5'],
    patterns: [/blockchain\s*description|technology\s*(?:description|overview)/i],
    targetPath: 'partH.blockchainDescription',
    multiLine: true,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['H.6', 'H.7', 'H.8'],
    patterns: [/smart\s*contract|contract\s*address/i],
    targetPath: 'partH.smartContractInfo',
    multiLine: true,
    confidence: 'medium',
  },

  // Part H: Security Audits
  {
    sectionNumbers: ['H.9', 'H.10'],
    patterns: [/security\s*audit|audited\s*by|audit\s*report/i],
    targetPath: 'partH.securityAudits',
    transform: (v) => [v], // Return as array
    confidence: 'medium',
  },

  // Part J: Sustainability
  {
    sectionNumbers: ['J.1', 'J.2', 'J.3'],
    patterns: [/energy\s*consumption|power\s*(?:consumption|usage)|kWh/i],
    targetPath: 'partJ.energyConsumption',
    transform: (v) => {
      const num = extractNumber(v);
      return num?.value;
    },
    confidence: 'high',
  },
  {
    sectionNumbers: ['J.1', 'J.2'],
    patterns: [/consensus\s*mechanism\s*type|type\s*of\s*consensus/i],
    targetPath: 'partJ.consensusMechanismType',
    confidence: 'medium',
  },
  {
    sectionNumbers: ['J.4', 'J.5'],
    patterns: [/renewable\s*energy|green\s*energy/i],
    targetPath: 'partJ.renewableEnergyPercentage',
    transform: (v) => {
      const match = v.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match?.[1]) return parseFloat(match[1]);
      const num = extractNumber(v);
      return num?.value;
    },
    confidence: 'medium',
  },
];

/**
 * Extract LEI value
 */
function extractLEIValue(text: string): string {
  // First try standard LEI (20 alphanumeric)
  const lei = extractLEI(text);
  if (lei?.value) return lei.value;

  // Try Swiss UID format (CHE-XXX.XXX.XXX)
  const uidMatch = text.match(/CHE[-\s]?\d{3}\.?\d{3}\.?\d{3}/i);
  if (uidMatch) return uidMatch[0].toUpperCase();

  // Clean up any found identifier
  const cleanedText = text.replace(/\s/g, '').toUpperCase();
  if (/^[A-Z0-9]{15,25}$/.test(cleanedText)) {
    return cleanedText;
  }

  return text.trim();
}

/**
 * Extract country code from text
 */
function extractCountryCode(text: string): string {
  const countryMap: Record<string, string> = {
    switzerland: 'CH',
    swiss: 'CH',
    malta: 'MT',
    germany: 'DE',
    german: 'DE',
    france: 'FR',
    french: 'FR',
    ireland: 'IE',
    irish: 'IE',
    netherlands: 'NL',
    dutch: 'NL',
    luxembourg: 'LU',
    austria: 'AT',
    austrian: 'AT',
    belgium: 'BE',
    belgian: 'BE',
    spain: 'ES',
    spanish: 'ES',
    italy: 'IT',
    italian: 'IT',
    portugal: 'PT',
    portuguese: 'PT',
    poland: 'PL',
    polish: 'PL',
    'united kingdom': 'GB',
    uk: 'GB',
    british: 'GB',
    'united states': 'US',
    usa: 'US',
    american: 'US',
    singapore: 'SG',
    indonesia: 'ID',
    indonesian: 'ID',
    zug: 'CH', // Zug is in Switzerland
  };

  const lowerText = text.toLowerCase();

  for (const [name, code] of Object.entries(countryMap)) {
    if (lowerText.includes(name)) {
      return code;
    }
  }

  // Check for 2-letter code
  const codeMatch = text.match(/\b([A-Z]{2})\b/);
  if (codeMatch?.[1]) {
    return codeMatch[1];
  }

  return text.slice(0, 2).toUpperCase();
}

/**
 * Extract URL from text
 */
function extractUrl(text: string): string | undefined {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
  const match = text.match(urlPattern);
  if (match) return match[0];

  // Try to find domain-like patterns
  const domainMatch = text.match(/(?:www\.)?[a-z0-9-]+(?:\.[a-z]{2,})+/i);
  if (domainMatch) return `https://${domainMatch[0]}`;

  return undefined;
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | undefined {
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailPattern);
  return match ? match[0].toLowerCase() : undefined;
}

/**
 * Extract date value in ISO format
 */
function extractDateValue(text: string): string | undefined {
  // Try ISO format first
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Try "December 17, 2025" format
  const monthNameMatch = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthNameMatch) {
    const date = new Date(monthNameMatch[0]);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try "17 December 2025" format
  const dayFirstMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dayFirstMatch) {
    const date = new Date(dayFirstMatch[0]);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try to extract from extractDate helper
  const extracted = extractDate(text);
  return extracted?.date;
}

/**
 * Extract total supply value
 */
function extractTotalSupply(text: string): number | undefined {
  // Handle "10 million", "10M", "10,000,000"
  const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:million|M\b)/i);
  if (millionMatch?.[1]) {
    return parseFloat(millionMatch[1]) * 1_000_000;
  }

  const billionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:billion|B\b)/i);
  if (billionMatch?.[1]) {
    return parseFloat(billionMatch[1]) * 1_000_000_000;
  }

  const thousandMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:thousand|K\b)/i);
  if (thousandMatch?.[1]) {
    return parseFloat(thousandMatch[1]) * 1_000;
  }

  // Plain number with commas
  const numMatch = text.match(/([\d,]+)/);
  if (numMatch?.[1]) {
    return parseInt(numMatch[1].replace(/,/g, ''), 10);
  }

  return undefined;
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
 * Extract content for a specific MiCA section number
 */
function extractSectionContent(text: string, sectionNum: string): string | null {
  // Pattern to find section like "A.1" or "E.28" followed by content
  const escapedSection = sectionNum.replace('.', '\\.');

  const patterns = [
    // "A.1    Field Name    Value" - table format with multiple spaces/tabs
    new RegExp(`\\b${escapedSection}\\s{2,}[\\w-]+(?:\\s+[\\w-]+)*\\s{2,}([^\\n]+)`, 'i'),
    // "A.1 Field Name\nContent" or "A.1: Content"
    new RegExp(`\\b${escapedSection}[.:\\s]+([\\s\\S]*?)(?=\\n[A-Z]\\.\\d|$)`, 'i'),
    // Section in table format with pipe or colon
    new RegExp(`${escapedSection}\\s*[|:]\\s*([^\\n]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      // Clean up the extracted content
      let content = match[1].trim();
      // Limit to reasonable length for single-line fields
      if (content.length > 2000) {
        content = content.slice(0, 2000);
      }
      if (content.length > 0) {
        return content;
      }
    }
  }

  return null;
}

/**
 * Extract multi-line content between sections
 */
function extractMultiLineContent(text: string, sectionNums: string[]): string | null {
  for (const sectionNum of sectionNums) {
    // Find start of section
    const startPattern = new RegExp(`\\b${sectionNum.replace('.', '\\.')}[.:\\s]`, 'i');
    const startMatch = text.match(startPattern);

    if (startMatch && startMatch.index !== undefined) {
      const startPos = startMatch.index + startMatch[0].length;
      // Find next section (A-J followed by number)
      const nextSectionMatch = text.slice(startPos).match(/\n[A-J]\.\d+[\s.:]/);
      const endPos = nextSectionMatch?.index
        ? startPos + nextSectionMatch.index
        : Math.min(startPos + 3000, text.length);

      let content = text.slice(startPos, endPos).trim();

      // Clean up the content
      content = content
        .replace(/^\s*\n/, '') // Remove leading newlines
        .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
        .trim();

      if (content.length > 50) {
        return content;
      }
    }
  }

  return null;
}

/**
 * Map extraction result to whitepaper fields
 */
export interface MappingResult {
  data: Partial<WhitepaperData>;
  mappings: MappedField[];
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

  const fullText = extraction.text;

  // First pass: Extract by section numbers
  for (const mapping of MICA_SECTION_MAPPINGS) {
    // Skip if already mapped
    if (mappings.some((m) => m.path === mapping.targetPath)) continue;

    // Try section numbers first
    for (const sectionNum of mapping.sectionNumbers) {
      let content: string | null = null;

      if (mapping.multiLine) {
        content = extractMultiLineContent(fullText, [sectionNum]);
      } else {
        content = extractSectionContent(fullText, sectionNum);
      }

      if (content && content.length > 2) {
        const value = mapping.transform ? mapping.transform(content, fullText) : content;

        if (value !== undefined && value !== null && value !== '') {
          setNestedValue(data, mapping.targetPath, value);

          const confidenceValue =
            mapping.confidence === 'high' ? 0.9 : mapping.confidence === 'medium' ? 0.7 : 0.5;

          mappings.push({
            path: mapping.targetPath,
            value,
            source: `Section ${sectionNum}`,
            confidence: mapping.confidence,
          });

          const section = mapping.targetPath.split('.')[0] || 'unknown';
          if (!confidenceScores[section]) {
            confidenceScores[section] = [];
          }
          confidenceScores[section].push(confidenceValue);

          break; // Found a match, move to next mapping
        }
      }
    }
  }

  // Second pass: Use patterns for anything not found
  for (const mapping of MICA_SECTION_MAPPINGS) {
    if (mappings.some((m) => m.path === mapping.targetPath)) continue;

    for (const pattern of mapping.patterns) {
      const match = fullText.match(pattern);
      if (match && match.index !== undefined) {
        // Extract content after the match
        const afterMatch = fullText.slice(match.index + match[0].length);

        // Get the next meaningful content
        let content: string;
        if (mapping.multiLine) {
          // Get multiple lines until next section or limit
          const endMatch = afterMatch.match(/\n[A-J]\.\d+[\s.:]/);
          content = afterMatch.slice(0, endMatch?.index || 2000).trim();
        } else {
          // Get the rest of the line, stopping at next numbered item or newline
          const lineEnd = afterMatch.search(/\n\d+\.\s|\n[A-J]\.\d|$/);
          const firstLine = afterMatch.slice(0, lineEnd === -1 ? undefined : lineEnd);
          content = firstLine.trim().slice(0, 500);
        }

        // Clean up common prefixes
        content = content
          .replace(/^[:\s]+/, '')
          .replace(/^(is|are|the|a|an)\s+/i, '')
          .trim();

        if (content.length > 2) {
          const value = mapping.transform ? mapping.transform(content, fullText) : content;

          if (value !== undefined && value !== null && value !== '') {
            setNestedValue(data, mapping.targetPath, value);

            const baseConfidence =
              mapping.confidence === 'high' ? 0.9 : mapping.confidence === 'medium' ? 0.7 : 0.5;
            const adjustedConfidence = baseConfidence * 0.7; // Lower for pattern match

            mappings.push({
              path: mapping.targetPath,
              value,
              source: `Pattern: ${pattern.source.slice(0, 30)}`,
              confidence: adjustedConfidence < 0.6 ? 'low' : mapping.confidence,
            });

            const section = mapping.targetPath.split('.')[0] || 'unknown';
            if (!confidenceScores[section]) {
              confidenceScores[section] = [];
            }
            confidenceScores[section].push(adjustedConfidence);

            break;
          }
        }
      }
    }
  }

  // Special handling: Detect public offering from context
  if (!data.partE || !(data.partE as Record<string, unknown>).isPublicOffering) {
    if (/public\s*offer|offer\s*to\s*(?:the\s*)?public/i.test(fullText)) {
      setNestedValue(data, 'partE.isPublicOffering', true);
      mappings.push({
        path: 'partE.isPublicOffering',
        value: true,
        source: 'Document context',
        confidence: 'medium',
      });
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
