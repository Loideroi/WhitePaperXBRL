/**
 * Field Mapper
 *
 * Maps extracted PDF content to XBRL taxonomy fields with confidence scoring.
 * Optimized for ESMA MiCA whitepaper format with table structure (No | Field | Content)
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
import { OTHR_FIELD_DEFINITIONS } from '@/lib/xbrl/generator/mica-template/field-definitions';

/**
 * Known blockchain networks for detection
 */
const KNOWN_BLOCKCHAINS = [
  'Chiliz Chain',
  'Ethereum',
  'Polygon',
  'Binance Smart Chain',
  'BSC',
  'Solana',
  'Avalanche',
  'Arbitrum',
  'Optimism',
  'Base',
  'Fantom',
  'Cronos',
  'Cardano',
  'Tezos',
  'Algorand',
  'Hedera',
  'NEAR',
  'Aptos',
  'Sui',
  'TON',
  'Tron',
  'Flow',
  'Cosmos',
  'Polkadot',
  'Kusama',
];

/**
 * Known consensus mechanisms for detection
 */
const KNOWN_CONSENSUS_MECHANISMS = [
  { pattern: /Proof[\s-]*of[\s-]*Staked[\s-]*Authority\s*\(PoSA\)/i, name: 'Proof of Staked Authority (PoSA)' },
  { pattern: /\bPoSA\b/i, name: 'Proof of Staked Authority (PoSA)' },
  { pattern: /Proof[\s-]*of[\s-]*Staked[\s-]*Authority/i, name: 'Proof of Staked Authority (PoSA)' },
  { pattern: /Proof[\s-]*of[\s-]*Authority\s*\(PoA\)/i, name: 'Proof of Authority (PoA)' },
  { pattern: /\bPoA\b/i, name: 'Proof of Authority (PoA)' },
  { pattern: /Proof[\s-]*of[\s-]*Authority/i, name: 'Proof of Authority (PoA)' },
  { pattern: /Proof[\s-]*of[\s-]*Stake\s*\(PoS\)/i, name: 'Proof of Stake (PoS)' },
  { pattern: /\bPoS\b(?!\s*Authority)/i, name: 'Proof of Stake (PoS)' },
  { pattern: /Proof[\s-]*of[\s-]*Stake(?![\s-]*Authority)/i, name: 'Proof of Stake (PoS)' },
  { pattern: /Proof[\s-]*of[\s-]*Work\s*\(PoW\)/i, name: 'Proof of Work (PoW)' },
  { pattern: /\bPoW\b/i, name: 'Proof of Work (PoW)' },
  { pattern: /Proof[\s-]*of[\s-]*Work/i, name: 'Proof of Work (PoW)' },
  { pattern: /Delegated[\s-]*Proof[\s-]*of[\s-]*Stake\s*\(DPoS\)/i, name: 'Delegated Proof of Stake (DPoS)' },
  { pattern: /\bDPoS\b/i, name: 'Delegated Proof of Stake (DPoS)' },
  { pattern: /Proof[\s-]*of[\s-]*History/i, name: 'Proof of History' },
  { pattern: /Byzantine[\s-]*Fault[\s-]*Toleran(?:t|ce)/i, name: 'Byzantine Fault Tolerance (BFT)' },
  { pattern: /\bPBFT\b/i, name: 'Practical Byzantine Fault Tolerance (PBFT)' },
  { pattern: /Tendermint/i, name: 'Tendermint BFT' },
];

/**
 * MiCA Section mapping configuration
 */
