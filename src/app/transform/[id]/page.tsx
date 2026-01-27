'use client';

/**
 * Transform Page
 *
 * Displays extracted whitepaper fields and allows editing before generating iXBRL.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { SectionEditor } from '@/components/editor';
import type { MappedField, WhitepaperData } from '@/types/whitepaper';
import type { ProcessResponse } from '@/app/api/process/route';

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

  // Handle generate action (placeholder for now)
  const handleGenerate = useCallback(() => {
    // TODO: Implement validation and generation
    alert('iXBRL generation will be implemented in Phase 4');
  }, []);

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

          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Generate iXBRL
          </button>
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

      {/* Footer */}
      <footer className="border-t bg-background py-4 sticky bottom-0">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Review and complete all required fields before generating
          </p>
          <button
            onClick={handleGenerate}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Generate iXBRL
          </button>
        </div>
      </footer>
    </div>
  );
}
