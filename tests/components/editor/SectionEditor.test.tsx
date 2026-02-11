import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionEditor } from '@/components/editor/SectionEditor';

const noop = vi.fn();

function renderBoolean(value: unknown) {
  render(
    <SectionEditor
      sectionId="test"
      title="Test Section"
      fields={[
        { path: 'rawFields.D.6', label: 'Bool Field', type: 'boolean' },
      ]}
      data={{ rawFields: { 'D.6': value } } as Record<string, unknown>}
      mappings={[]}
      errors={{}}
      onFieldChange={noop}
      defaultExpanded
    />
  );
}

describe('SectionEditor boolean coercion', () => {
  it('coerces string containing "True" / "Yes" to true', () => {
    renderBoolean("'True' – Yes");
    const yesBtn = screen.getByRole('button', { name: 'Yes' });
    // Active button gets bg-primary class
    expect(yesBtn.className).toContain('bg-primary');
  });

  it('coerces string containing "False" / "No" to false', () => {
    renderBoolean("'False' – No");
    const noBtn = screen.getByRole('button', { name: 'No' });
    expect(noBtn.className).toContain('bg-primary');
  });

  it('coerces "Not applicable" to undefined (neutral)', () => {
    renderBoolean('Not applicable');
    const yesBtn = screen.getByRole('button', { name: 'Yes' });
    const noBtn = screen.getByRole('button', { name: 'No' });
    // Neither button should be active
    expect(yesBtn.className).not.toContain('bg-primary text-primary-foreground border-primary');
    expect(noBtn.className).not.toContain('bg-primary text-primary-foreground border-primary');
  });

  it('passes actual boolean true through unchanged', () => {
    renderBoolean(true);
    const yesBtn = screen.getByRole('button', { name: 'Yes' });
    expect(yesBtn.className).toContain('bg-primary');
  });

  it('passes actual boolean false through unchanged', () => {
    renderBoolean(false);
    const noBtn = screen.getByRole('button', { name: 'No' });
    expect(noBtn.className).toContain('bg-primary');
  });
});
