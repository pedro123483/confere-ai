"use client";

import { useState } from "react";
import type { CteAuditRow, FreightTable } from "@/lib/audit/types";
import { buildContestationEmail } from "@/lib/audit/email";

export function EmailModal({
  row, table, onClose,
}: {
  row: CteAuditRow;
  table: FreightTable;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { subject, body } = buildContestationEmail(row, table);

  async function copy() {
    await navigator.clipboard.writeText(`Assunto: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-[#111]">E-mail de Contestação — CT-e {row.nCT}</h3>
          <button onClick={onClose} className="text-lg text-[#999] hover:text-[#111]">×</button>
        </div>
        <p className="mt-4 rounded-lg bg-[#f7f7f5] px-3 py-2 text-sm font-medium text-[#111]">
          Assunto: {subject}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[#e5e5e5] p-4 font-sans text-sm leading-relaxed text-[#333]">
          {body}
        </pre>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium hover:bg-[#f7f7f5]">
            Fechar
          </button>
          <button onClick={copy} className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white hover:opacity-85">
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
