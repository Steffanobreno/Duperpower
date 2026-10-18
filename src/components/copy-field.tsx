"use client";
import { useState } from "react";

/** A read-only value with a Copy button (links the owner pastes into other apps). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm text-muted"
        />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-brand"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