interface MiCASectionMapping {
  /** Section numbers (e.g., "A.1", "A.2") */
  sectionNumbers: string[];
  /** Field names to look for */
  fieldNames: string[];
  /** Alternative patterns for fallback */
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
 */
const MICA_SECTION_MAPPINGS: MiCASectionMapping[] = [
  // Part A: Offeror Information
  {
    sectionNumbers: ['A.1'],
    fieldNames: ['Name', 'Legal Name', 'Company Name'],
    patterns: [/legal\s*name|name\s*of\s*(?:the\s*)?offeror|company\s*name/i],
    targetPath: 'partA.legalName',
    transform: cleanLegalName,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.6'],
    fieldNames: ['Legal entity identifier', 'LEI'],
    patterns: [/\bLEI\b|legal\s*entity\s*identifier/i],
    targetPath: 'partA.lei',
    transform: extractLEIValue,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.3', 'A.4'],
    fieldNames: ['Registered address', 'Head office'],
    patterns: [/registered\s*(?:office\s*)?address|business\s*address|head\s*office/i],
    targetPath: 'partA.registeredAddress',
    transform: cleanTextContent,
    multiLine: true,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.3', 'A.4', 'A.8'],
    fieldNames: ['Country', 'Registered address', 'Head office'],
    patterns: [/country|jurisdiction|member\s*state|switzerland|zug/i],
    targetPath: 'partA.country',
    transform: extractCountryFromAddress,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['A.10', 'A.11'],
    fieldNames: ['Website', 'Web address', 'URL'],
    patterns: [/website|web\s*address|url/i],
    targetPath: 'partA.website',
    transform: extractUrl,
    confidence: 'high',
  },
  {
    sectionNumbers: ['A.9'],
    fieldNames: ['E-mail address', 'Email', 'Contact email'],
    patterns: [/e-?mail|contact.*email/i],
    targetPath: 'partA.contactEmail',
    transform: extractEmail,
    confidence: 'high',
  },

  // Part D: Crypto-asset Project Information
  {
    sectionNumbers: ['D.2'],
    fieldNames: ['Crypto-assets name', 'Crypto-asset name', 'Token name'],
    patterns: [/crypto[\s-]*asset[s]?\s*name|token\s*name/i],
    targetPath: 'partD.cryptoAssetName',
    transform: cleanCryptoAssetName,
    confidence: 'high',
  },
  {
    sectionNumbers: ['D.3'],
    fieldNames: ['Abbreviation', 'Ticker', 'Symbol'],
    patterns: [/abbreviation|ticker|symbol/i],
    targetPath: 'partD.cryptoAssetSymbol',
    transform: cleanTickerSymbol,
    confidence: 'high',
  },
  {
    sectionNumbers: ['D.4'],
    fieldNames: ['Crypto-asset project description', 'Project description'],
    patterns: [/(?:crypto[\s-]*asset\s*)?project\s*description/i],
    targetPath: 'partD.projectDescription',
    transform: cleanTextContent,
    multiLine: true,
    confidence: 'medium',
  },

  // Part F: Token characteristics
  {
    sectionNumbers: ['F.1', 'F.6'],
    fieldNames: ['Crypto-asset type', 'Token standard', 'Token Standard'],
    patterns: [/token\s*standard|CAP-20|ERC-20|protocol\s*standard/i],
    targetPath: 'partD.tokenStandard',
    transform: extractTokenStandard,
    confidence: 'high',
  },
  {
    sectionNumbers: ['F.6'],
    fieldNames: ['Crypto-asset characteristics', 'Total Token Supply', 'Overall Initial Total Token Supply'],
    patterns: [/total\s*(?:token\s*)?supply|overall\s*initial\s*total|maximum\s*supply/i],
    targetPath: 'partD.totalSupply',
    transform: extractTotalSupply,
    confidence: 'high',
  },

  // Part E: Offering Details
  {
    sectionNumbers: ['E.1'],
    fieldNames: ['Public offering', 'Offer to the public'],
    patterns: [/public\s*offer|offer\s*to\s*(?:the\s*)?public|OTPC/i],
    targetPath: 'partE.isPublicOffering',
    transform: (v) => /yes|OTPC|public|offer\s*to\s*(?:the\s*)?public/i.test(v),
    confidence: 'high',
  },
  {
    sectionNumbers: ['E.21'],
    fieldNames: ['Subscription period beginning', 'Start date', 'Offering start'],
    patterns: [/subscription\s*period\s*beginning|start\s*date|opens?\s*on/i],
    targetPath: 'partE.publicOfferingStartDate',
    transform: extractDateValue,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.22'],
    fieldNames: ['Subscription period end', 'End date', 'Offering end'],
    patterns: [/subscription\s*period\s*end|end\s*date|closes?\s*on/i],
    targetPath: 'partE.publicOfferingEndDate',
    transform: extractDateValue,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.8', 'E.11'],
    fieldNames: ['Issue price', 'Token price', 'Offer price'],
    patterns: [/issue\s*price|token\s*price|offer\s*price|\$?0\.50\s*\$?USD/i],
    targetPath: 'partE.tokenPrice',
    transform: extractTokenPrice,
    confidence: 'high',
  },
  {
    sectionNumbers: ['E.8', 'E.11'],
    fieldNames: ['Issue price', 'Token price', 'Offer price'],
    patterns: [/issue\s*price|token\s*price|offer\s*price|USD|EUR/i],
    targetPath: 'partE.tokenPriceCurrency',
    transform: extractCurrency,
    confidence: 'high',
  },
  {
    sectionNumbers: ['E.5'],
    fieldNames: ['Maximum subscription goals', 'Maximum subscription goal', 'Max subscription'],
    patterns: [/maximum\s*subscription\s*goal|max\s*subscription|funding\s*(?:goal|target)/i],
    targetPath: 'partE.maxSubscriptionGoal',
    transform: extractMaxSubscriptionGoal,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.5'],
    fieldNames: ['Maximum subscription goals', 'Maximum subscription goal', 'Max subscription'],
    patterns: [/maximum\s*subscription\s*goal|max\s*subscription|USD|EUR/i],
    targetPath: 'partE.maxSubscriptionGoalCurrency',
    transform: extractCurrency,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['E.26'],
    fieldNames: ['Right of withdrawal', 'Withdrawal rights'],
    patterns: [/withdrawal\s*right|right\s*(?:of|to)\s*withdraw/i],
    targetPath: 'partE.withdrawalRights',
    transform: (v) => /yes|entitled|right|can\s*withdraw|14\s*(?:calendar\s*)?days?/i.test(v),
    confidence: 'high',
  },

  // Part D: Blockchain network - extract from F.1 (crypto-asset type) and H.1 (DLT section)
  // Note: D.6 is "Utility Token Classification" NOT blockchain info
  {
    sectionNumbers: ['F.1', 'H.1'],
    fieldNames: ['Crypto-asset type', 'Distributed ledger technology', 'Distributed ledger technology (DLT)'],
    patterns: [/operates\s+on\s+(?:the\s+)?(\w+(?:\s+\w+)?)\s*,|blockchain\s*technology\s*used|Chiliz\s*Chain/i],
    targetPath: 'partD.blockchainNetwork',
    transform: extractBlockchainNetwork,
    multiLine: true,
    confidence: 'high',
  },

  // Part H: Technology
  {
    sectionNumbers: ['H.1'],
    fieldNames: ['Distributed ledger technology', 'Distributed ledger technology (DLT)', 'Consensus Mechanism'],
    patterns: [/Chiliz\s*Chain\s*(?:relies|follows)\s*(?:on\s*)?(?:a\s*)?Proof[\s-]*of[\s-]*Stake|consensus\s*mechanism|proof[\s-]*of[\s-]*(?:stake|work)/i],
    targetPath: 'partD.consensusMechanism',
    transform: extractConsensusMechanismFromDLT,
    multiLine: true,
    confidence: 'high',
  },
  // Part H: Blockchain Description from H.1 (Distributed ledger technology)
  {
    sectionNumbers: ['H.1'],
    fieldNames: ['Distributed ledger technology', 'Distributed ledger technology (DLT)', 'Distributed ledger technology (DTL)'],
    patterns: [/Distributed\s*ledger\s*technology|The\s+Chiliz\s+(?:Legacy\s+)?Chain/i],
    targetPath: 'partH.blockchainDescription',
    transform: cleanTextContent,
    multiLine: true,
    confidence: 'high',
  },
  // Part H: Smart Contract/Technical Info from H.2 (Protocols and technical standards)
  {
    sectionNumbers: ['H.2'],
    fieldNames: ['Protocols and technical standards', 'Protocols', 'Technical standards'],
    patterns: [/Protocols\s*and\s*technical\s*standards|Proof\s*of\s*Stake\s*Authority\s*\(PoSA\)|CAP-?20\s*Token\s*Standard/i],
    targetPath: 'partH.smartContractInfo',
    transform: cleanTextContent,
    multiLine: true,
    confidence: 'high',
  },
  {
    sectionNumbers: ['H.8', 'H.9'],
    fieldNames: ['Audit', 'Audit outcome', 'Security audit'],
    patterns: [/security\s*audit|audited\s*by|audit\s*report|audit\s*outcome/i],
    targetPath: 'partH.securityAudits',
    transform: (v) => [cleanTextContent(v)],
    confidence: 'medium',
  },

  // Part J: Sustainability
  {
    sectionNumbers: ['S.8'],
    fieldNames: ['Energy Consumption', 'Energy consumption'],
    patterns: [/energy\s*consumption|power\s*(?:consumption|usage)|kWh/i],
    targetPath: 'partJ.energyConsumption',
    transform: extractEnergyConsumption,
    confidence: 'high',
  },
  {
    sectionNumbers: ['S.4', 'J.1'],
    fieldNames: ['Consensus Mechanism'],
    patterns: [/consensus\s*mechanism\s*type|type\s*of\s*consensus/i],
    targetPath: 'partJ.consensusMechanismType',
    transform: extractConsensusMechanism,
    confidence: 'medium',
  },
  {
    sectionNumbers: ['S.10'],
    fieldNames: ['Renewable energy consumption', 'Renewable energy'],
    patterns: [/renewable\s*energy|green\s*energy/i],
    targetPath: 'partJ.renewableEnergyPercentage',
    transform: extractRenewableEnergy,
    confidence: 'medium',
  },
];

/**
 * Clean up legal name - remove "Name" prefix and clean whitespace
 */
function cleanLegalName(text: string): string {
  return text
    .replace(/^Name\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean crypto-asset name
 */
function cleanCryptoAssetName(text: string): string {
  return text
    .replace(/^Crypto[\s-]*asset[s]?\s*(?:project\s*)?name\s*/i, '')
    .replace(/\s*project\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean ticker symbol - extract just the symbol
 */
function cleanTickerSymbol(text: string): string {
  // Try to find $SYMBOL pattern
  const dollarMatch = text.match(/\$([A-Z]+)/i);
  if (dollarMatch?.[1]) {
    return dollarMatch[1].toUpperCase();
  }

  // Clean up and return first word-like token
  const cleaned = text
    .replace(/^Abbreviation\s*/i, '')
    .replace(/[$]/g, '')
    .trim();

  const firstWord = cleaned.match(/^([A-Z]+)/i);
  return firstWord?.[1]?.toUpperCase() || cleaned.slice(0, 10).toUpperCase();
}

/**
 * Clean text content - remove table formatting artifacts
 */
function cleanTextContent(text: string): string {
  let cleaned = repairLigatures(text)
    .replace(/\n{2,}/g, '\n\n')
    .replace(/([a-z])\n([a-z])/gi, '$1 $2')  // Join broken lines mid-sentence
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Strip MiCA section headers that bleed from adjacent sections
  cleaned = cleaned.replace(/[\n ]+Part\s+[A-JS]:\s*\n[A-Z][^\n]+$/, '');
  cleaned = cleaned.replace(/\s+Part\s+[A-JS]:\s+[A-Z][A-Za-z ]+$/, '');
  return cleaned;
}

/**
 * Extract LEI value - handle "Not applicable" and Swiss UID format
 */
function extractLEIValue(text: string): string {
  // Check for "Not applicable"
  if (/not\s*applicable/i.test(text)) {
    // Look for Business ID in subsequent text
    const businessIdMatch = text.match(/Business\s*ID[:\s]*([A-Z]{3}[-\s]?\d{3}\.?\d{3}\.?\d{3})/i);
    if (businessIdMatch?.[1]) {
      return businessIdMatch[1].replace(/\s/g, '');
    }
    return '';
  }

  // Standard LEI (20 alphanumeric)
  const lei = extractLEI(text);
  if (lei?.value) return lei.value;

  // Swiss UID format (CHE-XXX.XXX.XXX)
  const uidMatch = text.match(/CHE[-\s]?\d{3}\.?\d{3}\.?\d{3}/i);
  if (uidMatch) return uidMatch[0].toUpperCase().replace(/\s/g, '');

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
function extractCountryCode(text: string, _fullText?: string): string {
  const code = countryNameToCode(text);
  if (code) return code;

  return text.slice(0, 2).toUpperCase();
}

/**
 * Extract country code from an address string.
 * Parses the country from the end of the address (after the last comma).
 * E.g., "Gubelstrasse 11, 6300 Zug, Switzerland" → "CH"
 */
function extractCountryFromAddress(addressText: string, fullText: string): string {
  // First try the address-based extraction:
  // Look for country as the last component (after last comma)
  const parts = addressText.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const code = countryNameToCode(lastPart);
      if (code) return code;
    }
  }

  // Fall back to general country code extraction
  return extractCountryCode(addressText, fullText);
}

/**
 * Extract subdivision (city/region) from an address string.
 * Parses the component between the last two commas, stripping postal codes.
 * E.g., "Gubelstrasse 11, 6300 Zug, Switzerland" → "Zug"
 */
function extractSubdivisionFromAddress(addressText: string): string {
  const parts = addressText.split(',').map(p => p.trim());

  if (parts.length >= 3) {
    // The city/region is typically the second-to-last component
    const cityPart = parts[parts.length - 2];
    if (cityPart) {
      // Strip postal code (digits at the start or end)
      return cityPart.replace(/^\d{4,6}\s*/, '').replace(/\s*\d{4,6}$/, '').trim();
    }
  }

  if (parts.length === 2) {
    // Two parts: "city, country" — city is first
    const cityPart = parts[0];
    if (cityPart) {
      return cityPart.replace(/^\d{4,6}\s*/, '').replace(/\s*\d{4,6}$/, '').trim();
    }
  }

  return '';
}

/**
 * Convert a country name to ISO 2-letter code (shared lookup)
 */
function countryNameToCode(text: string): string | null {
  const countryMap: Record<string, string> = {
    switzerland: 'CH',
    swiss: 'CH',
    zug: 'CH',
    malta: 'MT',
    msida: 'MT',
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
    jakarta: 'ID',
  };

  const lowerText = text.toLowerCase().trim();

  for (const [name, code] of Object.entries(countryMap)) {
    if (lowerText.includes(name)) {
      return code;
    }
  }

  // Check for 2-letter code
  const codeMatch = text.match(/\b([A-Z]{2})\b/);
  if (codeMatch?.[1] && codeMatch[1] !== 'AG') {
    return codeMatch[1];
  }

  return null;
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
  let result: string | undefined;

  // Try ISO format first
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    result = isoMatch[0];
  }

  // Try DD/MM/YYYY or MM/DD/YYYY format (normalize to ISO)
  if (!result) {
    const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch?.[1] && slashMatch[2] && slashMatch[3]) {
      const a = parseInt(slashMatch[1], 10);
      const b = parseInt(slashMatch[2], 10);
      const year = slashMatch[3];
      // If first number > 12, it's DD/MM/YYYY; otherwise assume DD/MM/YYYY (European convention)
      const day = a > 12 ? a : a;
      const month = a > 12 ? b : b;
      // In European convention (MiCA context), first is day
      result = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try "December 17, 2025" format
  if (!result) {
    const monthNameMatch = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthNameMatch) {
      const date = new Date(monthNameMatch[0]);
      if (!isNaN(date.getTime())) {
        result = date.toISOString().split('T')[0];
      }
    }
  }

  // Try "17 December 2025" format
  if (!result) {
    const dayFirstMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
    if (dayFirstMatch) {
      const date = new Date(dayFirstMatch[0]);
      if (!isNaN(date.getTime())) {
        result = date.toISOString().split('T')[0];
      }
    }
  }

  // Try to extract from extractDate helper
  if (!result) {
    const extracted = extractDate(text);
    result = extracted?.date;
  }

  // Strip trailing punctuation from extracted date
  if (result) {
    result = result.replace(/[.,;:!?]+$/, '');
  }

  return result;
}

/**
 * Extract token price (e.g., 0.50 USD)
 */
function extractTokenPrice(text: string): number | undefined {
  // Look for USD patterns first - "$0.50", "0.50 USD", "0.50 $USD", "-0.50 $USD-"
  const usdMatch = text.match(/[-]?(?:\$)?(\d+(?:\.\d+)?)\s*(?:\$?USD|\$)[-]?/i);
  if (usdMatch?.[1]) {
    return parseFloat(usdMatch[1]);
  }

  // Look for EUR patterns - "EUR 0.50", "0.50 EUR", "0.50 €"
  const eurMatch = text.match(/(?:EUR\s*)?(\d+(?:\.\d+)?)\s*(?:EUR|€)/i);
  if (eurMatch?.[1]) {
    return parseFloat(eurMatch[1]);
  }

  // Generic price pattern
  const priceMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (priceMatch?.[1]) {
    return parseFloat(priceMatch[1]);
  }

  const monetary = extractMonetaryValue(text);
  return monetary?.amount;
}

/**
 * Extract currency from text (USD or EUR)
 */
function extractCurrency(text: string): string {
  // Check for USD patterns
  if (/\$USD|\bUSD\b|\$/i.test(text)) {
    return 'USD';
  }

  // Check for EUR patterns
  if (/\bEUR\b|€/i.test(text)) {
    return 'EUR';
  }

  // Default to USD (most common in crypto whitepapers)
  return 'USD';
}

/**
 * Extract max subscription goal
 */
function extractMaxSubscriptionGoal(text: string): number | undefined {
  // Look for amounts like "25,000 USD", "USD 25,000"
  const amountMatch = text.match(/(?:USD\s*)?([\d,]+)\s*(?:\$?USD)?/i);
  if (amountMatch?.[1]) {
    return parseInt(amountMatch[1].replace(/,/g, ''), 10);
  }

  const monetary = extractMonetaryValue(text);
  return monetary?.amount;
}

/**
 * Extract total supply value
 */
function extractTotalSupply(text: string): number | undefined {
  // Look for "10,000,000" or "10 million" patterns
  const millionMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:million|M\b)/i);
  if (millionMatch?.[1]) {
    return parseFloat(millionMatch[1].replace(/,/g, '')) * 1_000_000;
  }

  // Look for explicit numbers like "10,000,000"
  const numMatch = text.match(/([\d,]+(?:\.\d+)?)\s*\$?[A-Z]*/);
  if (numMatch?.[1]) {
    const num = parseFloat(numMatch[1].replace(/,/g, ''));
    if (num >= 1000) return num;  // Only if it's a reasonable supply number
  }

  const billionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:billion|B\b)/i);
  if (billionMatch?.[1]) {
    return parseFloat(billionMatch[1]) * 1_000_000_000;
  }

  return undefined;
}

