'use client';

/**
 * TextField Component
 *
 * Simple text input with confidence indicator and source info.
 */

import { useState, useCallback } from 'react';
import type { ConfidenceLevel } from '@/types/whitepaper';

interface TextFieldProps {
  /** Field path (e.g., 'partA.legalName') */
  path: string;
  /** Field label */
  label: string;
  /** Current value */
  value: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Extraction confidence level */
  confidence?: ConfidenceLevel;
  /** Source of extracted value */
  source?: string;
  /** Validation error message */
  error?: string;
  /** Callback when value changes */
  onChange: (path: string, value: string) => void;
  /** Maximum length */
  maxLength?: number;
  /** Help text */
  helpText?: string;
}

function getConfidenceColor(confidence: ConfidenceLevel | undefined): string {
  switch (confidence) {
    case 'high':
      return 'text-green-600 bg-green-50';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50';
    case 'low':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-muted-foreground bg-muted';
  }
}

function getConfidenceLabel(confidence: ConfidenceLevel | undefined): string {
  switch (confidence) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    case 'low':
      return 'Low confidence - review recommended';
    default:
      return 'Manual entry';
  }
}

export function TextField({
  path,
  label,
  value,
  placeholder,
  required = false,
  confidence,
  source,
  error,
  onChange,
  maxLength,
  helpText,
}: TextFieldProps) {
  const [isEdited, setIsEdited] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsEdited(true);
      onChange(path, e.target.value);
    },
    [path, onChange]
  );

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label htmlFor={path} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>

        {/* Confidence Badge */}
        {confidence && !isEdited && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(confidence)}`}
            title={getConfidenceLabel(confidence)}
          >
            {confidence}
          </span>
        )}
        {isEdited && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            edited
          </span>
        )}
      </div>

      {/* Input */}
      <input
        id={path}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`
          w-full px-3 py-2 rounded-lg border bg-background text-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-destructive focus:ring-destructive/50' : 'border-input'}
          ${confidence === 'low' && !isEdited ? 'border-yellow-400' : ''}
        `}
      />

      {/* Error Message */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Help Text */}
      {helpText && !error && <p className="text-xs text-muted-foreground">{helpText}</p>}

      {/* Source Info */}
      {source && !isEdited && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Source:</span> {source}
        </p>
      )}
    </div>
  );
}
