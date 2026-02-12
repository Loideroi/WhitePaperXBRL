'use client';

/**
 * Transform Page
 *
 * Displays extracted whitepaper fields and allows editing before generating iXBRL.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { SectionEditor } from '@/components/editor';
import { ValidationDashboard, type ValidationError } from '@/components/validation';
import { IXBRLPreview } from '@/components/preview';
import type { MappedField, WhitepaperData } from '@/types/whitepaper';
import type { TokenType } from '@/types/taxonomy';

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    path: string;
    label: string;
    type: 'text' | 'boolean' | 'monetary' | 'textblock' | 'number' | 'date' | 'enumeration';
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    maxLength?: number;
    options?: Record<string, string>;
    currencyPath?: string;
  }>;
}

// Enumeration option maps for dropdown fields

// Full ISO 3166-1 country list for registered/head office country fields.
// MiCA filings may come from entities domiciled outside the EU (e.g. Switzerland).
const COUNTRY_OPTIONS: Record<string, string> = {
  // EU member states
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden',
  // EEA / EFTA
  IS: 'Iceland', LI: 'Liechtenstein', NO: 'Norway', CH: 'Switzerland',
  // Other common jurisdictions
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia',
  JP: 'Japan', SG: 'Singapore', HK: 'Hong Kong', KR: 'South Korea',
  AE: 'United Arab Emirates', BH: 'Bahrain', BR: 'Brazil', KY: 'Cayman Islands',
  CN: 'China', GI: 'Gibraltar', IN: 'India', ID: 'Indonesia', IL: 'Israel',
  MX: 'Mexico', NZ: 'New Zealand', PA: 'Panama', TH: 'Thailand', TR: 'Turkey',
  VG: 'British Virgin Islands', ZA: 'South Africa',
};

// EU member states only — used for Home/Host member state fields (F.18 etc.)
const MEMBER_STATE_OPTIONS: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden',
};

const PUBLIC_OFFERING_OPTIONS: Record<string, string> = {
  publicOffering: 'Public offering',
  admissionToTrading: 'Admission to trading',
  both: 'Both public offering and admission to trading',
};

const CURRENCY_OPTIONS: Record<string, string> = {
  EUR: 'Euro (EUR)', USD: 'US Dollar (USD)', GBP: 'British Pound (GBP)', CHF: 'Swiss Franc (CHF)',
};

const TARGETED_HOLDERS_OPTIONS: Record<string, string> = {
  allInvestors: 'All types of investors',
  retailInvestors: 'Retail investors',
  qualifiedInvestors: 'Qualified investors',
};

const PLACEMENT_FORM_OPTIONS: Record<string, string> = {
  direct: 'Direct placement',
  throughCASP: 'Through CASP',
};

const WHITE_PAPER_TYPE_OPTIONS: Record<string, string> = {
  initial: 'Initial white paper',
  modified: 'Modified white paper',
};

const SUBMISSION_TYPE_OPTIONS: Record<string, string> = {
  notification: 'Notification',
  application: 'Application for admission to trading',
};

const PERSON_TYPE_OPTIONS: Record<string, string> = {
  advisor: 'Advisor',
  auditor: 'Auditor',
  otherPerson: 'Other person',
};

// Section configurations covering all MiCA Parts (A-J) + Sustainability (S)
const SECTIONS: SectionConfig[] = [
  // ============================================================
  // Part A: Information about the Offeror
  // ============================================================
  {
    id: 'partA',
    title: 'Part A: Offeror Information',
    description: 'Information about the entity offering the crypto-asset',
    fields: [
      { path: 'partA.legalName', label: 'Legal Name (A.1)', type: 'text', required: true, placeholder: 'Enter company legal name' },
      { path: 'rawFields.A.2', label: 'Legal Form (A.2)', type: 'text', placeholder: 'e.g., Limited Liability Company' },
      { path: 'partA.registeredAddress', label: 'Registered Address (A.3)', type: 'textblock', required: true, placeholder: 'Full registered address' },
      { path: 'partA.country', label: 'Registered Country (A.3c)', type: 'enumeration', required: true, options: COUNTRY_OPTIONS, helpText: 'Country of registration (ISO 3166-1)' },
      { path: 'rawFields.A.3s', label: 'Country Subdivision (A.3s)', type: 'text', placeholder: 'Region/province' },
      { path: 'rawFields.A.4', label: 'Head Office (A.4)', type: 'text', placeholder: 'Head office address' },
      { path: 'rawFields.A.4c', label: 'Head Office Country (A.4c)', type: 'enumeration', options: COUNTRY_OPTIONS },
      { path: 'rawFields.A.5', label: 'Registration Date (A.5)', type: 'date' },
      { path: 'partA.lei', label: 'Legal Entity Identifier (A.6)', type: 'text', required: true, placeholder: '20-char LEI code', helpText: 'ISO 17442 compliant LEI', maxLength: 20 },
      { path: 'rawFields.A.7', label: 'Other National Identifier (A.7)', type: 'text', placeholder: 'National registration number' },
      { path: 'partA.contactPhone', label: 'Contact Telephone (A.8)', type: 'text', placeholder: '+31 20 123 4567' },
      { path: 'partA.contactEmail', label: 'E-mail Address (A.9)', type: 'text', placeholder: 'contact@example.com' },
      { path: 'rawFields.A.10', label: 'Response Time (days) (A.10)', type: 'number', helpText: 'Offeror complaint response time in days' },
      { path: 'rawFields.A.11', label: 'Parent Company (A.11)', type: 'text', placeholder: 'Name of parent company' },
      { path: 'rawFields.A.13', label: 'Business Activity (A.13)', type: 'textblock', placeholder: 'Describe business activities', maxLength: 5000 },
      { path: 'rawFields.A.14', label: 'Parent Company Business Activity (A.14)', type: 'textblock', placeholder: 'Parent company activities' },
      { path: 'rawFields.A.15', label: 'Newly Established (A.15)', type: 'boolean', helpText: 'Was the offeror recently established?' },
      { path: 'rawFields.A.16a', label: 'Financial Condition (3 years) (A.16a)', type: 'textblock', placeholder: 'Financial condition for past three years' },
      { path: 'rawFields.A.16b', label: 'Governance Arrangements (A.16b)', type: 'textblock', placeholder: 'Describe governance arrangements' },
      { path: 'rawFields.A.17', label: 'Financial Condition Since Registration (A.17)', type: 'textblock', placeholder: 'Financial condition since registration' },
      { path: 'partA.website', label: 'Website', type: 'text', placeholder: 'https://example.com' },
    ],
  },

  // ============================================================
  // Part B: Information about the Issuer (if different)
  // ============================================================
  {
    id: 'partB',
    title: 'Part B: Issuer Information',
    description: 'Information about the issuer (if different from offeror)',
    fields: [
      { path: 'rawFields.B.1', label: 'Issuer Different from Offeror (B.1)', type: 'boolean', helpText: 'Is the issuer different from the offeror?' },
      { path: 'partB.legalName', label: 'Issuer Name (B.2)', type: 'text', placeholder: 'Legal name of issuer' },
      { path: 'rawFields.B.3', label: 'Legal Form (B.3)', type: 'text', placeholder: 'Legal form of issuer' },
      { path: 'partB.registeredAddress', label: 'Registered Address (B.4)', type: 'text', placeholder: 'Issuer registered address' },
      { path: 'rawFields.B.4c', label: 'Registered Country (B.4c)', type: 'enumeration', options: COUNTRY_OPTIONS },
      { path: 'rawFields.B.5', label: 'Head Office (B.5)', type: 'text', placeholder: 'Issuer head office' },
      { path: 'rawFields.B.5c', label: 'Head Office Country (B.5c)', type: 'enumeration', options: COUNTRY_OPTIONS },
      { path: 'rawFields.B.6', label: 'Registration Date (B.6)', type: 'date' },
      { path: 'partB.lei', label: 'Legal Entity Identifier (B.7)', type: 'text', placeholder: '20-char LEI', maxLength: 20 },
      { path: 'rawFields.B.8', label: 'Other National Identifier (B.8)', type: 'text' },
      { path: 'rawFields.B.9', label: 'Parent Company (B.9)', type: 'text' },
      { path: 'rawFields.B.11', label: 'Business Activity (B.11)', type: 'textblock', placeholder: 'Issuer business activities' },
      { path: 'rawFields.B.12', label: 'Parent Company Business Activity (B.12)', type: 'textblock' },
      { path: 'rawFields.B.13', label: 'Third-Party Roles (B.13)', type: 'textblock', placeholder: 'Describe third-party roles' },
    ],
  },

  // ============================================================
  // Part C: Operator of Trading Platform
  // ============================================================
  {
    id: 'partC',
    title: 'Part C: Trading Platform Operator',
    description: 'Information about the operator of the trading platform (if applicable)',
    fields: [
      { path: 'partC.legalName', label: 'Operator Name (C.1)', type: 'text', placeholder: 'Legal name of operator' },
      { path: 'rawFields.C.2', label: 'Legal Form (C.2)', type: 'text' },
      { path: 'partC.registeredAddress', label: 'Registered Address (C.3)', type: 'text' },
      { path: 'rawFields.C.3c', label: 'Registered Country (C.3c)', type: 'enumeration', options: COUNTRY_OPTIONS },
      { path: 'rawFields.C.4', label: 'Head Office (C.4)', type: 'text' },
      { path: 'rawFields.C.4c', label: 'Head Office Country (C.4c)', type: 'enumeration', options: COUNTRY_OPTIONS },
      { path: 'rawFields.C.5', label: 'Registration Date (C.5)', type: 'date' },
      { path: 'partC.lei', label: 'Legal Entity Identifier (C.6)', type: 'text', placeholder: '20-char LEI', maxLength: 20 },
      { path: 'rawFields.C.7', label: 'Other National Identifier (C.7)', type: 'text' },
      { path: 'rawFields.C.8', label: 'Parent Company (C.8)', type: 'text' },
      { path: 'rawFields.C.10', label: 'Number of Units (C.10)', type: 'number', helpText: 'Total units to be admitted to trading' },
      { path: 'rawFields.C.11', label: 'Business Activity (C.11)', type: 'textblock' },
      { path: 'rawFields.C.12a', label: 'Explicit Consequences (C.12a)', type: 'textblock' },
      { path: 'rawFields.C.12b', label: 'Parent Company Business Activity (C.12b)', type: 'textblock' },
      { path: 'rawFields.C.13a', label: 'Offer Phases (C.13a)', type: 'textblock' },
      { path: 'rawFields.C.13b', label: 'Other Persons Drawing Up White Paper (C.13b)', type: 'textblock' },
      { path: 'rawFields.C.14', label: 'Reason for Drawing White Paper (C.14)', type: 'textblock' },
      { path: 'rawFields.C.15', label: 'Reason for Preparation (C.15)', type: 'textblock' },
    ],
  },

  // ============================================================
  // Part D: Crypto-Asset Project
  // ============================================================
  {
    id: 'partD',
    title: 'Part D: Project Information',
    description: 'Details about the crypto-asset project',
    fields: [
      { path: 'partD.cryptoAssetName', label: 'Crypto-Asset Name (D.2)', type: 'text', required: true, placeholder: 'Name of the token' },
      { path: 'partD.cryptoAssetSymbol', label: 'Ticker Symbol (D.3)', type: 'text', required: true, placeholder: 'e.g., BTC, ETH', maxLength: 10 },
      { path: 'partD.projectDescription', label: 'Project Description (D.4)', type: 'textblock', required: true, placeholder: 'Describe the project purpose and functionality', maxLength: 5000 },
      { path: 'rawFields.D.5', label: 'Modification Conditions (D.5)', type: 'textblock', placeholder: 'Conditions for rights/obligations modification' },
      { path: 'rawFields.D.6', label: 'Utility Token Classification (D.6)', type: 'boolean', helpText: 'Is this classified as a utility token?' },
      { path: 'rawFields.D.7', label: 'Key Features of Goods/Services (D.7)', type: 'textblock', placeholder: 'For utility token projects' },
      { path: 'rawFields.D.8', label: 'Planned Functional Use Date (D.8)', type: 'date', helpText: 'Date when token functionality becomes operational' },
      { path: 'rawFields.D.9', label: 'Token Value Protection Schemes (D.9)', type: 'boolean' },
      { path: 'rawFields.D.10', label: 'Protection Schemes Description (D.10)', type: 'textblock' },
      { path: 'rawFields.D.11', label: 'Compensation Schemes (D.11)', type: 'boolean' },
      { path: 'rawFields.D.12', label: 'Compensation Schemes Description (D.12)', type: 'textblock' },
      { path: 'rawFields.D.13', label: 'Planned Use of Collected Funds (D.13)', type: 'textblock', placeholder: 'How collected funds will be used' },
      { path: 'rawFields.D.14', label: 'Resource Allocation (D.14)', type: 'textblock', placeholder: 'Resource allocation details' },
      { path: 'partD.totalSupply', label: 'Total Supply', type: 'number', required: true, placeholder: 'Maximum token supply' },
      { path: 'partD.tokenStandard', label: 'Token Standard', type: 'text', placeholder: 'e.g., ERC-20, BEP-20' },
      { path: 'partD.blockchainNetwork', label: 'Blockchain Network', type: 'text', placeholder: 'e.g., Ethereum, Chiliz Chain' },
      { path: 'partD.consensusMechanism', label: 'Consensus Mechanism', type: 'text', placeholder: 'e.g., Proof of Stake' },
    ],
  },

  // ============================================================
  // Part E: Offer to the Public / Admission to Trading
  // ============================================================
  {
    id: 'partE',
    title: 'Part E: Offering Details',
    description: 'Information about the public offering or admission to trading',
    fields: [
      { path: 'rawFields.E.1', label: 'Public Offering or Admission (E.1)', type: 'enumeration', options: PUBLIC_OFFERING_OPTIONS, helpText: 'Type of offering' },
      { path: 'rawFields.E.2', label: 'Reasons for Public Offer (E.2)', type: 'textblock' },
      { path: 'partE.maxSubscriptionGoal', label: 'Max Subscription Goal (E.3)', type: 'monetary', placeholder: '0.00', currencyPath: 'partE.maxSubscriptionGoalCurrency' },
      { path: 'rawFields.E.3a', label: 'Max Subscription (units) (E.3a)', type: 'number' },
      { path: 'rawFields.E.4', label: 'Min Subscription Goal (E.4)', type: 'monetary', helpText: 'Minimum in currency' },
      { path: 'rawFields.E.5', label: 'Fundraising Target (E.5)', type: 'monetary' },
      { path: 'rawFields.E.6', label: 'Oversubscription Acceptance (E.6)', type: 'boolean' },
      { path: 'rawFields.E.7', label: 'Oversubscription Allocation (E.7)', type: 'textblock' },
      { path: 'partE.tokenPrice', label: 'Issue Price (E.8)', type: 'monetary', placeholder: '0.00', currencyPath: 'partE.tokenPriceCurrency' },
      { path: 'rawFields.E.9', label: 'Currency for Issue Price (E.9)', type: 'enumeration', options: CURRENCY_OPTIONS },
      { path: 'rawFields.E.9a', label: 'Other Tokens for Issue Price (E.9a)', type: 'text' },
      { path: 'rawFields.E.10', label: 'Subscription Fee (E.10)', type: 'monetary' },
      { path: 'rawFields.E.11', label: 'Price Determination Method (E.11)', type: 'textblock' },
      { path: 'rawFields.E.12', label: 'Total Tokens Offered (E.12)', type: 'number' },
      { path: 'rawFields.E.13', label: 'Targeted Holders (E.13)', type: 'enumeration', options: TARGETED_HOLDERS_OPTIONS },
      { path: 'rawFields.E.14', label: 'Holder Restrictions (E.14)', type: 'textblock' },
      { path: 'rawFields.E.15', label: 'Reimbursement Notice (E.15)', type: 'boolean' },
      { path: 'rawFields.E.16', label: 'Refund Mechanism (E.16)', type: 'textblock' },
      { path: 'rawFields.E.17', label: 'Refund Timeline (E.17)', type: 'textblock' },
      { path: 'rawFields.E.18', label: 'Offer Phases (E.18)', type: 'textblock' },
      { path: 'rawFields.E.19', label: 'Early Purchase Discount (E.19)', type: 'textblock' },
      { path: 'rawFields.E.20', label: 'Time-Limited Offer (E.20)', type: 'boolean' },
      { path: 'partE.publicOfferingStartDate', label: 'Subscription Start (E.21)', type: 'date' },
      { path: 'partE.publicOfferingEndDate', label: 'Subscription End (E.22)', type: 'date' },
      { path: 'rawFields.E.23', label: 'Safeguarding Arrangements (E.23)', type: 'textblock' },
      { path: 'rawFields.E.24', label: 'Payment Methods (E.24)', type: 'textblock' },
      { path: 'rawFields.E.25', label: 'Reimbursement Methods (E.25)', type: 'textblock' },
      { path: 'partE.withdrawalRights', label: 'Withdrawal Rights (E.26)', type: 'boolean', helpText: 'Are purchasers entitled to withdrawal rights?' },
      { path: 'rawFields.E.27', label: 'Transfer of Purchased Tokens (E.27)', type: 'textblock' },
      { path: 'rawFields.E.28', label: 'Transfer Time Schedule (E.28)', type: 'text' },
      { path: 'rawFields.E.29', label: 'Purchaser Technical Requirements (E.29)', type: 'textblock' },
      { path: 'rawFields.E.30', label: 'CASP Name (E.30)', type: 'text' },
      { path: 'rawFields.E.31', label: 'CASP LEI (E.31)', type: 'text', maxLength: 20 },
      { path: 'rawFields.E.32', label: 'Placement Form (E.32)', type: 'enumeration', options: PLACEMENT_FORM_OPTIONS },
      { path: 'rawFields.E.33', label: 'Trading Platform Name (E.33)', type: 'text' },
      { path: 'rawFields.E.34', label: 'Trading Platform MIC (E.34)', type: 'text' },
      { path: 'rawFields.E.35', label: 'Trading Platform Access (E.35)', type: 'textblock' },
      { path: 'rawFields.E.36', label: 'Involved Costs (E.36)', type: 'textblock' },
      { path: 'rawFields.E.37', label: 'Offer Expenses (E.37)', type: 'textblock' },
      { path: 'rawFields.E.38', label: 'Conflicts of Interest (E.38)', type: 'textblock' },
      { path: 'rawFields.E.39', label: 'Applicable Law (E.39)', type: 'textblock' },
      { path: 'rawFields.E.40', label: 'Competent Court (E.40)', type: 'textblock' },
    ],
  },

  // ============================================================
  // Part F: Information about the Crypto-Asset
  // ============================================================
  {
    id: 'partF',
    title: 'Part F: Crypto-Asset Information',
    description: 'Technical and regulatory details about the crypto-asset',
    fields: [
      { path: 'partF.classification', label: 'Token Type (F.1)', type: 'text', required: true },
      { path: 'rawFields.F.2', label: 'Token Functionality (F.2)', type: 'textblock' },
      { path: 'rawFields.F.3', label: 'Planned Application (F.3)', type: 'textblock' },
      { path: 'rawFields.F.4', label: 'Type of White Paper (F.4)', type: 'enumeration', options: WHITE_PAPER_TYPE_OPTIONS },
      { path: 'rawFields.F.5', label: 'Type of Submission (F.5)', type: 'enumeration', options: SUBMISSION_TYPE_OPTIONS },
      { path: 'rawFields.F.6', label: 'Token Characteristics (F.6)', type: 'textblock' },
      { path: 'rawFields.F.7', label: 'Commercial/Trading Name (F.7)', type: 'text' },
      { path: 'rawFields.F.8', label: 'Issuer Website (F.8)', type: 'text', placeholder: 'https://...' },
      { path: 'rawFields.F.9', label: 'Offer Starting Date (F.9)', type: 'date' },
      { path: 'rawFields.F.10', label: 'Publication Date (F.10)', type: 'date' },
      { path: 'rawFields.F.11', label: 'Other Services (F.11)', type: 'textblock' },
      { path: 'rawFields.F.12', label: 'White Paper Languages (F.12)', type: 'text' },
      { path: 'rawFields.F.13', label: 'Digital Token Identifier (F.13)', type: 'text', helpText: 'DTI code if available' },
      { path: 'rawFields.F.14', label: 'Fungible Group DTI (F.14)', type: 'text' },
      { path: 'rawFields.F.15', label: 'Voluntary Data Flag (F.15)', type: 'boolean' },
      { path: 'rawFields.F.16', label: 'Personal Data Flag (F.16)', type: 'boolean' },
      { path: 'rawFields.F.17', label: 'LEI Eligibility (F.17)', type: 'boolean' },
      { path: 'rawFields.F.18', label: 'Home Member State (F.18)', type: 'enumeration', options: MEMBER_STATE_OPTIONS },
      { path: 'partF.rightsDescription', label: 'Rights Description', type: 'textblock', required: true },
    ],
  },

  // ============================================================
  // Part G: Rights and Obligations
  // ============================================================
  {
    id: 'partG',
    title: 'Part G: Rights and Obligations',
    description: 'Purchaser rights, obligations, and token supply mechanisms',
    fields: [
      { path: 'partG.purchaseRights', label: 'Purchaser Rights (G.1)', type: 'textblock', placeholder: 'Describe rights attached to the token' },
      { path: 'rawFields.G.2', label: 'Exercise of Rights (G.2)', type: 'textblock' },
      { path: 'rawFields.G.3', label: 'Modification Conditions (G.3)', type: 'textblock' },
      { path: 'rawFields.G.4', label: 'Future Public Offers (G.4)', type: 'textblock' },
      { path: 'rawFields.G.5', label: 'Issuer Retained Tokens (G.5)', type: 'number', helpText: 'Number of tokens retained by issuer' },
      { path: 'rawFields.G.6', label: 'Utility Token Classification (G.6)', type: 'boolean' },
      { path: 'rawFields.G.7', label: 'Key Features (Utility) (G.7)', type: 'textblock' },
      { path: 'rawFields.G.8', label: 'Utility Token Redemption (G.8)', type: 'textblock' },
      { path: 'rawFields.G.9', label: 'Non-Trading Request (G.9)', type: 'boolean' },
      { path: 'rawFields.G.10', label: 'Purchase/Sale Modalities (G.10)', type: 'textblock' },
      { path: 'partG.transferRestrictions', label: 'Transfer Restrictions (G.11)', type: 'textblock' },
      { path: 'rawFields.G.12', label: 'Supply Adjustment Protocols (G.12)', type: 'boolean' },
      { path: 'partG.dynamicSupplyMechanism', label: 'Supply Adjustment Mechanisms (G.13)', type: 'textblock' },
      { path: 'rawFields.G.14', label: 'Token Value Protection (G.14)', type: 'boolean' },
      { path: 'rawFields.G.15', label: 'Protection Schemes Description (G.15)', type: 'textblock' },
      { path: 'rawFields.G.16', label: 'Compensation Schemes (G.16)', type: 'boolean' },
      { path: 'rawFields.G.17', label: 'Compensation Description (G.17)', type: 'textblock' },
      { path: 'rawFields.G.18', label: 'Applicable Law (G.18)', type: 'textblock' },
      { path: 'rawFields.G.19', label: 'Competent Court (G.19)', type: 'textblock' },
    ],
  },

  // ============================================================
  // Part H: Underlying Technology
  // ============================================================
  {
    id: 'partH',
    title: 'Part H: Technology',
    description: 'Technical details about the underlying blockchain and DLT',
    fields: [
      { path: 'partH.blockchainDescription', label: 'DLT Description (H.1)', type: 'textblock', required: true, placeholder: 'Describe the distributed ledger technology', maxLength: 5000 },
      { path: 'rawFields.H.2', label: 'Protocols & Standards (H.2)', type: 'textblock' },
      { path: 'rawFields.H.3', label: 'Technology Used (H.3)', type: 'textblock' },
      { path: 'rawFields.H.4', label: 'Consensus Mechanism (H.4)', type: 'textblock' },
      { path: 'rawFields.H.5', label: 'Incentive Mechanisms & Fees (H.5)', type: 'textblock' },
      { path: 'rawFields.H.6', label: 'Uses DLT (H.6)', type: 'boolean' },
      { path: 'rawFields.H.7', label: 'DLT Functionality (H.7)', type: 'textblock' },
      { path: 'rawFields.H.8', label: 'Audit Conducted (H.8)', type: 'boolean' },
      { path: 'rawFields.H.9', label: 'Audit Outcome (H.9)', type: 'textblock' },
      { path: 'partH.smartContractInfo', label: 'Smart Contract Information', type: 'textblock', placeholder: 'Contract addresses and details' },
    ],
  },

  // ============================================================
  // Part I: Risk Disclosure & Compliance
  // ============================================================
  {
    id: 'partI',
    title: 'Part I: Risk Disclosure',
    description: 'Risk factors and compliance statements',
    fields: [
      { path: 'rawFields.I.1', label: 'Offer-Related Risks (I.1)', type: 'textblock', required: true, placeholder: 'Describe risks related to the offering' },
      { path: 'rawFields.I.2', label: 'Issuer-Related Risks (I.2)', type: 'textblock', required: true },
      { path: 'rawFields.I.02a', label: 'Issuer Responsibility Statement (I.02a)', type: 'boolean' },
      { path: 'rawFields.I.02b', label: 'Value & Transferability Risks Statement (I.02b)', type: 'boolean' },
      { path: 'rawFields.I.03', label: 'Information Accuracy Statement (I.03)', type: 'boolean' },
      { path: 'rawFields.I.3', label: 'Token-Related Risks (I.3)', type: 'textblock', required: true },
      { path: 'rawFields.I.4', label: 'Project Implementation Risks (I.4)', type: 'textblock' },
      { path: 'rawFields.I.5', label: 'Technology-Related Risks (I.5)', type: 'textblock', required: true },
      { path: 'rawFields.I.6', label: 'Mitigation Measures (I.6)', type: 'textblock' },
      { path: 'rawFields.I.07', label: 'Key Information About Offer (I.07)', type: 'textblock' },
    ],
  },

  // ============================================================
  // Part J: Environmental Impact
  // ============================================================
  {
    id: 'partJ',
    title: 'Part J: Sustainability',
    description: 'Environmental impact and adverse climate impacts',
    fields: [
      { path: 'rawFields.J.1', label: 'Adverse Environmental Impacts (J.1)', type: 'textblock', placeholder: 'Describe adverse climate impacts' },
      { path: 'partJ.energyConsumption', label: 'Energy Consumption (kWh)', type: 'number', placeholder: 'Annual energy consumption' },
      { path: 'partJ.consensusMechanismType', label: 'Consensus Mechanism Type', type: 'text', placeholder: 'e.g., PoS, PoW' },
      { path: 'partJ.renewableEnergyPercentage', label: 'Renewable Energy %', type: 'number', placeholder: '0-100', helpText: 'Percentage of energy from renewable sources' },
    ],
  },

  // ============================================================
  // Sustainability Indicators (Annex III)
  // ============================================================
  {
    id: 'sustainability',
    title: 'Annex III: Sustainability Indicators',
    description: 'Detailed energy and GHG emission metrics (Annex III)',
    fields: [
      { path: 'rawFields.S.1', label: 'Name (S.1)', type: 'text' },
      { path: 'rawFields.S.2', label: 'Relevant LEI (S.2)', type: 'text' },
      { path: 'rawFields.S.3', label: 'Crypto-Asset Name (S.3)', type: 'text' },
      { path: 'rawFields.S.4', label: 'Consensus Mechanism (S.4)', type: 'textblock' },
      { path: 'rawFields.S.5', label: 'Incentive Mechanisms & Fees (S.5)', type: 'textblock' },
      { path: 'rawFields.S.6', label: 'Beginning of Period (S.6)', type: 'date' },
      { path: 'rawFields.S.7', label: 'End of Period (S.7)', type: 'date' },
      { path: 'rawFields.S.8', label: 'Energy Consumption (S.8)', type: 'text', helpText: 'Total energy consumption value' },
      { path: 'rawFields.S.9', label: 'Energy Sources & Methodologies (S.9)', type: 'textblock' },
      { path: 'rawFields.S.10', label: 'Renewable Energy % (S.10)', type: 'number', helpText: 'Percentage as decimal (0.81 = 81%)' },
      { path: 'rawFields.S.11', label: 'Energy Intensity (S.11)', type: 'text' },
      { path: 'rawFields.S.12', label: 'Scope 1 GHG Emissions (S.12)', type: 'text' },
      { path: 'rawFields.S.13', label: 'Scope 2 GHG Emissions (S.13)', type: 'text' },
      { path: 'rawFields.S.14', label: 'GHG Intensity (S.14)', type: 'text' },
      { path: 'rawFields.S.15', label: 'Key Energy Sources (S.15)', type: 'textblock' },
      { path: 'rawFields.S.16', label: 'Key GHG Sources (S.16)', type: 'textblock' },
      { path: 'rawFields.S.17', label: 'Energy Mix % (S.17)', type: 'number' },
      { path: 'rawFields.S.18', label: 'Energy Use Reduction (S.18)', type: 'text' },
      { path: 'rawFields.S.19', label: 'Carbon Intensity (S.19)', type: 'number' },
      { path: 'rawFields.S.20', label: 'Scope 3 GHG Emissions (S.20)', type: 'text' },
    ],
  },
];

type LoadingState = 'idle' | 'processing' | 'success' | 'error';
type GenerateState = 'idle' | 'validating' | 'generating' | 'preview' | 'complete' | 'error';

export default function TransformPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Partial<WhitepaperData>>({});
  const [mappings, setMappings] = useState<MappedField[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [pages, setPages] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tokenType, setTokenType] = useState<TokenType>('OTHR');

  // Generation state
  const [generateState, setGenerateState] = useState<GenerateState>('idle');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [forcedExpandSection, setForcedExpandSection] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Load processed data from localStorage on mount
  useEffect(() => {
    function loadSessionData() {
      setLoadingState('processing');
      setError(null);

      try {
        // Read from localStorage (data was stored during upload)
        const storedData = localStorage.getItem(`whitepaper-${sessionId}`);

        if (!storedData) {
          throw new Error('Session not found. Please upload your PDF again.');
        }

        const sessionData = JSON.parse(storedData);

        setData(sessionData.mapping.data as Partial<WhitepaperData>);
        setMappings(sessionData.mapping.mappings as MappedField[]);
        setFilename(sessionData.filename);
        setPages(sessionData.extraction.pages);
        setConfidence(sessionData.mapping.confidence.overall);

        // Set token type from the session data
        if (sessionData.tokenType) {
          setTokenType(sessionData.tokenType as TokenType);
        }

        setLoadingState('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session data');
        setLoadingState('error');
      }
    }

    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  // Handle field changes
  const handleFieldChange = useCallback((path: string, value: unknown) => {
    setData((prev) => {
      const newData = { ...prev };

      // rawFields keys contain dots (e.g., "A.2", "E.14") — treat as single key
      if (path.startsWith('rawFields.')) {
        const rawFieldKey = path.slice('rawFields.'.length);
        const rawFields = { ...(newData.rawFields || {}) };
        rawFields[rawFieldKey] = value as string;
        newData.rawFields = rawFields;
        return newData as Partial<WhitepaperData>;
      }

      const parts = path.split('.');
      let current: Record<string, unknown> = newData as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (part) {
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
      }

      const lastPart = parts[parts.length - 1];
      if (lastPart) {
        current[lastPart] = value;
      }

      return newData as Partial<WhitepaperData>;
    });

    // Clear error for this field
    setErrors((prev) => {
      const { [path]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  // Handle validation
  const handleValidate = useCallback(async () => {
    setGenerateState('validating');
    setGenerateError(null);
    setValidationErrors([]);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { ...data, tokenType },
          tokenType,
          options: { quickMode: false },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Validation failed');
      }

      // Map API errors to ValidationDashboard format
      const errors: ValidationError[] = [
        ...(result.data.errors || []).map((e: { message: string; fieldPath?: string; ruleId?: string }) => ({
          path: e.fieldPath || 'unknown',
          message: e.message,
          severity: 'error' as const,
          code: e.ruleId,
        })),
        ...(result.data.warnings || []).map((w: { message: string; fieldPath?: string; ruleId?: string }) => ({
          path: w.fieldPath || 'unknown',
          message: w.message,
          severity: 'warning' as const,
          code: w.ruleId,
        })),
      ];

      setValidationErrors(errors);
      setShowValidation(true);

      const hasErrors = errors.filter((e) => e.severity === 'error').length > 0;

      // Reset button state - validation panel remains visible via showValidation
      setGenerateState('idle');

      if (hasErrors || errors.length > 0) {
        // Scroll to validation panel to make results clearly visible
        setTimeout(() => {
          document.getElementById('validation-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }

      return !hasErrors;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Validation failed');
      setGenerateState('error');
      setShowValidation(false);
      // Scroll to error message
      setTimeout(() => {
        document.getElementById('generation-error')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return false;
    }
  }, [data, tokenType]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    // First validate
    const isValid = await handleValidate();

    if (!isValid) {
      // handleValidate already set appropriate state ('idle' for validation errors, 'error' for exceptions)
      return;
    }

    // Then generate
    setGenerateState('generating');

    try {
      // Generate iXBRL
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { ...data, tokenType, documentDate: new Date().toISOString().split('T')[0] },
          format: 'ixbrl',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Generation failed');
      }

      // Get the blob for download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let outputFilename = `whitepaper-${data.partD?.cryptoAssetSymbol?.toLowerCase() || 'crypto'}.xhtml`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          outputFilename = match[1];
        }
      }

      // Also fetch preview content
      const previewResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { ...data, tokenType, documentDate: new Date().toISOString().split('T')[0] },
          format: 'ixbrl',
        }),
      });

      if (previewResponse.ok) {
        const previewText = await previewResponse.text();
        setPreviewContent(previewText);
      }

      setGenerateState('complete');

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = outputFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
      setGenerateState('error');
    }
  }, [data, tokenType, handleValidate]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    setGenerateState('generating');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { ...data, tokenType, documentDate: new Date().toISOString().split('T')[0] },
          format: 'ixbrl',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Preview generation failed');
      }

      const content = await response.text();
      setPreviewContent(content);
      setGenerateState('preview');
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Preview failed');
      setGenerateState('error');
    }
  }, [data, tokenType]);

  // Cleanup download URL on unmount
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  // Loading state
  if (loadingState === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <p className="mt-4 text-lg font-medium">Processing your whitepaper...</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Extracting text and mapping fields
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadingState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="mt-4 text-lg font-medium text-destructive">Processing Failed</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={handleBack}
            className="mt-6 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold">Edit Whitepaper Fields</h1>
              <p className="text-xs text-muted-foreground">{filename}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={generateState === 'generating' || generateState === 'validating'}
              className="px-3 py-2 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateState === 'generating' || generateState === 'validating'}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {generateState === 'validating' && <Loader2 className="h-4 w-4 animate-spin" />}
              {generateState === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
              {generateState === 'validating' ? 'Validating...' : generateState === 'generating' ? 'Generating...' : 'Generate iXBRL'}
            </button>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b bg-muted/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{pages} pages</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                confidence >= 70
                  ? 'bg-green-100 text-green-700'
                  : confidence >= 50
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {confidence}% extraction confidence
            </span>
          </div>
          <div className="flex items-center gap-2">
            {mappings.length > 0 && (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{mappings.length} fields auto-extracted</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Validation Panel */}
          {showValidation && (
            <div id="validation-panel" className="relative rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 shadow-md">
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                    {validationErrors.filter(e => e.severity === 'error').length > 0
                      ? `${validationErrors.filter(e => e.severity === 'error').length} validation error(s) must be fixed before generating`
                      : 'Validation complete'}
                  </span>
                </div>
                <button
                  onClick={() => setShowValidation(false)}
                  className="p-1 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 z-10"
                  aria-label="Close validation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-4 pb-3">
                <ValidationDashboard
                  errors={validationErrors}
                  isValidating={generateState === 'validating'}
                  onFieldClick={(path) => {
                    // Determine section from path (rawFields.A.2 → partA, partB.lei → partB)
                    let sectionId: string;
                    if (path.startsWith('rawFields.')) {
                      const fieldKey = path.slice('rawFields.'.length);
                      const letter = fieldKey.charAt(0).toUpperCase();
                      const letterToSection: Record<string, string> = {
                        A: 'partA', B: 'partB', C: 'partC', D: 'partD',
                        E: 'partE', F: 'partF', G: 'partG', H: 'partH',
                        I: 'partI', J: 'partJ', S: 'sustainability',
                      };
                      sectionId = letterToSection[letter] || 'partA';
                    } else {
                      sectionId = path.split('.')[0] || 'partA';
                    }

                    // Force-expand the target section
                    setForcedExpandSection(sectionId);

                    // Scroll to section, then to the specific field
                    setTimeout(() => {
                      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
                      setTimeout(() => {
                        const fieldEl = document.getElementById(path);
                        if (fieldEl) {
                          fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          fieldEl.focus();
                        }
                      }, 300);
                    }, 50);
                  }}
                />
              </div>
            </div>
          )}

          {/* Generation Error */}
          {generateState === 'error' && generateError && (
            <div id="generation-error" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 shadow-md">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="font-medium text-destructive">Generation Failed</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{generateError}</p>
            </div>
          )}

          {/* Success Message */}
          {generateState === 'complete' && (
            <div className="rounded-lg border border-green-500 bg-green-500/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-600">iXBRL Generated Successfully</span>
                </div>
                {downloadUrl && (
                  <a
                    ref={downloadRef}
                    href={downloadUrl}
                    download={`whitepaper-${data.partD?.cryptoAssetSymbol?.toLowerCase() || 'crypto'}.xhtml`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download Again
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Section Editors */}
          {SECTIONS.map((section) => (
            <SectionEditor
              key={section.id}
              sectionId={section.id}
              title={section.title}
              description={section.description}
              fields={section.fields}
              data={data as Record<string, unknown>}
              mappings={mappings}
              errors={errors}
              onFieldChange={handleFieldChange}
              defaultExpanded={section.id === 'partA'}
              expanded={forcedExpandSection === section.id}
            />
          ))}
        </div>
      </main>

      {/* Preview Modal */}
      {generateState === 'preview' && previewContent && (
        <IXBRLPreview
          content={previewContent}
          filename={`whitepaper-${data.partD?.cryptoAssetSymbol?.toLowerCase() || 'crypto'}.xhtml`}
          onClose={() => setGenerateState('idle')}
          onDownload={handleGenerate}
        />
      )}

      {/* Footer */}
      <footer className="border-t bg-background py-4 sticky bottom-0">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Review and complete all required fields before generating
            </p>
            {/* Token Type Badge */}
            <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-semibold">
              {tokenType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleValidate()}
              disabled={generateState === 'generating' || generateState === 'validating'}
              className="px-4 py-2 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Validate Only
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateState === 'generating' || generateState === 'validating'}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {(generateState === 'validating' || generateState === 'generating') && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {generateState === 'validating'
                ? 'Validating...'
                : generateState === 'generating'
                  ? 'Generating...'
                  : 'Generate iXBRL'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
