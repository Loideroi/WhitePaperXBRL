'use client';

/**
 * SectionEditor Component
 *
 * Displays and edits fields for a specific whitepaper section (Part A, B, C, etc.)
 */

import { ChevronDown, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { TextField, BooleanField, MonetaryField, TextBlockField, DateField, EnumerationField } from './fields';
import type { MappedField, ConfidenceLevel } from '@/types/whitepaper';

interface SectionField {
  path: string;
  label: string;
  type: 'text' | 'boolean' | 'monetary' | 'textblock' | 'number' | 'date' | 'enumeration';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
  /** Options for enumeration fields: key → human-readable label */
  options?: Record<string, string>;
}

interface SectionEditorProps {
  /** Section identifier (e.g., 'partA', 'partD') */
  sectionId: string;
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Fields in this section */
  fields: SectionField[];
  /** Current data values */
  data: Record<string, unknown>;
  /** Mapped fields with confidence info */
  mappings: MappedField[];
  /** Validation errors by field path */
  errors: Record<string, string>;
  /** Callback when a field value changes */
  onFieldChange: (path: string, value: unknown) => void;
  /** Whether the section is initially expanded */
  defaultExpanded?: boolean;
}

function getSectionConfidence(mappings: MappedField[], sectionId: string): number {
  const sectionMappings = mappings.filter((m) => m.path.startsWith(sectionId));
  if (sectionMappings.length === 0) return 0;

  const scores = sectionMappings.map((m) => {
    if (m.confidence === 'high') return 1;
    if (m.confidence === 'medium') return 0.7;
    return 0.4;
  });

  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
}

function getFieldConfidence(mappings: MappedField[], path: string): ConfidenceLevel | undefined {
  const mapping = mappings.find((m) => m.path === path);
  return mapping?.confidence;
}

function getFieldSource(mappings: MappedField[], path: string): string | undefined {
  const mapping = mappings.find((m) => m.path === path);
  return mapping?.source;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  // rawFields keys contain dots (e.g., "A.2", "E.14") — treat as single key
  if (path.startsWith('rawFields.')) {
    const rawFieldKey = path.slice('rawFields.'.length);
    const rawFields = obj.rawFields as Record<string, unknown> | undefined;
    return rawFields?.[rawFieldKey];
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function SectionEditor({
  sectionId,
  title,
  description,
  fields,
  data,
  mappings,
  errors,
  onFieldChange,
  defaultExpanded = true,
}: SectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const confidence = getSectionConfidence(mappings, sectionId);
  const errorCount = Object.keys(errors).filter((key) => key.startsWith(sectionId)).length;
  const completedFields = fields.filter(
    (f) => getNestedValue(data, f.path) !== undefined && getNestedValue(data, f.path) !== ''
  ).length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full px-4 py-3 flex items-center justify-between bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Completion Progress */}
          <span className="text-xs text-muted-foreground">
            {completedFields}/{fields.length} fields
          </span>

          {/* Confidence Badge */}
          {confidence > 0 && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                confidence >= 80
                  ? 'bg-green-50 text-green-600'
                  : confidence >= 60
                    ? 'bg-yellow-50 text-yellow-600'
                    : 'bg-red-50 text-red-600'
              }`}
            >
              {confidence}% conf
            </span>
          )}

          {/* Error/Success Icon */}
          {errorCount > 0 ? (
            <div className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">{errorCount}</span>
            </div>
          ) : completedFields === fields.length ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : null}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {fields.map((field) => {
            const value = getNestedValue(data, field.path);
            const confidence = getFieldConfidence(mappings, field.path);
            const source = getFieldSource(mappings, field.path);
            const error = errors[field.path];

            switch (field.type) {
              case 'text':
                return (
                  <TextField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={(value as string) || ''}
                    placeholder={field.placeholder}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={onFieldChange}
                    maxLength={field.maxLength}
                    helpText={field.helpText}
                  />
                );

              case 'boolean':
                return (
                  <BooleanField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={value as boolean | undefined}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    onChange={(path, val) => onFieldChange(path, val)}
                    helpText={field.helpText}
                  />
                );

              case 'monetary':
                return (
                  <MonetaryField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={value as number | undefined}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={(path, val) => onFieldChange(path, val)}
                    helpText={field.helpText}
                  />
                );

              case 'textblock':
                return (
                  <TextBlockField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={(value as string) || ''}
                    placeholder={field.placeholder}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={onFieldChange}
                    maxLength={field.maxLength}
                    helpText={field.helpText}
                  />
                );

              case 'number':
                return (
                  <TextField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={value !== undefined ? String(value) : ''}
                    placeholder={field.placeholder}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={(path, val) => onFieldChange(path, val ? Number(val) : undefined)}
                    helpText={field.helpText}
                  />
                );

              case 'date':
                return (
                  <DateField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={(value as string) || ''}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={onFieldChange}
                    helpText={field.helpText}
                  />
                );

              case 'enumeration':
                return (
                  <EnumerationField
                    key={field.path}
                    path={field.path}
                    label={field.label}
                    value={value as string | undefined}
                    options={field.options || {}}
                    required={field.required}
                    confidence={confidence}
                    source={source}
                    error={error}
                    onChange={onFieldChange}
                    helpText={field.helpText}
                  />
                );

              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
}
