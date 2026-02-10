'use client';

/**
 * EnumerationField Component
 *
 * Dropdown selector for enumeration values mapped to human-readable labels.
 */

import { useState, useCallback } from 'react';
import type { ConfidenceLevel } from '@/types/whitepaper';

interface EnumerationFieldProps {
  /** Field path */
  path: string;
  /** Field label */
  label: string;
  /** Current selected value (the key) */
  value: string | undefined;
  /** Available options mapping key to human-readable label */
  options: Record<string, string>;
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
  /** Help text */
  helpText?: string;
}

export function EnumerationField({
  path,
  label,
  value,
  options,
  required = false,
  confidence,
  source,
  error,
  onChange,
  helpText,
}: EnumerationFieldProps) {
  const [isEdited, setIsEdited] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
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

        {confidence && !isEdited && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              confidence === 'high'
                ? 'bg-green-50 text-green-600'
                : confidence === 'medium'
                  ? 'bg-yellow-50 text-yellow-600'
                  : 'bg-red-50 text-red-600'
            }`}
          >
            {confidence}
          </span>
        )}
      </div>

      {/* Dropdown */}
      <select
        id={path}
        value={value ?? ''}
        onChange={handleChange}
        className={`
          w-full px-3 py-2 rounded-lg border bg-background text-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-destructive focus:ring-destructive/50' : 'border-input'}
        `}
      >
        <option value="">Select...</option>
        {Object.entries(options).map(([key, optionLabel]) => (
          <option key={key} value={key}>
            {optionLabel}
          </option>
        ))}
      </select>

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
