import * as XLSX from "xlsx";
import type { AuditResult } from "./types";

export function buildWorkbook(result: AuditResult): XLSX.WorkBook {
  const rows = result.rows.map((r) => ({
    CTe: r.nCT,
    Transportadora: r.carrier,
    Destino: r.destino,
    Data: r.date,
    "Valor Cobrado (R$)": r.charged,
    "Valor Esperado (R$)": r.expected,
    "Diferença (R$)": r.difference,
    Motivos: r.findings.map((f) => f.reason).join(", "),
    Status: r.status,
  }));
  const findings = result.rows.flatMap((r) =>
    r.findings.map((f) => ({
      CTe: r.nCT,
      Componente: f.component,
      Tipo: f.reason,
      Motivo: f.motivo,
      "Cobrado (R$)": f.charged,
      "Devido (R$)": f.expected,
      "Diferença (R$)": f.difference,
    }))
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Auditoria");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(findings), "Divergências");
  return wb;
}
