"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import type { AuditResult, CteAuditRow } from "@/lib/audit/types";
import { formatBRL, formatBrNumber, isoToBrDate } from "@/lib/audit/format";
import { REASON_LABEL } from "@/lib/audit/email";
import { buildWorkbook } from "@/lib/audit/export";

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[#999]">{label}</p>
      <p className={`mt-2 font-mono text-2xl font-semibold ${accent ? "text-[#059669]" : "text-[#111]"}`}>{value}</p>
    </div>
  );
}

export function Results({
  result, onGenerateEmail,
}: {
  result: AuditResult;
  onGenerateEmail: (row: CteAuditRow) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const s = result.summary;
  const t = result.table;

  function toggle(nCT: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nCT)) next.delete(nCT);
      else next.add(nCT);
      return next;
    });
  }

  return (
    <section className="mt-10">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Recuperável" value={formatBRL(s.totalRecoverable)} accent />
        <StatCard label="CT-es Analisados" value={String(s.cteCount)} />
        <StatCard label="Taxa de Erro" value={`${formatBrNumber(s.errorRatePct, 1)}%`} />
        <StatCard label="Erro Médio por CT-e" value={formatBRL(s.avgErrorPerCte)} />
      </div>

      <div className="mt-6 rounded-xl border border-[#e5e5e5] bg-[#f7f7f5] p-5 text-xs text-[#666]">
        <p className="mb-2 text-sm font-semibold text-[#111]">Tabela interpretada — {t.carrierName}</p>
        <p>
          {t.pracas.map((p) => `${p.name} (${p.uf}): R$ ${formatBrNumber(p.rateKg)}/kg mín ${formatBRL(p.min)}`).join(" · ")}
        </p>
        <p className="mt-1">
          GRIS {formatBrNumber(t.gris.pct * 100)}% (mín {formatBRL(t.gris.min)})
          {t.adval && <> · Ad valorem {formatBrNumber(t.adval.pct * 100)}% (mín {formatBRL(t.adval.min)})</>}
          {t.pedagio && <> · Pedágio {formatBRL(t.pedagio.valuePerFraction)}/{t.pedagio.fractionKg} kg</>}
          {" · "}Cubagem {t.cubageFactorKgM3} kg/m³
          {t.tde && <> · TDE {formatBRL(t.tde.value)} ({t.tde.cities.join(", ")})</>}
          {t.reajuste && <> · Reajuste {formatBrNumber(t.reajuste.pct * 100, 0)}% a partir de {isoToBrDate(t.reajuste.effectiveDate)}</>}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-bold">Resultados</h2>
        <button
          onClick={() => XLSX.writeFile(buildWorkbook(result), "auditoria-fretes.xlsx")}
          className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium text-[#111] hover:bg-[#f7f7f5]"
        >
          Exportar Excel
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-[#e5e5e5]">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#f7f7f5] text-left text-xs uppercase tracking-wide text-[#999]">
              <th className="px-4 py-3">CT-e</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3 text-right">Cobrado</th>
              <th className="px-4 py-3 text-right">Esperado</th>
              <th className="px-4 py-3 text-right">Diferença</th>
              <th className="px-4 py-3">Motivo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => {
              const divergent = r.status === "DIVERGENTE";
              return (
                <FragmentRow
                  key={r.chave}
                  row={r}
                  divergent={divergent}
                  expanded={expanded.has(r.chave)}
                  onToggle={() => toggle(r.chave)}
                  onGenerateEmail={() => onGenerateEmail(r)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {result.skipped.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#f7f7f5] px-4 py-3 text-xs text-[#666]">
          <p className="font-semibold text-[#111]">Arquivos não processados</p>
          {result.skipped.map((sk) => (
            <p key={sk.fileName} className="mt-1 font-mono">{sk.fileName}: {sk.error}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function FragmentRow({
  row, divergent, expanded, onToggle, onGenerateEmail,
}: {
  row: CteAuditRow;
  divergent: boolean;
  expanded: boolean;
  onToggle: () => void;
  onGenerateEmail: () => void;
}) {
  return (
    <>
      <tr
        onClick={divergent ? onToggle : undefined}
        className={`border-b border-[#f0f0ee] last:border-0 ${divergent ? "cursor-pointer bg-[#fef2f2] hover:bg-[#fee2e2]/60" : "bg-white"}`}
      >
        <td className="px-4 py-2.5 font-mono">{row.nCT}</td>
        <td className="px-4 py-2.5 text-[#666]">{row.destino}</td>
        <td className="px-4 py-2.5 text-right font-mono">{formatBRL(row.charged)}</td>
        <td className="px-4 py-2.5 text-right font-mono">{formatBRL(row.expected)}</td>
        <td className={`px-4 py-2.5 text-right font-mono ${divergent ? "font-semibold text-[#b91c1c]" : "text-[#999]"}`}>
          {formatBRL(row.difference)}
        </td>
        <td className="px-4 py-2.5 text-xs text-[#666]">
          {[...new Set(row.findings.map((f) => REASON_LABEL[f.reason]))].join(", ") || "—"}
        </td>
        <td className="px-4 py-2.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${divergent ? "bg-[#ef4444]/10 text-[#b91c1c]" : "bg-[#059669]/10 text-[#059669]"}`}>
            {divergent ? "Divergente" : "OK"}
          </span>
        </td>
        <td className="px-4 py-2.5 text-right">
          {divergent && (
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateEmail(); }}
              className="rounded-md border border-[#ddd] bg-white px-2.5 py-1 text-xs font-medium hover:bg-[#f7f7f5]"
            >
              Gerar E-mail
            </button>
          )}
        </td>
      </tr>
      {expanded &&
        row.findings.map((f, i) => (
          <tr key={`${row.chave}-${i}`} className="border-b border-[#f0f0ee] bg-[#fffbeb]/50 text-xs text-[#666]">
            <td className="px-4 py-2" />
            <td className="px-4 py-2 font-mono">{f.component}</td>
            <td className="px-4 py-2 text-right font-mono">{formatBRL(f.charged)}</td>
            <td className="px-4 py-2 text-right font-mono">{formatBRL(f.expected)}</td>
            <td className="px-4 py-2 text-right font-mono text-[#b91c1c]">{formatBRL(f.difference)}</td>
            <td colSpan={3} className="px-4 py-2">{f.motivo}</td>
          </tr>
        ))}
    </>
  );
}
