import { it, expect, describe } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { audit, auditCte } from "../src/lib/audit/engine";
import { parseCte } from "../src/lib/audit/cte-parser";
import { parseFreightTable } from "../src/lib/audit/table-parser";
import type { FreightTable, ParsedCte } from "../src/lib/audit/types";

const FIX = path.join(import.meta.dirname, "fixtures");

// Map the demo's structured table JSON into our FreightTable (engine-isolated golden test).
function tableFromDemoJson(): FreightTable {
  const j = JSON.parse(fs.readFileSync(path.join(FIX, "tabela_frete.json"), "utf8"));
  return {
    carrierName: j.transportadora.nome,
    cubageFactorKgM3: j.fator_cubagem_kg_m3,
    gris: { pct: j.gris.pct, min: j.gris.min },
    adval: { pct: j.adval.pct, min: j.adval.min },
    pedagio: { valuePerFraction: j.pedagio.valor_por_fracao, fractionKg: j.pedagio.fracao_kg },
    tde: { value: j.tde.valor, cities: j.tde.pracas },
    reajuste: { pct: j.reajuste.percentual, effectiveDate: j.reajuste.vigencia },
    expectedComponents: j.taxas_previstas,
    pracas: Object.entries(j.pracas as Record<string, { uf: string; rate_kg: number; min: number }>).map(([name, p]) => ({
      name,
      uf: p.uf,
      rateKg: p.rate_kg,
      min: p.min,
    })),
  };
}

function loadCtes() {
  return fs
    .readdirSync(path.join(FIX, "ctes"))
    .filter((f) => f.endsWith(".xml"))
    .sort()
    .map((f) => ({
      fileName: f,
      cte: parseCte(fs.readFileSync(path.join(FIX, "ctes", f), "utf8")),
    }));
}

const golden = JSON.parse(fs.readFileSync(path.join(FIX, "achados.json"), "utf8"));

function checkAgainstGolden(result: ReturnType<typeof audit>) {
  expect(result.skipped).toEqual([]);
  expect(result.summary.cteCount).toBe(golden.resumo.ctes_auditados); // 200
  expect(result.summary.totalFreight).toBeCloseTo(golden.resumo.frete_total, 2); // 423483.75
  expect(result.summary.divergentCount).toBe(golden.resumo.ctes_com_divergencia); // 37
  expect(result.summary.totalRecoverable).toBeCloseTo(golden.resumo.total_divergencia, 2); // 5177.78

  // Every individual finding must match (nCT, component, type, values).
  const mine = result.rows
    .flatMap((r) => r.findings.map((f) => `${r.nCT}|${f.component}|${f.reason}|${f.charged}|${f.expected}|${f.difference}`))
    .sort();
  const theirs = golden.achados
    .map((a: { nCT: string; componente: string; tipo: string; cobrado: number; devido: number; diferenca: number }) =>
      `${a.nCT}|${a.componente}|${a.tipo}|${a.cobrado}|${a.devido}|${a.diferenca}`)
    .sort();
  expect(mine).toEqual(theirs);
}

describe("golden audit of the 200 demo CTes", () => {
  it("reproduces achados.json using the structured table", () => {
    checkAgainstGolden(audit(tableFromDemoJson(), loadCtes()));
  });

  it("reproduces achados.json end-to-end from the PDF table", async () => {
    const buf = fs.readFileSync(path.join(FIX, "tabela_frete.pdf"));
    const table = await parseFreightTable(buf, "tabela_frete.pdf");
    checkAgainstGolden(audit(table, loadCtes()));
  });
});

// Minimal fixtures for the targeted branch tests below (no golden-data dependency).
function minimalTable(overrides: Partial<FreightTable> = {}): FreightTable {
  return {
    carrierName: "Test Carrier",
    cubageFactorKgM3: 300,
    gris: { pct: 0.01, min: 10 },
    expectedComponents: ["FRETE PESO"],
    pracas: [{ name: "SP", uf: "SP", rateKg: 1, min: 50 }],
    ...overrides,
  };
}

function minimalCte(overrides: Partial<ParsedCte> = {}): ParsedCte {
  return {
    nCT: "1",
    chave: "chave1",
    dhEmi: "2026-01-01",
    munFim: "Sao Paulo",
    ufFim: "SP",
    vTPrest: 100,
    vRec: 100,
    vCarga: 1000,
    comps: { "FRETE PESO": 100 },
    pesoBruto: 100,
    cubagemM3: 0,
    emit: { cnpj: "1", nome: "Emit" },
    dest: { nome: "Dest" },
    ...overrides,
  };
}

it("TDE charged with no TDE clause in the table falls through to a single TAXA_NAO_PREVISTA finding (no double count)", () => {
  const table = minimalTable(); // no `tde` field at all
  const cte = minimalCte({ comps: { "FRETE PESO": 100, TDE: 85 }, vTPrest: 185 });
  const findings = auditCte(cte, table);
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({ component: "TDE", reason: "TAXA_NAO_PREVISTA" });
});

it("FRETE PESO divergence matching neither diagnostic hypothesis reports FRETE_PESO_DIVERGENTE", () => {
  const table = minimalTable(); // no reajuste, cubagemM3 = 0 so cubage-350 hypothesis can't match a real divergence
  const cte = minimalCte({ comps: { "FRETE PESO": 150 }, vTPrest: 150 });
  const findings = auditCte(cte, table);
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    component: "FRETE PESO", reason: "FRETE_PESO_DIVERGENTE", charged: 150, expected: 100,
  });
});

it("AD VALOREM above max(min, vCarga*pct) reports ADVAL_DIVERGENTE", () => {
  const table = minimalTable({
    adval: { pct: 0.02, min: 5 },
    expectedComponents: ["FRETE PESO", "AD VALOREM"],
  });
  const cte = minimalCte({ comps: { "FRETE PESO": 100, "AD VALOREM": 21 }, vTPrest: 121, vCarga: 1000 });
  const findings = auditCte(cte, table);
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    component: "AD VALOREM", reason: "ADVAL_DIVERGENTE", charged: 21, expected: 20,
  });
});

it("rows are sorted by difference descending and unresolved praças are skipped", () => {
  const table = tableFromDemoJson();
  const items = loadCtes().slice(0, 20);
  const bad = structuredClone(items[0]);
  bad.fileName = "bad.xml";
  bad.cte.ufFim = "BA";
  const result = audit(table, [...items, bad]);
  expect(result.skipped).toEqual([{ fileName: "bad.xml", error: expect.stringContaining("BA") }]);
  const diffs = result.rows.map((r) => r.difference);
  expect(diffs).toEqual([...diffs].sort((a, b) => b - a));
});
