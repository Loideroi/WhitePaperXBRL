'use client';

/**
 * ManagementBodyTable Component
 *
 * Dynamic table for managing body members (dimensional data).
 * Supports inline editing, adding, and removing members.
 */

import { useCallback } from 'react';

interface ManagementBodyMember {
  identity: string;
  businessAddress: string;
  function: string;
}

interface ManagementBodyTableProps {
  /** Field path (e.g., 'partA.managementBody') */
  path: string;
  /** Table label */
  label: string;
  /** Current members list */
  members: ManagementBodyMember[];
  /** Callback when members change */
  onChange: (path: string, members: ManagementBodyMember[]) => void;
  /** Help text */
  helpText?: string;
}

export function ManagementBodyTable({
  path,
  label,
  members,
  onChange,
  helpText,
}: ManagementBodyTableProps) {
  const handleMemberChange = useCallback(
    (index: number, field: keyof ManagementBodyMember, value: string) => {
      const updated = members.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      );
      onChange(path, updated);
    },
    [path, members, onChange]
  );

  const handleAddMember = useCallback(() => {
    const newMember: ManagementBodyMember = {
      identity: '',
      businessAddress: '',
      function: '',
    };
    onChange(path, [...members, newMember]);
  }, [path, members, onChange]);

  const handleRemoveMember = useCallback(
    (index: number) => {
      const updated = members.filter((_, i) => i !== index);
      onChange(path, updated);
    },
    [path, members, onChange]
  );

  return (
    <div className="space-y-1.5">
      {/* Label */}
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* Table */}
      {members.length > 0 ? (
        <div className="rounded-lg border border-input overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">
                  #
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Identity/Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Business Address
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Function/Role
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member, index) => (
                <tr
                  key={index}
                  className="border-t border-input"
                >
                  {/* Row Number */}
                  <td className="px-3 py-2 text-sm text-muted-foreground align-top">
                    {index + 1}
                  </td>

                  {/* Identity/Name */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={member.identity}
                      onChange={(e) =>
                        handleMemberChange(index, 'identity', e.target.value)
                      }
                      placeholder="Full name"
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </td>

                  {/* Business Address */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={member.businessAddress}
                      onChange={(e) =>
                        handleMemberChange(index, 'businessAddress', e.target.value)
                      }
                      placeholder="Business address"
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </td>

                  {/* Function/Role */}
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={member.function}
                      onChange={(e) =>
                        handleMemberChange(index, 'function', e.target.value)
                      }
                      placeholder="Role or function"
                      className="w-full px-2 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </td>

                  {/* Remove Button */}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(index)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-input bg-background text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                      title="Remove member"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-lg border border-input bg-muted/30 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No management body members added yet.
          </p>
        </div>
      )}

      {/* Add Member Button */}
      <button
        type="button"
        onClick={handleAddMember}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-background text-sm font-medium text-foreground hover:border-primary/50 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Member
      </button>

      {/* Help Text */}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
