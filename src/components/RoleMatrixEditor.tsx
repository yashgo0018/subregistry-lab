/**
 * Customize the roles a subname OWNER receives at registration.
 * Checkbox grid driven by ROLE_CATALOG; per-row and per-column tooltips
 * explain the exact contract semantics; shows the raw hex for the curious.
 */

import { ROLE_CATALOG, adminOf, bitmapHex } from "../lib/roles";
import { InfoTip } from "./ui";

const ALLOWED_TIP =
  "Granted to the subname's owner on their own name when it is registered. It applies only to that subname. If the subname is transferred, every permission the owner holds moves to the new owner automatically.";

const DELEGATE_TIP =
  "Also grants the matching admin role. An admin can give this permission to any account and take it away again, including from themselves, and can pass the delegation right itself on. Holding only the admin role does not let you use the permission, but you can grant it to yourself.";

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
          <tr className="text-left text-xs uppercase tracking-wide opacity-70">
            <th className="py-1 pr-4 font-medium">Subname owner can…</th>
            <th className="w-20 py-1 text-center font-medium">
              Allowed
              <InfoTip text={ALLOWED_TIP} />
            </th>
            <th className="w-28 py-1 text-center font-medium">
              Can delegate
              <InfoTip text={DELEGATE_TIP} />
            </th>
          </tr>
        </thead>
        <tbody>
          {editable.map((role) => (
            <tr key={role.id} className="border-t border-neutral-200">
              <td className="py-2 pr-4">
                {role.subnameLabel ?? role.label}
                {role.subnameDetail && <InfoTip text={role.subnameDetail} />}
              </td>
              {role.adminOnly ? (
                // Admin-only role: ONE bit grants both the capability and its
                // delegation, so the checkbox spans both columns.
                <td colSpan={2} className="py-2 text-center">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={(bitmap & role.bit) !== 0n}
                      onChange={() => toggle(role.bit)}
                    />
                    <span className="text-xs opacity-60">includes delegation</span>
                  </label>
                </td>
              ) : (
                <>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={(bitmap & role.bit) !== 0n}
                      onChange={() => toggle(role.bit)}
                    />
                  </td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={(bitmap & adminOf(role.bit)) !== 0n}
                      onChange={() => toggle(adminOf(role.bit))}
                    />
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs opacity-60">
        These are defaults granted at registration. Until you lock the registry (Advanced
        section), your registry-wide admin roles can still change any of them later.
      </p>
      <p className="text-xs opacity-50">
        role bitmap: <code className="font-mono">{bitmapHex(bitmap)}</code>
      </p>
    </div>
  );
}
