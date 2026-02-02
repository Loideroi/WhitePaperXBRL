/**
 * CSS Styles for iXBRL Document
 *
 * Embedded CSS for A4 page layout matching the MiCA whitepaper template format.
 * Derived from the SPURS/ESMA reference pattern.
 */

/**
 * Generate the full CSS stylesheet for the iXBRL document
 */
export function generateCSSStylesheet(): string {
  return `
/* ============================================================
   MiCA Crypto-Asset White Paper - iXBRL Document Styles
   A4 page layout with numbered table format
   ============================================================ */

/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 10pt;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.5;
  color: #1a1a1a;
  background: #f0f0f0;
}

/* Page structure (A4-like) */
.page {
  width: 210mm;
  min-height: 297mm;
  margin: 10mm auto;
  padding: 20mm 25mm;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  page-break-after: always;
  overflow: hidden;
}

@media print {
  body {
    background: #ffffff;
  }
  .page {
    margin: 0;
    padding: 15mm 20mm;
    box-shadow: none;
    page-break-after: always;
  }
  .page:first-child {
    page-break-before: avoid;
  }
}

/* Cover page */
.cover-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.cover-page .logo {
  max-width: 200px;
  max-height: 120px;
  margin-bottom: 30mm;
}

.cover-page .title {
  font-size: 22pt;
  font-weight: 700;
  color: #003366;
  margin-bottom: 5mm;
  line-height: 1.3;
}

.cover-page .subtitle {
  font-size: 14pt;
  color: #666666;
  margin-bottom: 10mm;
}

.cover-page .meta {
  font-size: 10pt;
  color: #888888;
  margin-top: 5mm;
}

.cover-page .disclaimer-box {
  margin-top: 20mm;
  padding: 8mm;
  border: 1px solid #cc9900;
  background: #fff8e1;
  text-align: left;
  font-size: 8pt;
  line-height: 1.6;
  color: #665500;
  max-width: 160mm;
}

/* Table of Contents */
.toc {
  margin-top: 10mm;
}

.toc h2 {
  font-size: 16pt;
  color: #003366;
  margin-bottom: 8mm;
  border-bottom: 2px solid #003366;
  padding-bottom: 3mm;
}

.toc ul {
  list-style: none;
  padding: 0;
}

.toc li {
  padding: 2mm 0;
  border-bottom: 1px dotted #cccccc;
  font-size: 10pt;
}

.toc li a {
  color: #003366;
  text-decoration: none;
}

.toc li a:hover {
  text-decoration: underline;
}

.toc .toc-number {
  display: inline-block;
  width: 25mm;
  font-weight: 600;
}

/* Section headings */
.section-heading {
  font-size: 14pt;
  font-weight: 700;
  color: #003366;
  margin: 8mm 0 5mm 0;
  padding-bottom: 2mm;
  border-bottom: 2px solid #003366;
}

.section-subheading {
  font-size: 11pt;
  font-weight: 600;
  color: #336699;
  margin: 5mm 0 3mm 0;
}

/* MiCA numbered table format */
table.accounts {
  width: 100%;
  border-collapse: collapse;
  margin: 3mm 0 5mm 0;
  font-size: 9pt;
}

table.accounts th {
  background: #003366;
  color: #ffffff;
  font-weight: 600;
  padding: 3mm 4mm;
  text-align: left;
  border: 0.5pt solid #003366;
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
}

table.accounts th:first-child {
  width: 12mm;
  text-align: center;
}

table.accounts th:nth-child(2) {
  width: 55mm;
}

table.accounts td {
  padding: 2.5mm 4mm;
  border: 0.5pt solid #cccccc;
  vertical-align: top;
}

table.accounts td:first-child {
  font-weight: 600;
  color: #003366;
  text-align: center;
  font-size: 8pt;
  white-space: nowrap;
}

table.accounts td:nth-child(2) {
  font-weight: 500;
  color: #444444;
  font-size: 8.5pt;
}

table.accounts td:nth-child(3) {
  color: #1a1a1a;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

table.accounts tr:nth-child(even) {
  background: #f8f9fa;
}

table.accounts tr:hover {
  background: #e8f0fe;
}

/* Empty field styling */
table.accounts td.empty-field {
  color: #999999;
  font-style: italic;
  font-size: 8pt;
}

/* Text block content within cells */
table.accounts .text-block {
  white-space: pre-wrap;
  line-height: 1.6;
  max-height: 80mm;
  overflow: hidden;
}

table.accounts .text-block p {
  margin-bottom: 2mm;
}

/* Dimensional tables (management body members, persons involved) */
table.dimensional {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 5mm 0;
  font-size: 9pt;
}

table.dimensional th {
  background: #336699;
  color: #ffffff;
  font-weight: 600;
  padding: 2mm 3mm;
  text-align: left;
  border: 0.5pt solid #336699;
  font-size: 8pt;
}

table.dimensional td {
  padding: 2mm 3mm;
  border: 0.5pt solid #cccccc;
  vertical-align: top;
}

table.dimensional tr:nth-child(even) {
  background: #f8f9fa;
}

/* Sustainability indicators table */
table.sustainability {
  width: 100%;
  border-collapse: collapse;
  margin: 3mm 0 5mm 0;
  font-size: 9pt;
}

table.sustainability th {
  background: #2e7d32;
  color: #ffffff;
  font-weight: 600;
  padding: 3mm 4mm;
  text-align: left;
  border: 0.5pt solid #2e7d32;
  font-size: 8pt;
}

table.sustainability td {
  padding: 2.5mm 4mm;
  border: 0.5pt solid #cccccc;
  vertical-align: top;
}

/* Footer */
.page-footer {
  margin-top: 10mm;
  padding-top: 3mm;
  border-top: 1px solid #cccccc;
  font-size: 7pt;
  color: #999999;
  text-align: center;
}

/* Inline XBRL fact highlighting (for viewing tools) */
ix\\:nonNumeric,
ix\\:nonFraction {
  /* No visual styling by default - facts are inline */
}

/* Hidden facts container */
.ix-hidden {
  display: none;
}
`.trim();
}
