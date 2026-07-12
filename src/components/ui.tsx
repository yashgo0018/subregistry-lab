/** Small shared UI pieces. */

import type { ReactNode } from "react";
import { etherscanAddress } from "../lib/links";

export function shortAddr(addr?: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={etherscanAddress(address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-sm underline decoration-dotted underline-offset-2 hover:opacity-70"
      title={address}
    >
      {shortAddr(address)}
    </a>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm underline decoration-dotted underline-offset-2 hover:opacity-70"
    >
      {children} ↗
    </a>
  );
}

export function Section({
  step,
  title,
  enabled,
  children,
}: {
  step: number;
  title: string;
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 transition-opacity ${
        enabled ? "border-neutral-300 bg-white" : "border-neutral-200 bg-neutral-50 opacity-50"
      }`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">
          {step}
        </span>
        {title}
      </h2>
      {enabled ? children : <p className="text-sm">Complete the previous step first.</p>}
    </section>
  );
}

/** ⓘ with a hover tooltip; pure CSS, no positioning deps. */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block align-middle">
      <span
        className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-500"
        aria-label={text}
      >
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-72 -translate-x-1/2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-neutral-800 shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function WarningBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
      {children}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "neutral";
  children: ReactNode;
}) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    neutral: "bg-neutral-200 text-neutral-700",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function formatExpiry(expiry?: bigint): string {
  if (expiry === undefined) return "";
  if (expiry >= 2n ** 64n - 1n) return "never expires";
  return new Date(Number(expiry) * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