/**
 * Extract token standard (e.g., CAP-20, ERC-20)
 */
function extractTokenStandard(text: string): string {
  // Look for standard patterns
  const standardMatch = text.match(/\b(CAP-?20|ERC-?20|BEP-?20)\b/i);
  if (standardMatch?.[1]) {
    return standardMatch[1].toUpperCase().replace(/(\d)/, '-$1');
  }

  return cleanTextContent(text).slice(0, 50);
}

/**
 * Extract consensus mechanism using known mechanisms list
 */
function extractConsensusMechanism(text: string, fullText: string): string {
  // Combine section text and full document text for searching
  const searchText = `${text} ${fullText}`;

  // Search using known consensus mechanism patterns
  for (const mechanism of KNOWN_CONSENSUS_MECHANISMS) {
    if (mechanism.pattern.test(searchText)) {
      return mechanism.name;
    }
  }

  // Extract from longer text
  const mechanismMatch = searchText.match(/(?:consensus\s*mechanism[:\s]*)([^.]+)/i);
  if (mechanismMatch?.[1]) {
    // Check if the extracted text contains a known mechanism
    for (const mechanism of KNOWN_CONSENSUS_MECHANISMS) {
      if (mechanism.pattern.test(mechanismMatch[1])) {
        return mechanism.name;
      }
    }
    return cleanTextContent(mechanismMatch[1]).slice(0, 100);
  }

  return cleanTextContent(text).slice(0, 100);
}

