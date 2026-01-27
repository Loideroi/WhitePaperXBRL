'use client';

/**
 * TextBlockField Component
 *
 * Multi-line text area for long descriptions.
 */

import { useState, useCallback } from 'react';
import type { ConfidenceLevel } from '@/types/whitepaper';

interface TextBlockFieldProps {
  /** Field path */
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
  /** Number of rows */
  rows?: number;
  /** Help text */
  helpText?: string;
}

export function TextBlockField({
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
  rows = 4,
  helpText,
}: TextBlockFieldProps) {
  const [isEdited, setIsEdited] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setIsEdited(true);
      onChange(path, e.target.value);
    },
    [path, onChange]
  );

  const charCount = value?.length || 0;

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
        {isEdited && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            edited
          </span>
        )}
      </div>

      {/* Textarea */}
      <textarea
        id={path}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={`
          w-full px-3 py-2 rounded-lg border bg-background text-foreground resize-y
          focus:outline-none focus:ring-2 focus:ring-primary/50
          ${error ? 'border-destructive focus:ring-destructive/50' : 'border-input'}
          ${confidence === 'low' && !isEdited ? 'border-yellow-400' : ''}
        `}
      />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div>
          {/* Error Message */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Help Text */}
          {helpText && !error && <p className="text-xs text-muted-foreground">{helpText}</p>}
        </div>

        {/* Character Count */}
        {maxLength && (
          <span
            className={`text-xs ${charCount > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {charCount}/{maxLength}
          </span>
        )}
      </div>

      {/* Source Info */}
      {source && !isEdited && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Source:</span> {source}
        </p>
      )}
    </div>
  );
}
