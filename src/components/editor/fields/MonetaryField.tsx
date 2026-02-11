'use client';

/**
 * MonetaryField Component
 *
 * Amount input with currency selector.
 */

import { useState, useCallback } from 'react';
import type { ConfidenceLevel } from '@/types/whitepaper';

interface MonetaryFieldProps {
  /** Field path */
  path: string;
  /** Field label */
  label: string;
  /** Current amount value */
  value: number | undefined;
  /** Current currency */
  currency?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Extraction confidence level */
  confidence?: ConfidenceLevel;
  /** Source of extracted value */
  source?: string;
  /** Validation error message */
  error?: string;
  /** Callback when value changes */
  onChange: (path: string, value: number | undefined, currency?: string) => void;
  /** Help text */
  helpText?: string;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

export function MonetaryField({
  path,
  label,
  value,
  currency = 'USD',
  required = false,
  confidence,
  source,
  error,
  onChange,
  helpText,
}: MonetaryFieldProps) {
  const [isEdited, setIsEdited] = useState(false);
  const [localCurrency, setLocalCurrency] = useState(currency);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIsEdited(true);
      const numValue = e.target.value ? parseFloat(e.target.value) : undefined;
      onChange(path, numValue, localCurrency);
    },
    [path, onChange, localCurrency]
  );

  const handleCurrencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setIsEdited(true);
      const newCurrency = e.target.value;
      setLocalCurrency(newCurrency);
      onChange(path, value, newCurrency);
    },
    [path, onChange, value]
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

      {/* Input Group */}
      <div className="flex gap-2">
        <input
          id={path}
          type="number"
          value={value ?? ''}
          onChange={handleAmountChange}
          step="0.01"
          min="0"
          placeholder="0.00"
          className={`
            flex-1 px-3 py-2 rounded-lg border bg-background text-foreground
            focus:outline-none focus:ring-2 focus:ring-primary/50
            ${error ? 'border-destructive focus:ring-destructive/50' : 'border-input'}
          `}
        />

        <select
          value={localCurrency}
          onChange={handleCurrencyChange}
          className="px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {CURRENCIES.map((curr) => (
            <option key={curr} value={curr}>
              {curr}
            </option>
          ))}
        </select>
      </div>

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