/**
 * Extract blockchain network name by scanning for known blockchains
 */
function extractBlockchainNetwork(text: string, fullText: string): string {
  // Combine both the section text and full document text for searching
  const searchText = `${text} ${fullText}`;

  // Look for "operates on the X" pattern first (common in F.1)
  const operatesMatch = searchText.match(/operates\s+on\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+Chain)?)/i);
  if (operatesMatch?.[1]) {
    const blockchain = operatesMatch[1].trim();
    // Verify it's a known blockchain
    for (const known of KNOWN_BLOCKCHAINS) {
      if (blockchain.toLowerCase().includes(known.toLowerCase())) {
        return known;
      }
    }
  }

  // Look for "The X is the blockchain technology" pattern
  const theMatch = searchText.match(/The\s+(\w+(?:\s+\w+)?)\s+is\s+(?:the\s+)?blockchain\s+technology/i);
  if (theMatch?.[1]) {
    for (const known of KNOWN_BLOCKCHAINS) {
      if (theMatch[1].toLowerCase().includes(known.toLowerCase())) {
        return known;
      }
    }
  }

  // Search for any known blockchain in the text
  for (const blockchain of KNOWN_BLOCKCHAINS) {
    const pattern = new RegExp(`\\b${blockchain.replace(/\s+/g, '\\s*')}\\b`, 'i');
    if (pattern.test(searchText)) {
      return blockchain;
    }
  }

  // Fallback: Extract first mentioned network-like name
  const networkMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(Chain|Network|Blockchain)\b/i);
  if (networkMatch) {
    return `${networkMatch[1]} ${networkMatch[2]}`.trim();
  }

  return cleanTextContent(text).slice(0, 50);
}

/**
 * Extract consensus mechanism from DLT description in H.1
 * Handles text like "...relies on a Proof-of-Staked-Authority (PoSA) consensus mechanism"
 */
function extractConsensusMechanismFromDLT(text: string, fullText: string): string {
  // Combine section text and full document text for searching
  const searchText = `${text} ${fullText}`;

  // Search using known consensus mechanism patterns
  for (const mechanism of KNOWN_CONSENSUS_MECHANISMS) {
    if (mechanism.pattern.test(searchText)) {
      return mechanism.name;
    }
  }

  // Try to extract from "consensus mechanism" phrase
  const mechanismMatch = searchText.match(/(?:consensus\s*mechanism[:\s]*)([^.]+)/i);
  if (mechanismMatch?.[1]) {
    // Check if the extracted text contains a known mechanism
    for (const mechanism of KNOWN_CONSENSUS_MECHANISMS) {
      if (mechanism.pattern.test(mechanismMatch[1])) {
        return mechanism.name;
      }
    }
    return cleanTextContent(mechanismMatch[1]).slice(0, 100);
  }

  return cleanTextContent(text).slice(0, 100);
}

/**
 * Extract smart contract info from H.7 - return empty if it just references H.1
 */
function extractSmartContractInfo(text: string): string {
  // Check if it just references another section
  if (/please\s*refer|refer\s*(?:further\s*)?to|see\s+(?:section\s+)?H\.1/i.test(text)) {
    return '';
  }

  // Check for "not applicable" or similar
  if (/not\s*applicable|n\/a|none/i.test(text)) {
    return '';
  }

  // Look for actual contract address (standard 40 chars or shorter for test data)
  const addressMatch = text.match(/0x[a-fA-F0-9]{8,40}/);
  if (addressMatch) return addressMatch[0];

  // If there's substantive content, return it
  const cleaned = cleanTextContent(text);
  if (cleaned.length > 20 && !/refer|section\s+H/i.test(cleaned)) {
    return cleaned.slice(0, 500);
  }

  return '';
}

/**
 * Extract energy consumption
 */
function extractEnergyConsumption(text: string): number | undefined {
  // Look for kWh pattern with decimals
  const kwhMatch = text.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  if (kwhMatch?.[1]) {
    return parseFloat(kwhMatch[1]);
  }

  const num = extractNumber(text);
  return num?.value;
}

/**
 * Extract renewable energy percentage or N/A
 */
function extractRenewableEnergy(text: string): number | string | undefined {
  // Check for "Not applicable"
  if (/not\s*applicable/i.test(text)) {
    return undefined;  // Return undefined for N/A
  }

  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch?.[1]) return parseFloat(percentMatch[1]);

  const num = extractNumber(text);
  return num?.value;
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
 * Extract content from MiCA table format (No | Field | Content)
 */
function extractTableContent(text: string, sectionNum: string, fieldNames: string[]): string | null {
  const escapedSection = sectionNum.replace('.', '\\.');

  // Pattern 1: Section number followed by field name and content on same/next lines
  // e.g., "A.1    Name    Socios Technologies AG"
  for (const fieldName of fieldNames) {
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match pattern where section, field name, and value are in sequence
    const pattern = new RegExp(
      `${escapedSection}\\s+${escapedField}\\s+([^\\n]+(?:\\n(?![A-Z]\\.[0-9])[^\\n]*)*)`,
      'i'
    );

    const match = text.match(pattern);
    if (match?.[1]) {
      const content = match[1].trim();
      if (content.length > 1 && !/^(Field|Content|No|No\s+Field\s+Content)$/i.test(content)) {
        return content;
      }
    }
  }

  // Pattern 2: Just section number followed by content
  // Limited field name pattern: up to 3 words before content (non-greedy)
  const sectionPattern = new RegExp(
    `\\b${escapedSection}\\s+(?:[A-Za-z]+(?:\\s+[A-Za-z-]+){0,2}\\s+)?(.+)$`,
    'im'
  );

  const sectionMatch = text.match(sectionPattern);
  if (sectionMatch?.[1]) {
    let content = sectionMatch[1].trim();
    // Remove field name if it's at the start
    for (const fieldName of fieldNames) {
      if (content.toLowerCase().startsWith(fieldName.toLowerCase())) {
        content = content.slice(fieldName.length).trim();
        break;
      }
    }
    // Strip placeholder text and filter table header artifacts
    content = stripPlaceholderText(content);
    if (content && content.length > 1 && !/^(Field|Content|Field\s+Content|No\s+Field\s+Content)$/i.test(content)) {
      return content;
    }
  }

  return null;
}

