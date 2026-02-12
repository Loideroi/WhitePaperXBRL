'use client';

/**
 * ValidationDashboard Component
 *
 * Displays validation status, errors, and warnings for whitepaper data.
 * Full validation engine implementation in Phase 5.
 */

import { AlertCircle, AlertTriangle, CheckCircle, Info, ArrowRight } from 'lucide-react';

export interface ValidationError {
  /** Field path */
  path: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Assertion code (from ESMA taxonomy) */
  code?: string;
}

interface ValidationDashboardProps {
  /** List of validation errors */
  errors: ValidationError[];
  /** Whether validation is running */
  isValidating?: boolean;
  /** Callback when a field link is clicked */
  onFieldClick?: (path: string) => void;
}

export function ValidationDashboard({
  errors,
  isValidating = false,
  onFieldClick,
}: ValidationDashboardProps) {
  const errorCount = errors.filter((e) => e.severity === 'error').length;
  const warningCount = errors.filter((e) => e.severity === 'warning').length;
  const infoCount = errors.filter((e) => e.severity === 'info').length;

  const isValid = errorCount === 0;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isValid ? 'bg-green-50' : 'bg-red-50'
        }`}
      >
        <div className="flex items-center gap-2">
          {isValid ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className={`font-medium ${isValid ? 'text-green-700' : 'text-red-700'}`}>
            {isValid ? 'Validation Passed' : `${errorCount} Error${errorCount !== 1 ? 's' : ''} Found`}
          </span>
        </div>

        {!isValid && (
          <div className="flex items-center gap-3 text-sm">
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                {warningCount}
              </span>
            )}
            {infoCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600">
                <Info className="h-4 w-4" />
                {infoCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isValidating && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Running validation checks...
        </div>
      )}

      {/* Error List */}
      {!isValidating && errors.length > 0 && (
        <div className="divide-y">
          {errors.map((error, index) => (
            <div
              key={`${error.path}-${index}`}
              className="px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors"
            >
              {/* Icon */}
              {error.severity === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              {error.severity === 'warning' && (
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              )}
              {error.severity === 'info' && (
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{error.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{error.path}</span>
                  {error.code && (
                    <span className="text-xs text-muted-foreground">({error.code})</span>
                  )}
                </div>
              </div>

              {/* Fix Button */}
              {onFieldClick && (
                <button
                  type="button"
                  onClick={() => onFieldClick(error.path)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                >
                  Fix
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isValidating && errors.length === 0 && (
        <div className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <p className="mt-3 text-sm font-medium text-green-600">All validations passed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your whitepaper data is ready for iXBRL generation
          </p>
        </div>
      )}
    </div>
  );
}
