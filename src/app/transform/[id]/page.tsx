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
import type { ProcessResponse } from '@/app/api/process/route';
import type { TokenType } from '@/types/taxonomy';

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  fields: Array<{
    path: string;
    label: string;
    type: 'text' | 'boolean' | 'monetary' | 'textblock' | 'number';
    required?: boolean;
    placeholder?: string;
    helpText?: string;
    maxLength?: number;
  }>;
}

// Section configurations
const SECTIONS: SectionConfig[] = [
  {
    id: 'partA',
    title: 'Part A: Offeror Information',
    description: 'Information about the entity offering the crypto-asset',
    fields: [
      {
        path: 'partA.legalName',
        label: 'Legal Name',
        type: 'text',
        required: true,
        placeholder: 'Enter company legal name',
        helpText: 'Full legal name of the offeror entity',
      },
      {
        path: 'partA.lei',
        label: 'Legal Entity Identifier (LEI)',
        type: 'text',
        required: true,
        placeholder: '20 character LEI code',
        helpText: 'ISO 17442 compliant LEI',
        maxLength: 20,
      },
      {
        path: 'partA.registeredAddress',
        label: 'Registered Address',
        type: 'textblock',
        required: true,
        placeholder: 'Full registered address',
      },
      {
        path: 'partA.country',
        label: 'Country',
        type: 'text',
        required: true,
        placeholder: 'ISO 3166-1 alpha-2 code (e.g., MT, DE)',
        helpText: 'Two-letter country code',
        maxLength: 2,
      },
      {
        path: 'partA.website',
        label: 'Website',
        type: 'text',
        placeholder: 'https://example.com',
      },
      {
        path: 'partA.contactEmail',
        label: 'Contact Email',
        type: 'text',
        placeholder: 'contact@example.com',
      },
    ],
  },
  {
    id: 'partD',
    title: 'Part D: Project Information',
    description: 'Details about the crypto-asset project',
    fields: [
      {
        path: 'partD.cryptoAssetName',
        label: 'Crypto-Asset Name',
        type: 'text',
        required: true,
        placeholder: 'Name of the token',
      },
      {
        path: 'partD.cryptoAssetSymbol',
        label: 'Ticker Symbol',
        type: 'text',
        required: true,
        placeholder: 'e.g., BTC, ETH',
        maxLength: 10,
      },
      {
        path: 'partD.totalSupply',
        label: 'Total Supply',
        type: 'number',
        required: true,
        placeholder: 'Maximum token supply',
      },
      {
        path: 'partD.tokenStandard',
        label: 'Token Standard',
        type: 'text',
        placeholder: 'e.g., ERC-20, BEP-20',
      },
      {
        path: 'partD.blockchainNetwork',
        label: 'Blockchain Network',
        type: 'text',
        placeholder: 'e.g., Ethereum, Chiliz Chain',
      },
      {
        path: 'partD.consensusMechanism',
        label: 'Consensus Mechanism',
        type: 'text',
        placeholder: 'e.g., Proof of Stake',
      },
      {
        path: 'partD.projectDescription',
        label: 'Project Description',
        type: 'textblock',
        required: true,
        placeholder: 'Describe the project purpose and functionality',
        maxLength: 5000,
      },
    ],
  },
  {
    id: 'partE',
    title: 'Part E: Offering Details',
    description: 'Information about the public offering',
    fields: [
      {
        path: 'partE.isPublicOffering',
        label: 'Is this a public offering?',
        type: 'boolean',
        required: true,
      },
      {
        path: 'partE.publicOfferingStartDate',
        label: 'Offering Start Date',
        type: 'text',
        placeholder: 'YYYY-MM-DD',
      },
      {
        path: 'partE.publicOfferingEndDate',
        label: 'Offering End Date',
        type: 'text',
        placeholder: 'YYYY-MM-DD',
      },
      {
        path: 'partE.tokenPrice',
        label: 'Token Price',
        type: 'monetary',
        placeholder: '0.00',
      },
      {
        path: 'partE.maxSubscriptionGoal',
        label: 'Maximum Subscription Goal',
        type: 'monetary',
        placeholder: '0.00',
      },
      {
        path: 'partE.withdrawalRights',
        label: 'Withdrawal Rights',
        type: 'boolean',
        helpText: 'Are purchasers entitled to withdrawal rights?',
      },
    ],
  },
  {
    id: 'partH',
    title: 'Part H: Technology',
    description: 'Technical details about the underlying blockchain',
    fields: [
      {
        path: 'partH.blockchainDescription',
        label: 'Blockchain Description',
        type: 'textblock',
        required: true,
        placeholder: 'Describe the underlying blockchain technology',
        maxLength: 3000,
      },
      {
        path: 'partH.smartContractInfo',
        label: 'Smart Contract Information',
        type: 'textblock',
        placeholder: 'Contract addresses and details',
      },
    ],
  },
  {
    id: 'partJ',
    title: 'Part J: Sustainability',
    description: 'Environmental impact indicators',
    fields: [
      {
        path: 'partJ.energyConsumption',
        label: 'Energy Consumption (kWh)',
        type: 'number',
        placeholder: 'Annual energy consumption',
      },
      {
        path: 'partJ.consensusMechanismType',
        label: 'Consensus Mechanism Type',
        type: 'text',
        placeholder: 'e.g., PoS, PoW',
      },
      {
        path: 'partJ.renewableEnergyPercentage',
        label: 'Renewable Energy Percentage',
        type: 'number',
        placeholder: '0-100',
        helpText: 'Percentage of energy from renewable sources',
      },
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
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  // Process the PDF on mount
  useEffect(() => {
    async function processUpload() {
      setLoadingState('processing');
      setError(null);

      try {
        const response = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const result: ProcessResponse = await response.json();

        if (!result.success || !result.data) {
          throw new Error(result.error?.message || 'Processing failed');
        }

        setData(result.data.mapping.data);
        setMappings(result.data.mapping.mappings);
        setFilename(result.data.filename);
        setPages(result.data.extraction.pages);
        setConfidence(result.data.mapping.confidence.overall);
        // Set token type from the mapping data or default to OTHR
        if (result.data.mapping.data.tokenType) {
          setTokenType(result.data.mapping.data.tokenType as TokenType);
        }
        setLoadingState('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Processing failed');
        setLoadingState('error');
      }
    }

    if (sessionId) {
      processUpload();
    }
  }, [sessionId]);

  // Handle field changes
  const handleFieldChange = useCallback((path: string, value: unknown) => {
    setData((prev) => {
      const parts = path.split('.');
      const newData = { ...prev };

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

      return errors.filter((e) => e.severity === 'error').length === 0;
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Validation failed');
      setGenerateState('error');
      return false;
    }
  }, [data, tokenType]);

  // Handle generation
  const handleGenerate = useCallback(async () => {
    // First validate
    const isValid = await handleValidate();

    if (!isValid) {
      setGenerateState('idle');
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
            <div className="relative">
              <button
                onClick={() => setShowValidation(false)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-muted z-10"
                aria-label="Close validation"
              >
                <X className="h-4 w-4" />
              </button>
              <ValidationDashboard
                errors={validationErrors}
                isValidating={generateState === 'validating'}
                onFieldClick={(path) => {
                  // Scroll to field (simplified for now)
                  const sectionId = path.split('.')[0];
                  const element = document.getElementById(sectionId || '');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </div>
          )}

          {/* Generation Error */}
          {generateState === 'error' && generateError && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
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
              onClick={() => handleValidate().then(() => setGenerateState('idle'))}
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
