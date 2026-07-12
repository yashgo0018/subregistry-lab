/**
 * Customize the roles a subname OWNER receives at registration.
 * Checkbox grid driven by ROLE_CATALOG; shows the raw hex for the curious.
 */

import { ROLE_CATALOG, adminOf, bitmapHex } from "../lib/roles";

export function RoleMatrixEditor({
  bitmap,
  onChange,
  disabled,
}: {
  bitmap: bigint;
  onChange: (next: bigint) => void;
  disabled?: boolean;
}) {
  // Roles meaningful on an individual subname (registry-wide roles excluded).
  const editable = ROLE_CATALOG.filter((c) =>
    ["unregister", "renew", "setSubregistry", "setResolver", "canTransferAdmin"].includes(c.id),
  );

  const toggle = (bit: bigint) => onChange(bitmap & bit ? bitmap & ~bit : bitmap | bit);

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide opacity-50">
            <th className="py-1 pr-4 font-medium">Subname owner can…</th>
            <th className="w-20 py-1 text-center font-medium">Allowed</th>
            <th className="w-24 py-1 text-center font-medium">Can delegate</th>
          </tr>
        </thead>
        <tbody>
          {editable.map((role) => (
            <tr key={role.id} className="border-t border-neutral-200">
              <td className="py-2 pr-4">{role.label}</td>
              <td className="py-2 text-center">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={(bitmap & role.bit) !== 0n}
                  onChange={() => toggle(role.bit)}
                />
              </td>
              <td className="py-2 text-center">
                {!role.adminOnly && (
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={(bitmap & adminOf(role.bit)) !== 0n}
                    onChange={() => toggle(adminOf(role.bit))}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs opacity-50">
        role bitmap: <code className="font-mono">{bitmapHex(bitmap)}</code>
      </p>
    </div>
  );
}