/**
 * Extract multi-line content for a section
 */
function extractMultiLineTableContent(text: string, sectionNum: string, fieldNames: string[]): string | null {
  const escapedSection = sectionNum.replace('.', '\\.');

  for (const fieldName of fieldNames) {
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find start of section
    const startPattern = new RegExp(`${escapedSection}\\s+${escapedField}`, 'i');
    const startMatch = text.match(startPattern);

    if (startMatch && startMatch.index !== undefined) {
      const startPos = startMatch.index + startMatch[0].length;

      // Find next section (A-Z followed by number)
      const nextSectionMatch = text.slice(startPos).match(/\n[A-Z]\.\d+\s/);
      const endPos = nextSectionMatch?.index
        ? startPos + nextSectionMatch.index
        : Math.min(startPos + 5000, text.length);

      let content = text.slice(startPos, endPos).trim();

      // Clean up the content
      content = cleanTextContent(content);
      content = stripPlaceholderText(content);

      if (content && content.length > 20) {
        return content;
      }
    }
  }

  return null;
}

/**
 * Extract ALL numbered field content from the PDF text.
 *
 * This is a complete rewrite that properly parses the MiCA table format:
 * "No | Field | Content" with multi-line content cells.
 *
 * The PDF uses these field patterns:
 * - Simple numbers (1-10) for Regulatory Disclosures and Summary
 * - Lettered fields (A.1, A.2, ... J.1) for Parts A-J
 * - S.1-S.16 for Sustainability indicators
 * - Ranges like "B.2-B12" or "C.1-C14" for "not applicable" sections
 *
 * Returns a Record keyed by field number (e.g., "A.1", "E.14", "S.8", "01").
 */
function extractAllRawFields(text: string): Record<string, string> {
  const rawFields: Record<string, string> = {};

  // Normalize whitespace but preserve paragraph structure
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ');

  // Build a list of all field numbers we want to extract, ordered by appearance in document
  const fieldNumbers: string[] = [];
  for (const fieldDef of OTHR_FIELD_DEFINITIONS) {
    // Skip dimensional fields and sub-fields
    if (fieldDef.isDimensional) continue;
    if (/[a-z]$/.test(fieldDef.number)) continue;
    fieldNumbers.push(fieldDef.number);
  }

  // Create a regex that matches any MiCA field number at the start of a table row
  // Patterns: "1 ", "01 ", "A.1 ", "A.12 ", "E.21 ", "S.8 ", "B.2-B12 "
  const fieldPattern = /(?:^|\n)\s*([A-JS]\.?\d+(?:-[A-JS]?\d+)?|\d{1,2})\s+/g;

  // Find all field markers and their positions
  // Also track ranges for later expansion
  // We track BOTH matchStart (where the pattern like "\nA.3\n" begins)
  // and contentStart (where the actual content after the field number begins)
  const fieldPositions: Array<{
    fieldNum: string;
    matchStart: number;  // Where the match pattern starts (before field number)
    contentStart: number; // Where content starts (after field number)
    isRange: boolean;
    rangeFields?: string[]
  }> = [];
  let match;
  while ((match = fieldPattern.exec(normalizedText)) !== null) {
    const fieldNum = match[1];
    if (fieldNum) {
      const isRange = fieldNum.includes('-');
      const rangeFields = isRange ? parseFieldRange(fieldNum) : undefined;
      const normalizedNum = normalizeFieldNumber(fieldNum);
      if (normalizedNum) {
        fieldPositions.push({
          fieldNum: normalizedNum,
          matchStart: match.index,  // Start of the match (e.g., the \n before "A.3")
          contentStart: match.index + match[0].length,  // After the field number
          isRange,
          rangeFields,
        });
      }
    }
  }

  // Extract content between consecutive fields
  for (let i = 0; i < fieldPositions.length; i++) {
    const current = fieldPositions[i];
    if (!current) continue;

    const next = fieldPositions[i + 1];

    // Find where the content for this field ends
    // It ends at the start of the next field's match (before the \n that precedes the field number)
    const contentStart = current.contentStart;
    let contentEnd: number;

    if (next) {
      // Content ends where the next field's match begins
      // This correctly excludes the next field number from our content
      contentEnd = next.matchStart;
    } else {
      // Last field - go to end of document
      contentEnd = normalizedText.length;
    }

    // Extract and clean the content
    let content = normalizedText.slice(contentStart, contentEnd).trim();

    // Repair ligatures early so label matching works on clean text
    content = repairLigatures(content);

    // Remove field labels that appear at the start (e.g., "Name Socios Technologies AG")
    // by finding where the actual content starts after the label
    content = removeFieldLabelFromContent(content, current.fieldNum);

    // Strip field number echo from start of content (e.g., "E.2  Reasons for..." → "Reasons for...")
    content = content.replace(/^[A-JS]\.\d+[a-z]?\s+/, '');

    // Clean up formatting
    content = cleanFieldContent(content);

    // Field-specific cleanup for known patterns
    content = cleanFieldSpecific(content, current.fieldNum);

    if (content && content.length >= 1) {
      rawFields[current.fieldNum] = content;

      // If this is a range field, also populate all fields in the range
      if (current.isRange && current.rangeFields) {
        for (const rangeField of current.rangeFields) {
          if (!rawFields[rangeField]) {
            rawFields[rangeField] = content;
          }
        }
      }
    }
  }

  // Also extract fields using pattern matching for cases where table parsing fails
  extractFieldsByLabelPattern(normalizedText, rawFields);

  // Look for "Part X does not apply" patterns and populate related fields
  populateNotApplicableSections(normalizedText, rawFields);

  return rawFields;
}

/**
 * Parse a field range like "B.2-B12" or "C.1-C14" and return all field numbers in the range
 */
function parseFieldRange(fieldNum: string): string[] {
  // Check if it's a range
  const rangeMatch = fieldNum.match(/^([A-JS])\.?(\d+)-([A-JS])?(\d+)$/);
  if (!rangeMatch) {
    // Not a range, return single normalized field
    const normalized = normalizeSingleFieldNumber(fieldNum);
    return normalized ? [normalized] : [];
  }

  const section = rangeMatch[1];
  const startNum = parseInt(rangeMatch[2] ?? '0', 10);
  const endNum = parseInt(rangeMatch[4] ?? '0', 10);

  if (startNum > endNum || endNum - startNum > 50) {
    // Invalid range or too large, just return the first field
    return [`${section}.${startNum}`];
  }

  // Generate all fields in the range
  const fields: string[] = [];
  for (let i = startNum; i <= endNum; i++) {
    fields.push(`${section}.${i}`);
  }
  return fields;
}

/**
 * Normalize a single field number (not a range) to standard format
 */
