'use client';

/**
 * Upload Zone Component
 *
 * Drag-and-drop file upload with progress indication and token type selection.
 * Supports PDF, DOCX, ODT, and RTF formats.
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileUp, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import type { TokenType } from '@/types/taxonomy';

/** Supported file extensions and their MIME types */
const SUPPORTED_FORMATS: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.odt': ['application/vnd.oasis.opendocument.text'],
  '.rtf': ['application/rtf', 'text/rtf'],
};

const ACCEPT_STRING = Object.keys(SUPPORTED_FORMATS).join(',');
const ACCEPT_MIMES = Object.values(SUPPORTED_FORMATS).flat().join(',');

interface UploadResponse {
  success: boolean;
  data?: {
    sessionId: string;
    filename: string;
    size: number;
    tokenType?: string;
    uploadedAt: string;
    status: string;
    extraction: {
      pages: number;
      metadata: {
        title?: string;
        author?: string;
        creationDate?: string;
      };
    };
    mapping: {
      data: Record<string, unknown>;
      mappings: Array<{ field: string; value: unknown; confidence: number; source: string }>;
      confidence: { overall: number };
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

interface UploadZoneProps {
  /** Callback when upload succeeds */
  onUploadComplete?: (sessionId: string, filename: string) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
  /** Maximum file size in bytes (default: 50MB) */
  maxSize?: number;
}

type UploadStatus = 'idle' | 'dragging' | 'uploading' | 'success' | 'error';

const TOKEN_TYPES: { value: TokenType; label: string; description: string }[] = [
  {
    value: 'OTHR',
    label: 'Other Crypto-Assets',
    description: 'Utility tokens, fan tokens, etc.',
  },
  {
    value: 'ART',
    label: 'Asset-Referenced Tokens',
    description: 'Tokens backed by assets',
  },
  {
    value: 'EMT',
    label: 'E-Money Tokens',
    description: 'Stablecoins',
  },
];

export function UploadZone({
  onUploadComplete,
  onUploadError,
  maxSize = 50 * 1024 * 1024,
}: UploadZoneProps) {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [selectedTokenType, setSelectedTokenType] = useState<TokenType>('OTHR');
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; sessionId: string } | null>(
    null
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('idle');
  }, []);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize) {
        return `File exceeds maximum size of ${Math.round(maxSize / 1024 / 1024)}MB`;
      }

      // Check file extension
      const fileName = file.name.toLowerCase();
      const validExtensions = Object.keys(SUPPORTED_FORMATS);
      const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

      if (!hasValidExtension) {
        return 'Unsupported format. Accepted: PDF, DOCX, ODT, RTF';
      }

      // Check MIME type (with fallback for unknown types)
      const allMimeTypes = Object.values(SUPPORTED_FORMATS).flat();
      if (file.type && !allMimeTypes.includes(file.type) && file.type !== 'application/octet-stream') {
        // Allow if extension is valid but MIME is unknown/generic
        if (file.type !== '') {
          return 'Unsupported format. Accepted: PDF, DOCX, ODT, RTF';
        }
      }

      return null;
    },
    [maxSize]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setStatus('uploading');
      setError(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('tokenType', selectedTokenType);

      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data: UploadResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error?.message || 'Upload failed');
        }

        if (data.data) {
          // Store complete data in localStorage for the transform page
          localStorage.setItem(`whitepaper-${data.data.sessionId}`, JSON.stringify(data.data));

          setStatus('success');
          setUploadedFile({ name: file.name, sessionId: data.data.sessionId });
          onUploadComplete?.(data.data.sessionId, file.name);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setStatus('error');
        setError(errorMessage);
        onUploadError?.(errorMessage);
      }
    },
    [selectedTokenType, onUploadComplete, onUploadError]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (!file) {
        setStatus('idle');
        return;
      }

      const validationError = validateFile(file);
      if (validationError) {
        setStatus('error');
        setError(validationError);
        return;
      }

      await uploadFile(file);
    },
    [validateFile, uploadFile]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validationError = validateFile(file);
      if (validationError) {
        setStatus('error');
        setError(validationError);
        return;
      }

      await uploadFile(file);
    },
    [validateFile, uploadFile]
  );

  const handleClick = useCallback(() => {
    if (status === 'uploading') return;
    fileInputRef.current?.click();
  }, [status]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setUploadedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Token Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-2">Token Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TOKEN_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSelectedTokenType(type.value)}
              disabled={status === 'uploading'}
              className={`p-3 rounded-lg border text-left transition-all ${
                selectedTokenType === type.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 bg-card'
              } ${status === 'uploading' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="block font-mono text-xs font-semibold text-primary">
                {type.value}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">{type.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-lg border-2 border-dashed p-12 text-center transition-all cursor-pointer
          ${status === 'dragging' ? 'border-primary bg-primary/5 scale-[1.02]' : ''}
          ${status === 'idle' ? 'border-muted-foreground/25 bg-card hover:border-primary/50' : ''}
          ${status === 'uploading' ? 'border-primary/50 bg-primary/5 cursor-wait' : ''}
          ${status === 'success' ? 'border-green-500 bg-green-500/5' : ''}
          ${status === 'error' ? 'border-destructive bg-destructive/5' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={`${ACCEPT_STRING},${ACCEPT_MIMES}`}
          onChange={handleFileSelect}
          className="hidden"
          disabled={status === 'uploading'}
        />

        {/* Idle State */}
        {status === 'idle' && (
          <>
            <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Drop your whitepaper here</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Supports PDF, DOCX, ODT, RTF up to {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </>
        )}

        {/* Dragging State */}
        {status === 'dragging' && (
          <>
            <FileUp className="mx-auto h-12 w-12 text-primary animate-bounce" />
            <p className="mt-4 text-lg font-medium text-primary">Drop to upload</p>
          </>
        )}

        {/* Uploading State */}
        {status === 'uploading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <p className="mt-4 text-lg font-medium">Uploading...</p>
            <div className="mt-4 w-full max-w-xs mx-auto">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          </>
        )}

        {/* Success State */}
        {status === 'success' && uploadedFile && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium text-green-600">Upload complete</p>
            <p className="mt-1 text-sm text-muted-foreground truncate max-w-full px-4">
              {uploadedFile.name}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Session: {uploadedFile.sessionId.slice(0, 8)}...
            </p>
          </>
        )}

        {/* Error State */}
        {status === 'error' && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-medium text-destructive">Upload failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </>
        )}

        {/* Reset Button */}
        {(status === 'success' || status === 'error') && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleReset();
            }}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label="Reset upload"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Next Steps */}
      {status === 'success' && uploadedFile && (
        <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-600 font-medium">Ready to process</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your document has been uploaded. Click continue to extract and map whitepaper fields.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/transform/${uploadedFile.sessionId}`)}
            className="mt-3 w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Continue to Field Mapping
          </button>
        </div>
      )}
    </div>
  );
}
