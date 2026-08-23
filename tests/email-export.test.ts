import { it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildContestationEmail } from "../src/lib/audit/email";
import { buildWorkbook } from "../src/lib/audit/export";
import { formatBRL } from "../src/lib/audit/format";
import type { AuditResult, CteAuditRow, FreightTable } from "../src/lib/audit/types";

const table = { carrierName: "Rápido Paranaense Transportes Ltda" } as FreightTable;

const row: CteAuditRow = {
  nCT: "48212",
  chave: "41260723456789000177570010000482121634408316",
  date: "2026-07-28",
  destino: "Sao Paulo/SP",
  carrier: "Rápido Paranaense Transportes Ltda",
  charged: 2000,
  expected: 1912.33,
  difference: 87.67,
  status: "DIVERGENTE",
  findings: [
    {
      component: "GRIS",
      reason: "GRIS_MAJORADO",
      motivo: "GRIS cobrado a 0,35% da NF; contrato prevê 0,25%",
      charged: 306.84,
      expected: 219.17,
      difference: 87.67,
    },
  ],
};

it("builds the PT-BR contestation email", () => {
  const { subject, body } = buildContestationEmail(row, table);
  expect(subject).toBe("Contestação de Cobrança - CTe 48212 - GRIS acima do contratado");
  expect(body).toContain("Olá equipe Rápido Paranaense Transportes Ltda");
  expect(body).toContain(`- Valor Cobrado: ${formatBRL(2000)}`);
  expect(body).toContain(`- Valor Contratado: ${formatBRL(1912.33)}`);
  expect(body).toContain(`- Diferença: ${formatBRL(87.67)}`);
  expect(body).toContain("GRIS cobrado a 0,35% da NF; contrato prevê 0,25%");
  expect(body).toContain(`solicitamos estorno / ajuste no valor de ${formatBRL(87.67)}`);
  expect(body).toContain("Att,");
});

it("refuses rows without findings", () => {
  expect(() => buildContestationEmail({ ...row, findings: [] }, table)).toThrow();
});

it("builds a two-sheet workbook that round-trips", () => {
  const result: AuditResult = {
    table,
    summary: { totalRecoverable: 87.67, cteCount: 1, divergentCount: 1, errorRatePct: 100, avgErrorPerCte: 87.67, totalFreight: 2000 },
    rows: [row],
    skipped: [],
  };
  const wb = buildWorkbook(result);
  expect(wb.SheetNames).toEqual(["Auditoria", "Divergências"]);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Auditoria"]);
  expect(rows[0]["CTe"]).toBe("48212");
  expect(rows[0]["Diferença (R$)"]).toBe(87.67);
  expect(rows[0]["Status"]).toBe("DIVERGENTE");
  const findings = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Divergências"]);
  expect(findings[0]["Tipo"]).toBe("GRIS_MAJORADO");
});