function normalizeSingleFieldNumber(fieldNum: string): string | null {
  // Handle simple numbers (1-10) - map to two-digit format
  if (/^\d{1,2}$/.test(fieldNum)) {
    const num = parseInt(fieldNum, 10);
    if (num >= 1 && num <= 10) {
      return num.toString().padStart(2, '0');
    }
    return null;
  }

  // Handle lettered fields like A.1, E.21, S.8
  if (/^[A-JS]\.\d+$/.test(fieldNum)) {
    return fieldNum;
  }

  // Handle fields without dot like S8 -> S.8
  const noDotMatch = fieldNum.match(/^([A-JS])(\d+)$/);
  if (noDotMatch) {
    return `${noDotMatch[1]}.${noDotMatch[2]}`;
  }

  return null;
}

/**
 * Normalize field numbers to our standard format
 * For ranges, returns just the first field (use parseFieldRange for full expansion)
 */
function normalizeFieldNumber(fieldNum: string): string | null {
  // Handle ranges like "B.2-B12" - extract the first field
  if (fieldNum.includes('-')) {
    const first = fieldNum.split('-')[0];
    return normalizeFieldNumber(first || '');
  }

  return normalizeSingleFieldNumber(fieldNum);
}

/**
 * Remove field label from the start of content
 */
/**
 * Generate alternate label variants for label stripping.
 * PDFs often use different wording than the ESMA taxonomy field definitions:
 * - "other token" ↔ "crypto-asset" / "crypto-assets"
 * - "Name of crypto-asset" ↔ "Name of the crypto-asset"
 * - "offered or traded" ↔ "offered/traded"
 */
function generateLabelVariants(label: string): string[] {
  const variants = new Set<string>([label]);

  // Apply substitution rules iteratively so combined changes are generated
  // e.g., "offered or traded other tokens" → "offered/traded crypto-assets"
  const rules: [RegExp, string[]][] = [
    [/other\s+tokens?/i, ['crypto-assets', 'crypto-asset']],
    [/crypto[- ]?assets?/i, ['other tokens', 'other token']],
    [/offered\s+or\s+traded/i, ['offered/traded']],
    [/\bof\s+(?!the\b)/i, ['of the ']],  // "of X" → "of the X"
  ];
  // Also reverse: "of the X" → "of X"
  if (/\bof\s+the\b/i.test(label)) {
    variants.add(label.replace(/\bof\s+the\s+/gi, 'of '));
  }

  // "white paper" ↔ "crypto-asset white paper"
  if (/\bwhite\s+paper\b/i.test(label) && !/crypto/i.test(label)) {
    variants.add(label.replace(/white\s+paper/gi, 'crypto-asset white paper'));
  }

  // Apply rules iteratively — each round applies one rule to all existing variants
  for (const [pattern, replacements] of rules) {
    const current = [...variants];
    for (const v of current) {
      if (pattern.test(v)) {
        for (const replacement of replacements) {
          variants.add(v.replace(new RegExp(pattern.source, 'gi'), replacement));
        }
      }
    }
  }

  return [...variants];
}

/**
 * PDF-specific field labels that differ from the ESMA taxonomy labels.
 * The PDF table "Field" column often uses different wording than the
 * taxonomy definition, causing label bleed when only taxonomy labels are checked.
 */
const PDF_FIELD_LABELS: Record<string, string[]> = {
  'A.12': ['Members of the management body'],
  'D.2':  ['Crypto-assets name', 'Crypto-asset name', 'Name of the crypto-asset'],
  'D.8':  ['Plans for the token'],
  'D.9':  ['Resource allocation'],
  'D.10': ['Planned use of Collected funds or crypto-Assets', 'Planned use of collected funds or crypto-assets'],
  'E.3':  ['Fundraising target'],
  'E.4':  ['Minimum subscription goals', 'Minimum subscription goal'],
  'E.5':  ['Maximum subscription goals', 'Maximum subscription goal'],
  'I.4':  ['Project implementation-related risks', 'Project implementation -related risks'],
};

function removeFieldLabelFromContent(content: string, fieldNum: string): string {
  // Find the field definition to get its label
  const fieldDef = OTHR_FIELD_DEFINITIONS.find(f => f.number === fieldNum);
  if (!fieldDef) return content;

  const label = fieldDef.label;
  const allLabels = generateLabelVariants(label);

  // Also include PDF-specific labels that differ from the taxonomy
  const pdfLabels = PDF_FIELD_LABELS[fieldNum];
  if (pdfLabels) {
    for (const pdfLabel of pdfLabels) {
      allLabels.push(...generateLabelVariants(pdfLabel));
    }
  }

  // Try each label variant (original + alternates)
  for (const labelVariant of allLabels) {
    // Build flexible regex: replace spaces with \s+ to handle PDF whitespace
    const flexibleLabel = escapeRegexSpecialChars(labelVariant).replace(/ /g, '\\s+');
    const labelPattern = new RegExp(`^${flexibleLabel}\\s*`, 'i');
    const withoutLabel = content.replace(labelPattern, '').trim();
    if (withoutLabel.length < content.length) {
      return withoutLabel;
    }

    // Also try without parenthetical text
    const shortLabel = labelVariant.replace(/\s*\([^)]+\)\s*/g, '').trim();
    if (shortLabel !== labelVariant) {
      const flexibleShort = escapeRegexSpecialChars(shortLabel).replace(/ /g, '\\s+');
      const shortLabelPattern = new RegExp(`^${flexibleShort}\\s*`, 'i');
      const withoutShortLabel = content.replace(shortLabelPattern, '').trim();
      if (withoutShortLabel.length < content.length) {
        return withoutShortLabel;
      }
    }
  }

  return content;
}

/**
 * Escape special regex characters
 */
function escapeRegexSpecialChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Smart join of text lines - removes soft line breaks while preserving paragraphs.
 * PDF text extraction often includes line breaks from text wrapping that should
 * be spaces (e.g., "Fan\nToken" should be "Fan Token").
 */
function smartJoinLines(text: string): string {
  // Mark intentional paragraph breaks (double newlines or more)
  let result = text.replace(/\n\n+/g, '{{PARA}}');

  // CRITICAL: Normalize whitespace around single newlines BEFORE pattern matching
  // PDF extraction often has "Fan \n Token" or "Fan\n Token" which breaks the patterns
  // First, trim trailing whitespace before newlines
  result = result.replace(/[ \t]+\n/g, '\n');
  // Then, trim leading whitespace after newlines (but not after PARA markers)
  result = result.replace(/\n[ \t]+/g, '\n');

  // Join lines where a word continues on the next line (hyphenation)
  // e.g., "tech-\nnology" -> "technology"
  result = result.replace(/(\w)-\n(\w)/g, '$1$2');

  // Join lines where the line ends mid-sentence (no terminal punctuation)
  // and the next line starts with a lowercase letter or continues naturally
  // e.g., "The $SPURS Fan\nToken is" -> "The $SPURS Fan Token is"
  result = result.replace(/([a-zA-Z,;:])\n([a-z])/g, '$1 $2');

  // Join lines where line ends with a word and next starts with capital
  // (common in PDF where sentences wrap)
  // But preserve if current line ends with sentence-ending punctuation
  result = result.replace(/([a-z])\n([A-Z])/g, (match, p1, p2) => {
    // This is likely a sentence continuation, join with space
    return `${p1} ${p2}`;
  });

  // Handle lines ending with common continuation patterns
  result = result.replace(/(the|a|an|of|in|to|for|and|or|with|by|as|is|are|was|were|be|been|being)\n/gi,
    '$1 ');

  // Restore paragraph breaks
  result = result.replace(/{{PARA}}/g, '\n\n');

  // Clean up any double spaces created
  result = result.replace(/  +/g, ' ');

  return result;
}

/**
 * Repair PDF ligature splitting.
 *
 * pdf-parse renders typographic ligatures (ff, fi, fl) as separate characters
 * with an inserted space, e.g. "o ffering" → "offering", "bene fits" → "benefits".
 */
