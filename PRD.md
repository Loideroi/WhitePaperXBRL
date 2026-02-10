# Product Requirements Document (PRD)
# WhitePaper XBRL Transformation Platform

**Version:** 1.0
**Date:** January 27, 2026
**Author:** Claude Code
**Status:** In Progress (Phases 0-6 complete, Phase 7 in progress, Phase 8 not started)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Objectives](#3-goals-and-objectives)
4. [Regulatory Context](#4-regulatory-context)
5. [User Personas](#5-user-personas)
6. [Functional Requirements](#6-functional-requirements)
7. [Technical Requirements](#7-technical-requirements)
8. [User Flows](#8-user-flows)
9. [Data Requirements](#9-data-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Success Metrics](#11-success-metrics)
12. [Risks and Mitigations](#12-risks-and-mitigations)
13. [Implementation Phases](#13-implementation-phases)
14. [Appendices](#appendices)

---

## 1. Executive Summary

### 1.1 Product Overview

WhitePaper XBRL is a web-based platform that enables legal representatives and compliance teams to transform crypto-asset whitepaper documents (PDF, DOCX, ODT, RTF) into XBRL-compliant files that meet the requirements of the Markets in Crypto-Assets Regulation (MiCA) under EU law and Malta's regulatory framework.

### 1.2 Key Value Proposition

- **Compliance Automation**: Transform human-readable whitepapers into machine-readable iXBRL format as mandated by Commission Implementing Regulation (EU) 2024/2984
- **Regulatory Alignment**: Full compliance with ESMA's MiCA taxonomy (effective March 31, 2025) and Malta's MFSA requirements
- **User-Friendly**: Simple upload-and-transform workflow for non-technical legal representatives
- **Validation**: Built-in validation against ESMA's 488 assertion rules before submission

### 1.3 Target Users

- Legal representatives at crypto-asset issuers
- Compliance officers
- VFA Agents (Malta-specific)
- Regulatory affairs teams

---

## 2. Problem Statement

### 2.1 Current Challenges

1. **Regulatory Mandate**: As of December 23, 2025, all MiCA crypto-asset whitepapers must be submitted in Inline XBRL (iXBRL) format. PDF-only submissions are no longer accepted.

2. **Technical Complexity**: Creating iXBRL documents requires specialized knowledge of:
   - XBRL 2.1 core standard
   - ESMA's MiCA taxonomy structure
   - Inline XBRL 1.1 specifications
   - Extensible Enumerations 2.0
   - Formula validation assertions

3. **Manual Process**: Currently, issuers must either:
   - Hire specialized XBRL consultants
   - Purchase expensive commercial software
   - Manually tag documents using complex tools

4. **Validation Burden**: 488 validation assertions must pass before submission to National Competent Authorities (NCAs)

### 2.2 Opportunity

Create a streamlined, self-service platform where legal representatives can upload a PDF whitepaper and receive a validated, submission-ready iXBRL file with minimal manual intervention.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Simplify Compliance** | Enable non-technical users to produce compliant iXBRL files | 90% of users complete transformation without support |
| **Ensure Accuracy** | Validate against all ESMA taxonomy rules | 100% pass rate on ESMA validation assertions |
| **Reduce Time** | Minimize time from PDF to submission-ready file | < 30 minutes for standard whitepaper |
| **Support All Token Types** | Handle OTHR, ART, and EMT token whitepapers | Full support for all 3 entry points |

### 3.2 Secondary Goals

- Support all 24 EU official languages
- Provide audit trail for regulatory submissions
- Enable batch processing for multiple whitepapers
- Offer API access for programmatic integration

---

## 4. Regulatory Context

### 4.1 European Union (MiCA Regulation)

**Legal Basis:**
- **Primary Regulation**: EU 2023/1114 (Markets in Crypto-Assets Regulation)
- **Technical Standard**: Commission Implementing Regulation (EU) 2024/2984
- **Effective Date**: December 23, 2025 (XBRL format mandatory)
- **Taxonomy Version**: ESMA MiCA Taxonomy 2025-03-31

**Key Requirements:**
- Whitepapers MUST be in Inline XBRL 1.1 format within a single XHTML file
- Valid Legal Entity Identifier (LEI) required and automatically verified
- Submission to National Competent Authority (NCA) of home Member State
- Must pass all ERROR-level formula assertions

### 4.2 Malta (MFSA Requirements)

**Framework:**
- Malta transitioned from Virtual Financial Assets (VFA) Act to MiCA regime
- MFSA now issues only CASP (Crypto-Asset Service Provider) authorizations under MiCA
- Whitepapers must be notified to MFSA as the home NCA for Malta-based issuers
- VFA Agent endorsement required for compliance confirmation

**Transition Timeline:**
- Existing VFA license holders must complete grandfathering process
- New applications follow MiCA-only pathway
- Application forms available on MFSA website

### 4.3 Token Type Classifications

| Entry Point | Token Type | Description |
|-------------|------------|-------------|
| Table 2 | OTHR | Crypto-assets other than ART or EMT (e.g., utility tokens, fan tokens) |
| Table 3 | ART | Asset-Referenced Tokens (backed by basket of assets) |
| Table 4 | EMT | E-Money Tokens (stablecoins representing fiat currency) |

---

## 5. User Personas

### 5.1 Primary Persona: Legal Representative

**Name:** Maria, Legal Counsel
**Company:** Crypto-asset issuer (fan token platform)
**Technical Level:** Low-Medium
**Goals:**
- Submit compliant whitepaper to NCA quickly
- Avoid hiring external XBRL consultants
- Ensure no validation errors before submission

**Pain Points:**
- No XBRL expertise in-house
- Tight regulatory deadlines
- Fear of rejection due to technical formatting issues

**Needs:**
- Simple upload interface
- Clear guidance on required fields
- Pre-submission validation
- Downloadable, submission-ready file

### 5.2 Secondary Persona: Compliance Officer

**Name:** Thomas, Head of Compliance
**Company:** Multi-token issuer with multiple whitepapers
**Technical Level:** Medium
**Goals:**
- Process multiple whitepapers efficiently
- Maintain audit trail for regulators
- Ensure consistency across submissions

**Needs:**
- Batch processing capability
- Version history and tracking
- Export audit logs
- Template management

### 5.3 Tertiary Persona: VFA Agent (Malta-specific)

**Name:** Sarah, VFA Agent
**Company:** Licensed advisory firm
**Technical Level:** High
**Goals:**
- Review and endorse client whitepapers
- Verify compliance before NCA notification
- Provide value-added services to clients

**Needs:**
- Review mode for client documents
- Validation report generation
- Multi-client dashboard
- API integration for workflow

---

## 6. Functional Requirements

### 6.1 Core Features

#### 6.1.1 PDF Upload and Processing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Accept PDF uploads up to 50MB | Must Have |
| FR-002 | Extract text and structure from PDF using OCR/parsing | Must Have |
| FR-003 | Support PDFs generated from Google Docs | Must Have |
| FR-004 | Display extracted content for user review | Must Have |
| FR-005 | Handle multi-language documents (24 EU languages) | Should Have |

#### 6.1.2 Token Type Selection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | Allow user to select token type (OTHR/ART/EMT) | Must Have |
| FR-011 | Auto-detect token type from PDF content | Should Have |
| FR-012 | Show relevant fields based on token type | Must Have |
| FR-013 | Support sub-templates (Table 2a-2d, 3a-3c, 4a-4b) | Must Have |

#### 6.1.3 Field Mapping and Data Entry

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | Auto-map extracted PDF content to XBRL fields | Must Have |
| FR-021 | Display all required fields with extracted values | Must Have |
| FR-022 | Allow manual editing of all mapped values | Must Have |
| FR-023 | Highlight unmapped/missing required fields | Must Have |
| FR-024 | Support typed dimensions for management body members | Must Have |
| FR-025 | Provide dropdown selections for enumeration fields | Must Have |
| FR-026 | Validate LEI format and existence | Must Have |

#### 6.1.4 Validation Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | Validate against all 257 existence assertions | Must Have |
| FR-031 | Validate against all 224 value assertions | Must Have |
| FR-032 | Validate LEI using 6 LEI taxonomy assertions | Must Have |
| FR-033 | Display validation errors with field references | Must Have |
| FR-034 | Display validation warnings (SHOULD fix) | Must Have |
| FR-035 | Block export if ERROR-level assertions fail | Must Have |
| FR-036 | Generate validation report (PDF export) | Should Have |
| FR-037 | Detect duplicate facts (inconsistent duplicates = ERROR/WARNING) | Must Have |
| FR-038 | GLEIF API LEI lookup with graceful fallback | Should Have |

#### 6.1.5 iXBRL Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-040 | Generate valid Inline XBRL 1.1 document | Must Have |
| FR-041 | Output single XHTML file | Must Have |
| FR-042 | Include proper namespace declarations | Must Have |
| FR-043 | Set correct period format (yyyy-mm-dd, no time) | Must Have |
| FR-044 | Use xbrli:scenario (not segment) for dimensions | Must Have |
| FR-045 | Apply correct escape attributes for text blocks | Must Have |
| FR-046 | Generate unique fact IDs | Must Have |
| FR-047 | Embed or reference ESMA taxonomy correctly | Must Have |

#### 6.1.6 Export and Download

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-050 | Download iXBRL file (.xhtml) | Must Have |
| FR-051 | Preview human-readable version in browser | Must Have |
| FR-052 | Export validation report | Should Have |
| FR-053 | Export audit trail | Should Have |

### 6.2 Advanced Features (Phase 2)

#### 6.2.1 Workflow Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-100 | Save draft whitepapers | Should Have |
| FR-101 | Resume incomplete transformations | Should Have |
| FR-102 | Version history for each whitepaper | Should Have |
| FR-103 | Multi-user collaboration | Could Have |

#### 6.2.2 Template Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-110 | Create reusable templates from completed whitepapers | Should Have |
| FR-111 | Pre-fill common fields (issuer info, LEI, etc.) | Should Have |
| FR-112 | Import ESMA Excel templates (XLSM) | Could Have |

#### 6.2.3 API Access

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-120 | REST API for PDF upload | Could Have |
| FR-121 | API for validation status check | Could Have |
| FR-122 | API for iXBRL download | Could Have |
| FR-123 | Webhook notifications on completion | Could Have |

---

## 7. Technical Requirements

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PDF Upload  │  │ Field Editor │  │ Validation Dashboard   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PDF Parser  │  │ XBRL Engine │  │ Validation Service     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                 │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐ │
│  │ ESMA Taxonomy   │  │ User Sessions (In-Memory)             │ │
│  │ (Bundled)       │  │                                      │ │
│  └─────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | Next.js 16 (App Router) | Modern React framework, excellent Vercel integration |
| **UI Framework** | Tailwind CSS + shadcn/ui | Rapid development, professional look |
| **Document Processing** | pdf-parse, officeparser | PDF text extraction + DOCX/ODT/RTF support |
| **XBRL Engine** | Custom TypeScript implementation | Full control over iXBRL generation |
| **Validation** | Custom TypeScript rules engine | 488 assertions coded in existence-engine, value-engine, lei-validator, duplicate-detector |
| **Hosting** | Vercel | Specified requirement, excellent DX |
| **Database** | In-memory (Phase 1) | Sessions held in memory; database persistence planned for Phase 2 |
| **File Storage** | In-memory | All document processing in-memory per ESMA retention requirements |

### 7.3 XBRL Technical Specifications

The platform must implement the following XBRL standards:

| Specification | Version | Purpose |
|---------------|---------|---------|
| XBRL 2.1 | 2.1 | Core standard |
| Inline XBRL | 1.1 | Document format |
| Dimensions | 1.0 | Multi-dimensional reporting |
| Extensible Enumerations | 2.0 | Dropdown/enumeration lists |
| Formula | 1.0 | Validation assertions |
| Taxonomy Packages | 1.0 | Package structure |
| Generic Labels | 1.0 | Multi-language support |

### 7.4 External Taxonomy Dependencies

| Taxonomy | Purpose | URI Pattern |
|----------|---------|-------------|
| LEI | Legal Entity Identifier validation | ISO 17442 scheme |
| Country | ISO 3166 country codes | ESMA country taxonomy |
| Currency | ISO 4217 currency codes | ESMA currency taxonomy |

### 7.5 Data Type Support

The system must handle the following XBRL data types:

- `stringItemType` - Simple text fields
- `booleanItemType` - Yes/No fields
- `dateItemType` - Date fields (yyyy-mm-dd format)
- `monetaryItemType` - Financial amounts with currency
- `decimalItemType` - Decimal numbers
- `integerItemType` - Whole numbers
- `textBlockItemType` - Rich text/narrative sections (with `@escape="true"`)
- `enumerationItemType` - Single-select dropdowns
- `enumerationSetItemType` - Multi-select dropdowns
- `leiItemType` - LEI format validation

### 7.6 Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| No executable code in output | Strip JavaScript, Java, Flash from iXBRL |
| No external dependencies | Embed CSS, avoid external references |
| Secure file handling | Encrypted transit, auto-deletion after processing |
| Input sanitization | Validate all user inputs before XBRL generation |
| Image restrictions | Only PNG, GIF, SVG, JPEG allowed |

---

## 8. User Flows

### 8.1 Simple Upload Flow (Primary)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD                                                         │
│    User uploads PDF whitepaper                                    │
│    ┌────────────────────────────────────────┐                    │
│    │  📄 Drop PDF here or click to upload  │                    │
│    │     Supported: PDF up to 50MB         │                    │
│    └────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. SELECT TOKEN TYPE                                              │
│    ○ OTHR - Crypto-asset other than ART/EMT                      │
│    ○ ART  - Asset-Referenced Token                               │
│    ○ EMT  - E-Money Token                                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. REVIEW EXTRACTED DATA                                          │
│    System auto-extracts and maps PDF content to XBRL fields      │
│    User reviews and corrects any mismatched fields               │
│    ┌─────────────────────────────────────────────────────┐       │
│    │ Part A: Offeror Information                         │       │
│    │ ├─ Legal name: [Socios Technologies AG] ✓          │       │
│    │ ├─ LEI: [5493001KJTIIGC8Y1R12] ✓                   │       │
│    │ └─ Country: [Switzerland] ✓                        │       │
│    │ Part D: Project Information                         │       │
│    │ ├─ Token name: [$PERSIJA] ✓                        │       │
│    │ └─ Total supply: [10,000,000] ⚠ Needs review       │       │
│    └─────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. VALIDATE                                                       │
│    System runs 488 validation assertions                          │
│    ┌─────────────────────────────────────────────────────┐       │
│    │ ✅ Validation Complete                              │       │
│    │ ├─ 257 existence assertions: PASSED                │       │
│    │ ├─ 224 value assertions: PASSED                    │       │
│    │ ├─ 6 LEI assertions: PASSED                        │       │
│    │ └─ 1 duplicate detection: PASSED                   │       │
│    └─────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. DOWNLOAD                                                       │
│    [📥 Download iXBRL (.xhtml)]  [👁 Preview]  [📊 Report]       │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Manual Entry Flow (Secondary)

For cases where PDF extraction is insufficient or user starts from scratch:

1. User selects token type
2. System displays blank form with all required fields
3. User manually enters all values
4. System validates as user progresses
5. User triggers full validation
6. Download iXBRL file

### 8.3 Edit and Re-validate Flow

1. User uploads previously generated iXBRL
2. System parses existing data
3. User modifies fields
4. System re-validates
5. Download updated iXBRL

---

## 9. Data Requirements

### 9.1 Whitepaper Structure (Based on Example: $PERSIJA Fan Token)

The system must support the following document structure aligned with MiCA templates:

#### Part A: Offeror Information
- Legal name and registration details
- LEI (Legal Entity Identifier) - **REQUIRED**
- Contact information
- Website URL
- Home member state

#### Part B: Issuer Information (if different from Part A)
- Legal name and registration details
- LEI
- Relationship to offeror

#### Part C: Trading Platform Operator (if applicable)
- Platform name and registration
- LEI
- Contact information

#### Part D: Project Information
- Crypto-asset name and ticker
- Token standard (e.g., CAP-20, ERC-20)
- Blockchain network
- Total supply
- Consensus mechanism
- Project description

#### Part E: Offering Details
- Subscription period (start/end dates)
- Token price and currency
- Payment methods accepted
- Maximum subscription goal
- Distribution date
- Withdrawal rights

#### Part F: Crypto-Asset Characteristics
- Token classification
- Rights attached to token
- Technical specifications
- Utility description

#### Part G: Rights and Obligations
- Purchase rights
- Ownership rights
- Transfer restrictions
- Lock-up periods
- Dynamic supply mechanisms (if applicable)

#### Part H: Underlying Technology
- Blockchain platform details
- Smart contract information
- Security audits
- Technical capacity (TPS, fees)

#### Part I: Risk Factors
- Offer execution risks
- Issuer operational risks
- Market volatility risks
- Technology risks
- Regulatory risks

#### Part J: Sustainability Indicators
- Energy consumption (kWh)
- Consensus mechanism type
- Renewable energy percentage (if above threshold)
- GHG emissions (if applicable)

### 9.2 Management Body Members (Typed Dimensions)

The system must support multiple entries for:
- Table 2a: Offeror's management body members
- Table 2b: Issuer's management body members
- Table 2c: Operator's management body members
- Table 2d: Persons involved in project implementation

Each entry contains:
| Field | Type | Required |
|-------|------|----------|
| Line Identifier | Integer | Yes |
| Identity (Name) | String | Yes |
| Business Address | String | Yes |
| Function/Role | String | Yes |

### 9.3 Enumeration Fields

The following fields must present dropdown selections from ESMA-defined domains:

| Field | Options Example |
|-------|-----------------|
| Home Member State | 27 EU Member States + EEA |
| Token Type | OTHR / ART / EMT |
| Consensus Mechanism | PoW / PoS / PoA / DPoS / Other |
| Authorization Status | Authorized / Not Authorized / Pending |
| Currency | ISO 4217 currency codes |
| Country | ISO 3166-1 alpha-2 codes |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Metric | Requirement |
|--------|-------------|
| PDF Processing | < 30 seconds for 50-page PDF |
| Validation | < 10 seconds for all 488 assertions |
| iXBRL Generation | < 5 seconds |
| Page Load | < 2 seconds (LCP) |
| File Upload | Progress indicator, resume on failure |

### 10.2 Availability

| Metric | Requirement |
|--------|-------------|
| Uptime | 99.5% (excluding planned maintenance) |
| Planned Maintenance | < 4 hours/month, non-business hours EU time |
| Error Recovery | Auto-retry on transient failures |

### 10.3 Scalability

| Metric | Requirement |
|--------|-------------|
| Concurrent Users | Support 100 simultaneous uploads |
| File Size | Up to 50MB per PDF |
| Storage | 30-day retention for temporary files |

### 10.4 Usability

| Metric | Requirement |
|--------|-------------|
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Mobile Support | Responsive design, functional on tablet |
| Accessibility | WCAG 2.1 AA compliance |
| Language | English UI (Phase 1), multi-language (Phase 2) |

### 10.5 Compliance

| Requirement | Description |
|-------------|-------------|
| GDPR | No personal data retained beyond session |
| Data Residency | EU data center for processing |
| Audit Trail | Log all transformations with timestamps |

---

## 11. Success Metrics

### 11.1 Key Performance Indicators (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Conversion Success Rate** | > 95% | % of uploads resulting in valid iXBRL |
| **User Task Completion** | > 90% | % of users who complete full workflow |
| **Validation Pass Rate** | 100% | % of generated files passing ESMA validation |
| **Support Ticket Volume** | < 5% of users | Support requests per active user |
| **NPS Score** | > 40 | Net Promoter Score from user surveys |

### 11.2 Usage Metrics

| Metric | Description |
|--------|-------------|
| Monthly Active Users | Unique users per month |
| Whitepapers Processed | Total transformations completed |
| Average Session Duration | Time from upload to download |
| Repeat Usage Rate | % of users returning for additional whitepapers |

---

## 12. Risks and Mitigations

### 12.1 Regulatory Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| ESMA taxonomy updates | Files become non-compliant | Monitor ESMA publications, implement version control |
| NCA-specific requirements | Rejection by specific authorities | Research NCA requirements, provide customization |
| Regulatory interpretation changes | Validation rules change | Configurable validation rules, rapid update process |

### 12.2 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex PDF layouts | Extraction failures | Manual entry fallback, improve extraction algorithms |
| Validation complexity | False positives/negatives | Use Arelle as reference implementation, extensive testing |
| Performance at scale | Slow processing | Queue-based processing, horizontal scaling |

### 12.3 Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Limited adoption | Low usage | Early user feedback, feature prioritization |
| Competitor products | Market share loss | Focus on ease-of-use, compliance accuracy |
| Support burden | High operational cost | Self-service documentation, in-app guidance |

---

## 13. Implementation Phases

### Phase 1: MVP (Core Functionality)

**Duration:** 6-8 weeks
**Goal:** Basic upload → transform → download workflow

**Deliverables:**
- [ ] PDF upload and text extraction
- [ ] Token type selection (OTHR, ART, EMT)
- [ ] Field mapping interface with manual editing
- [ ] Basic validation (required fields, format checks)
- [ ] iXBRL generation for all 3 entry points
- [ ] Download functionality
- [ ] Vercel deployment

**Out of Scope for Phase 1:**
- Full ESMA Formula 1.0 validation
- User accounts and saved drafts
- API access
- Multi-language UI

### Phase 2: Full Validation

**Duration:** 4-6 weeks
**Goal:** Complete ESMA compliance validation

**Deliverables:**
- [ ] All 257 existence assertions
- [ ] All 224 value assertions
- [ ] LEI validation integration
- [ ] Duplicate fact detection
- [ ] GLEIF LEI lookup integration
- [ ] Validation report generation
- [ ] Error/warning distinction (ERROR vs WARNING severity)

### Phase 3: Enhanced UX

**Duration:** 4-6 weeks
**Goal:** Professional user experience

**Deliverables:**
- [ ] User accounts (Supabase)
- [ ] Save and resume drafts
- [ ] Version history
- [ ] Template management
- [ ] Improved PDF extraction with AI assistance

### Phase 4: Enterprise Features

**Duration:** 6-8 weeks
**Goal:** Support for professional users and integrations

**Deliverables:**
- [ ] REST API
- [ ] Batch processing
- [ ] Multi-user collaboration
- [ ] VFA Agent review mode
- [ ] White-label options

---

## Appendices

### Appendix A: Reference Documents

| Document | Location | Description |
|----------|----------|-------------|
| ESMA MiCA Taxonomy Documentation | `ESME Research documents/mica_taxonomy_2025_documentation_v1.0.pdf` | Architecture and content explanation |
| ESMA Reporting Manual | `ESME Research documents/mica_taxonomy_reporting_manual_v1.0.pdf` | Guidance for reporting entities |
| ESMA Formula Assertions | `ESME Research documents/mica_taxonomy_formulas_202507.xlsx` | Validation rules |
| OTHR Template | `ESME Research documents/SCWP_-_for_OTHR_token.xlsm` | Excel template for OTHR tokens |
| ART Template | `ESME Research documents/SCWP_-_for_ART_token.xlsm` | Excel template for ART tokens |
| EMT Template | `ESME Research documents/SCWP_-_for_EMT_token.xlsm` | Excel template for EMT tokens |
| Example Whitepaper | `Example PDF whitepaper/$PERSIJA Fan Token White Paper...pdf` | Real MiCA-compliant whitepaper example |

### Appendix B: ESMA Taxonomy Files

| File | Purpose |
|------|---------|
| `mica_cor.xsd` | Core schema with all reportable elements |
| `mica_entry_table_2.xsd` | Entry point for OTHR tokens |
| `mica_entry_table_3.xsd` | Entry point for ART tokens |
| `mica_entry_table_4.xsd` | Entry point for EMT tokens |
| `mica_cor-lab-{lg}.xml` | Multi-language labels (24 languages) |
| `mica_cor-def.xml` | Definition linkbase |
| `mica-pre-{table}.xml` | Presentation linkbase |
| `mica-for-{table}.xml` | Formula/validation linkbase |

### Appendix C: External Resources

- [ESMA MiCA Regulation Page](https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/markets-crypto-assets-regulation-mica)
- [ESMA Study on MiCA Whitepaper Data Formats](https://www.esma.europa.eu/document/study-mica-whitepaper-data-formats)
- [Malta MFSA Virtual Financial Assets](https://www.mfsa.mt/our-work/virtual-financial-assets/)
- [XBRL International - Inline XBRL](https://www.xbrl.org/the-standard/what/ixbrl/)
- [Arelle Open Source XBRL Platform](https://arelle.org/)

### Appendix D: Glossary

| Term | Definition |
|------|------------|
| **ART** | Asset-Referenced Token - crypto-asset backed by a basket of assets |
| **CASP** | Crypto-Asset Service Provider |
| **EMT** | E-Money Token - stablecoin representing fiat currency |
| **ESMA** | European Securities and Markets Authority |
| **iXBRL** | Inline XBRL - XBRL embedded in HTML for human and machine readability |
| **LEI** | Legal Entity Identifier - 20-character identifier for legal entities |
| **MiCA** | Markets in Crypto-Assets Regulation (EU 2023/1114) |
| **MFSA** | Malta Financial Services Authority |
| **NCA** | National Competent Authority |
| **OTHR** | Other - crypto-assets that are not ART or EMT |
| **VFA** | Virtual Financial Assets (Malta-specific legacy framework) |
| **XBRL** | eXtensible Business Reporting Language |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-27 | Claude Code | Initial PRD creation |

---

*This PRD was generated based on analysis of ESMA's MiCA taxonomy documentation, example whitepapers, and current regulatory requirements. For the most current regulatory information, always consult official ESMA and MFSA publications.*
