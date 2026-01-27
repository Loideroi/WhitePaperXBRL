'use client';

/**
 * BooleanField Component
 *
 * Yes/No toggle switch with confidence indicator.
 */

import { useState, useCallback } from 'react';
import type { ConfidenceLevel } from '@/types/whitepaper';

interface BooleanFieldProps {
  /** Field path */
  path: string;
  /** Field label */
  label: string;
  /** Current value */
  value: boolean | undefined;
  /** Whether the field is required */
  required?: boolean;
  /** Extraction confidence level */
  confidence?: ConfidenceLevel;
  /** Source of extracted value */
  source?: string;
  /** Callback when value changes */
  onChange: (path: string, value: boolean) => void;
  /** Help text */
  helpText?: string;
}

export function BooleanField({
  path,
  label,
  value,
  required = false,
  confidence,
  source,
  onChange,
  helpText,
}: BooleanFieldProps) {
  const [isEdited, setIsEdited] = useState(false);

  const handleChange = useCallback(
    (newValue: boolean) => {
      setIsEdited(true);
      onChange(path, newValue);
    },
    [path, onChange]
  );

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </span>

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

      {/* Toggle Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleChange(true)}
          className={`
            flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors
            ${
              value === true
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:border-primary/50'
            }
          `}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => handleChange(false)}
          className={`
            flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors
            ${
              value === false
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:border-primary/50'
            }
          `}
        >
          No
        </button>
      </div>

      {/* Help Text */}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      {/* Source Info */}
      {source && !isEdited && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Source:</span> {source}
        </p>
      )}
    </div>
  );
}