function repairLigatures(text: string): string {
  let result = text;
  // ff ligature: "o ffering" → "offering", "a ffiliate" → "affiliate"
  // Use \s instead of literal space — pdf-parse may insert \u00A0 or other whitespace
  result = result.replace(/([a-zA-Z])\s(ff[a-z])/g, '$1$2');
  // fi ligature: "bene fits" → "benefits", "speci fic" → "specific"
  result = result.replace(/([a-zA-Z])\s(fi[a-z])/g, '$1$2');
  // fl ligature: "a fflicted" → "afflicted", "in flation" → "inflation"
  result = result.replace(/([a-zA-Z])\s(fl[a-z])/g, '$1$2');

  // Space-eating ligatures: pdf-parse sometimes consumes the space BEFORE
  // a ligature-starting word, merging it with the previous word.
  // e.g., "isfixed" → "is fixed", "afirm" → "a firm", "thefirst" → "the first"
  // Use specific compound patterns to avoid false positives inside real words
  // (e.g., "official", "affiliates", "offering" must NOT be split).
  const mergedWords: [RegExp, string][] = [
    [/\bisfixed\b/g, 'is fixed'],
    [/\bisfinanced\b/g, 'is financed'],
    [/\bisfinal\b/g, 'is final'],
    [/\bwasfixed\b/g, 'was fixed'],
    [/\basfixed\b/g, 'as fixed'],
    [/\bthefirst\b/g, 'the first'],
    [/\bcomesfirst\b/g, 'comes first'],
    [/\bafirm\b/g, 'a firm'],
    [/\bafixed\b/g, 'a fixed'],
    [/\baflat\b/g, 'a flat'],
    [/\bpurchasefinancial\b/g, 'purchase financial'],
    [/\bimprovedfinancial\b/g, 'improved financial'],
    [/\bcontinuedfinancial\b/g, 'continued financial'],
    [/\bincludingfiat\b/gi, 'including fiat'],
    [/\bachievefinality\b/g, 'achieve finality'],
    [/\bmayfluctuate\b/g, 'may fluctuate'],
  ];
  for (const [pattern, replacement] of mergedWords) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Clean field content - remove excess whitespace, normalize formatting
 */
function cleanFieldContent(content: string): string {
  // Strip PDF placeholder text before any other processing
  let cleaned = stripPlaceholderText(content);
  if (!cleaned) return '';

  // Repair PDF ligature splitting before line joining
  cleaned = repairLigatures(cleaned);

  // Apply smart line joining to handle PDF text wrapping
  cleaned = smartJoinLines(cleaned);

  // Collapse excessive paragraph breaks
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove trailing/leading whitespace from each line
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();

  // Strip MiCA section headers that bleed from adjacent sections
  // e.g., content ending with "\n\nPart D:\nInformation about the crypto-asset project"
  // After smartJoinLines, the paragraph break may have collapsed to a space or \n
  cleaned = cleaned.replace(/[\n ]+Part\s+[A-JS]:\s*\n[A-Z][^\n]+$/, '');
  // Also handle fully joined case (single line): "...secure. Part D: Information about..."
  cleaned = cleaned.replace(/\s+Part\s+[A-JS]:\s+[A-Z][A-Za-z ]+$/, '');

  // Strip trailing periods from single-line values (not multi-line prose)
  if (!cleaned.includes('\n')) {
    cleaned = cleaned.replace(/[.]+$/, '');
  }

  return cleaned;
}

/**
 * Field-specific cleanup for known extraction artifacts.
 * Applied after generic cleaning for fields with predictable format issues.
 */
function cleanFieldSpecific(content: string, fieldNum: string): string {
  // A.10: Response time in days — extract number from "(Days) {7}" or "days 7" patterns
  if (fieldNum === 'A.10') {
    // Try to extract a number from patterns like "(Days) {7}", "(Days) 7", "7 days"
    const bracketMatch = content.match(/\{(\d+)\}/);
    if (bracketMatch?.[1]) return bracketMatch[1];
    const daysMatch = content.match(/(?:days?\)?)\s*[:{]?\s*(\d+)/i);
    if (daysMatch?.[1]) return daysMatch[1];
    const numMatch = content.match(/(\d+)\s*(?:days?|business\s*days?)/i);
    if (numMatch?.[1]) return numMatch[1];
    // Standalone number
    const pureNum = content.match(/^(\d+)$/);
    if (pureNum?.[1]) return pureNum[1];
  }

  // C.10: Number of units — extract number, strip label text
  if (fieldNum === 'C.10') {
    const numMatch = content.match(/[\d,]+(?:\.\d+)?/);
    if (numMatch) return numMatch[0].replace(/,/g, '');
  }

  // S.8: Energy consumption — extract value and unit, strip trailing section text
  // e.g., "86.68176 kWh Sources and Methodologies" → "86.68176 kWh"
  // Normalize casing: "Kwh" / "KWH" → "kWh"
  if (fieldNum === 'S.8') {
    const energyMatch = content.match(/^([\d,.]+)\s*kwh/i);
    if (energyMatch?.[1]) return `${energyMatch[1]} kWh`;
  }

  // E.4: Minimum subscription goal — strip stray leading characters from field boundary
  // e.g., "s No minimum goal" → "No minimum goal"
  if (fieldNum === 'E.4') {
    const cleaned = content.replace(/^[a-z]\s+/i, '');
    if (cleaned !== content) return cleaned;
  }

  return content;
}

/**
 * Strip "No Field Content" placeholder text that appears in PDF table cells.
 * Handles: standalone, at end of text, mid-text (between sentences), and full-value.
 */
function stripPlaceholderText(text: string): string {
  // If the entire value is just "No Field Content", return empty
  if (/^\s*No\s+Field\s+Content\s*$/i.test(text)) {
    return '';
  }

  let cleaned = text;

  // Remove standalone occurrences (full line or surrounded by whitespace/newlines)
  cleaned = cleaned.replace(/\n\s*No\s+Field\s+Content\s*(?:\n|$)/gi, '\n');

  // Remove at end of text
  cleaned = cleaned.replace(/\s*No\s+Field\s+Content\s*$/gi, '');

  // Remove mid-text occurrences (between sentences: ". No Field Content The next...")
  cleaned = cleaned.replace(/([.!?'"])\s*No\s+Field\s+Content\s+/gi, '$1 ');

  return cleaned.trim();
}

/**
 * Extract fields using label-based pattern matching as a fallback
 */
function extractFieldsByLabelPattern(text: string, rawFields: Record<string, string>): void {
  for (const fieldDef of OTHR_FIELD_DEFINITIONS) {
    // Skip if already extracted
    if (rawFields[fieldDef.number]) continue;
    // Skip dimensional and sub-fields
    if (fieldDef.isDimensional) continue;
    if (/[a-z]$/.test(fieldDef.number)) continue;

    const label = fieldDef.label;
    // Look for "FieldNumber Label Content" or "FieldNumber Label\nContent" patterns
    const escapedNum = fieldDef.number.replace('.', '\\.');
    const escapedLabel = escapeRegexSpecialChars(label);

    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapedNum}\\s+${escapedLabel}\\s+([^\\n]+(?:\\n(?![A-JS]\\.?\\d+\\s|\\d{1,2}\\s+[A-Z])[^\\n]*)*)`,
      'i'
    );

    const match = text.match(pattern);
    if (match?.[1]) {
      let content = cleanFieldContent(match[1]);
      content = cleanFieldSpecific(content, fieldDef.number);
      if (content.length >= 1) {
        rawFields[fieldDef.number] = content;
      }
    }
  }
}

/**
 * Populate fields for sections marked as "not applicable" in the PDF.
 * Detects patterns like "Part B does not apply" and fills in the related fields.
 */
function populateNotApplicableSections(text: string, rawFields: Record<string, string>): void {
  // Define section field ranges
  const sectionRanges: Record<string, { start: number; end: number }> = {
    B: { start: 2, end: 13 },  // B.2 through B.13 (B.1 is the indicator)
    C: { start: 2, end: 15 },  // C.2 through C.15 (C.1 might have explanation)
  };

  // Check for "Part B does not apply" patterns
  const partBNotApplicable = /Part\s*B\s*does\s*not\s*apply|Issuer\s*(?:is|was)\s*(?:the\s*)?same\s*as\s*(?:the\s*)?Offeror/i.test(text);
  const partCNotApplicable = /Part\s*C\s*does\s*not\s*apply|Non-?applicability\s*of\s*Part\s*C/i.test(text);

  // Fill in Part B fields if not applicable
  if (partBNotApplicable) {
    const range = sectionRanges.B;
    if (range) {
      const explanation = rawFields['B.2'] || 'Not applicable - Issuer is same as Offeror.';
      for (let i = range.start; i <= range.end; i++) {
        const fieldNum = `B.${i}`;
        if (!rawFields[fieldNum]) {
          rawFields[fieldNum] = explanation;
        }
      }
    }
  }

  // Fill in Part C fields if not applicable
  if (partCNotApplicable) {
    const range = sectionRanges.C;
    if (range) {
      const explanation = rawFields['C.1'] || 'Not applicable - White paper drafted by Offeror.';
      for (let i = range.start; i <= range.end; i++) {
        const fieldNum = `C.${i}`;
        if (!rawFields[fieldNum]) {
          rawFields[fieldNum] = explanation;
        }
      }
    }
  }
}

/**
 * Extract content by field number alone, without requiring label matching.
 * Finds the field number and captures content until the next field number marker.
 */
function extractContentByFieldNumber(text: string, fieldNum: string): string | null {
  const escapedNum = fieldNum.replace('.', '\\.');

  // Match field number at start of line or after whitespace, followed by content
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${escapedNum}\\s+(.+?)(?=\\n\\s*(?:[A-J]|S)\\.\\d+\\s|\\n\\s*\\d{2}\\s|$)`,
    's'
  );

  const match = text.match(pattern);
  if (match?.[1]) {
    const content = match[1]
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (content.length > 1) {
      return content;
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

  // First pass: Extract by section numbers and field names (MiCA table format)
  for (const mapping of MICA_SECTION_MAPPINGS) {
    // Skip if already mapped
    if (mappings.some((m) => m.path === mapping.targetPath)) continue;

    // Try section numbers with field names first
    for (const sectionNum of mapping.sectionNumbers) {
      let content: string | null = null;

      if (mapping.multiLine) {
        content = extractMultiLineTableContent(fullText, sectionNum, mapping.fieldNames);
      } else {
        content = extractTableContent(fullText, sectionNum, mapping.fieldNames);
      }

      if (content && content.length > 1) {
        // Strip trailing periods from single-line extracted values
        if (!content.includes('\n')) {
          content = content.replace(/[.]+$/, '');
        }
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
  // Scope pattern search to the relevant section when possible
  for (const mapping of MICA_SECTION_MAPPINGS) {
    if (mappings.some((m) => m.path === mapping.targetPath)) continue;

    // Determine which section text to search (prefer section-specific over full text)
    const sectionKey = mapping.targetPath.split('.')[0] || '';
    const sectionText = extraction.sections.get(sectionKey);

    // Search section text first, fall back to full text
    const textsToSearch = sectionText ? [sectionText, fullText] : [fullText];

    let found = false;
    for (const searchText of textsToSearch) {
      if (found) break;

      for (const pattern of mapping.patterns) {
        const match = searchText.match(pattern);
        if (match && match.index !== undefined) {
          // Extract content after the match
          const afterMatch = searchText.slice(match.index + match[0].length);

          // Get the next meaningful content
          let content: string;
          if (mapping.multiLine) {
            // Get multiple lines until next section or limit
            const endMatch = afterMatch.match(/\n[A-Z]\.\d+[\s.:]/);
            content = afterMatch.slice(0, endMatch?.index || 2000).trim();
          } else {
            // Get the rest of the line, stopping at next numbered item or newline
            const lineEnd = afterMatch.search(/\n\d+\.\s|\n[A-Z]\.\d|$/);
            const firstLine = afterMatch.slice(0, lineEnd === -1 ? undefined : lineEnd);
            content = firstLine.trim().slice(0, 500);
          }

          // Clean up common prefixes and placeholder text
          content = content
            .replace(/^[:\s]+/, '')
            .replace(/^(is|are|the|a|an)\s+/i, '')
            .trim();
          content = stripPlaceholderText(content);

          if (content && content.length > 2) {
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

              found = true;
              break;
            }
          }
        }
      }
    }
  }

  // Special handling: Detect public offering from context
  if (!data.partE || !(data.partE as Record<string, unknown>).isPublicOffering) {
    if (/public\s*offer|offer\s*to\s*(?:the\s*)?public|OTPC/i.test(fullText)) {
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

  // Part J: Reuse consensus mechanism from Part D if not already set
  const partD = data.partD as Record<string, unknown> | undefined;
  const partJ = data.partJ as Record<string, unknown> | undefined;
  if (partD?.consensusMechanism && (!partJ || !partJ.consensusMechanismType)) {
    setNestedValue(data, 'partJ.consensusMechanismType', partD.consensusMechanism);
    mappings.push({
      path: 'partJ.consensusMechanismType',
      value: partD.consensusMechanism,
      source: 'Copied from Part D consensus mechanism',
      confidence: 'high',
    });
  }

  // Extract ALL numbered field content as raw text for fields not covered by typed extraction
  const rawFields = extractAllRawFields(fullText);
  data.rawFields = rawFields;

  // Fill typed paths for not-applicable sections (Parts B and C).
  // populateNotApplicableSections() already fills rawFields["B.2"]–["B.13"] etc.,
  // but the editor also has typed paths (partB.legalName, partB.lei, etc.) that
  // would otherwise stay empty and show as "missing" in coverage reports.
  if (/Part\s*B\s*does\s*not\s*apply|Issuer\s*(?:is|was)\s*(?:the\s*)?same\s*as\s*(?:the\s*)?Offeror/i.test(fullText)) {
    const naText = 'Not applicable - Issuer is same as Offeror';
    if (!data.partB || !(data.partB as Record<string, unknown>).legalName) setNestedValue(data, 'partB.legalName', naText);
    if (!data.partB || !(data.partB as Record<string, unknown>).registeredAddress) setNestedValue(data, 'partB.registeredAddress', naText);
    if (!data.partB || !(data.partB as Record<string, unknown>).lei) setNestedValue(data, 'partB.lei', naText);
  }
  if (/Part\s*C\s*does\s*not\s*apply|Non-?applicability\s*of\s*Part\s*C/i.test(fullText)) {
    const naText = 'Not applicable - White paper drafted by Offeror';
    if (!data.partC || !(data.partC as Record<string, unknown>).legalName) setNestedValue(data, 'partC.legalName', naText);
    if (!data.partC || !(data.partC as Record<string, unknown>).registeredAddress) setNestedValue(data, 'partC.registeredAddress', naText);
    if (!data.partC || !(data.partC as Record<string, unknown>).lei) setNestedValue(data, 'partC.lei', naText);
  }

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
