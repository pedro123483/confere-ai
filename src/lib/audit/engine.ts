import type { AuditResult, CteAuditRow, Finding, FindingReason, FreightTable, ParsedCte } from "./types";
import { r2, formatBrNumber, isoToBrDate, normalizeCity } from "./format";
import { resolvePraca } from "./praca-resolver";

const TOL = 0.05; // R$ rounding tolerance per component, same as auditoria.py
// ponytail: hardcoded diagnostic hypothesis (the classic wrong cubage factor); generalize when a second wrong factor shows up
const WRONG_CUBAGE_FACTOR = 350;

export function auditCte(cte: ParsedCte, table: FreightTable): Finding[] {
  const praca = resolvePraca(cte.munFim, cte.ufFim, table.pracas);
  if (!praca) throw new Error(`Praça não encontrada na tabela para ${cte.munFim}/${cte.ufFim}`);

  const findings: Finding[] = [];
  const add = (component: string, charged: number, expected: number, reason: FindingReason, motivo: string) => {
    if (charged - expected > TOL) {
      findings.push({ component, reason, motivo, charged: r2(charged), expected: r2(expected), difference: r2(charged - expected) });
    }
  };

  const cubado = cte.cubagemM3 * table.cubageFactorKgM3;
  const taxable = Math.max(cte.pesoBruto, cubado);
  const rea = table.reajuste;
  let rate = praca.rateKg;
  let min = praca.min;
  if (rea && cte.dhEmi >= rea.effectiveDate) {
    rate *= 1 + rea.pct;
    min *= 1 + rea.pct;
  }

  // FRETE PESO — with diagnostic hypotheses for WHY it diverged
  const expectedFp = r2(Math.max(min, taxable * rate));
  const chargedFp = cte.comps["FRETE PESO"] ?? 0;
  if (chargedFp - expectedFp > TOL) {
    const reaPct = rea?.pct ?? 0;
    const hReajuste = r2(Math.max(praca.min * (1 + reaPct), taxable * praca.rateKg * (1 + reaPct)));
    const taxable350 = Math.max(cte.pesoBruto, cte.cubagemM3 * WRONG_CUBAGE_FACTOR);
    const hCubagem = r2(Math.max(min, taxable350 * rate));
    if (rea && cte.dhEmi < rea.effectiveDate && Math.abs(chargedFp - hReajuste) <= TOL) {
      add("FRETE PESO", chargedFp, expectedFp, "REAJUSTE_ANTECIPADO",
        `Tabela reajustada (+${formatBrNumber(reaPct * 100, 0)}%) aplicada em ${isoToBrDate(cte.dhEmi)}; vigência contratual só em ${isoToBrDate(rea.effectiveDate)}`);
    } else if (Math.abs(chargedFp - hCubagem) <= TOL) {
      add("FRETE PESO", chargedFp, expectedFp, "CUBAGEM_FATOR",
        `Peso cubado calculado com fator ${WRONG_CUBAGE_FACTOR} kg/m³; contrato prevê ${table.cubageFactorKgM3} kg/m³`);
    } else {
      add("FRETE PESO", chargedFp, expectedFp, "FRETE_PESO_DIVERGENTE",
        "Valor cobrado acima da tabela vigente para a praça");
    }
  }

  // GRIS
  if ("GRIS" in cte.comps) {
    const expectedGris = r2(Math.max(table.gris.min, cte.vCarga * table.gris.pct));
    const pctEfetivo = cte.vCarga > 0 ? (cte.comps["GRIS"] / cte.vCarga) * 100 : 0;
    add("GRIS", cte.comps["GRIS"], expectedGris, "GRIS_MAJORADO",
      `GRIS cobrado a ${formatBrNumber(pctEfetivo)}% da NF; contrato prevê ${formatBrNumber(table.gris.pct * 100)}%`);
  }

  // AD VALOREM
  if (table.adval && "AD VALOREM" in cte.comps) {
    const expectedAdv = r2(Math.max(table.adval.min, cte.vCarga * table.adval.pct));
    add("AD VALOREM", cte.comps["AD VALOREM"], expectedAdv, "ADVAL_DIVERGENTE",
      "Ad valorem acima do percentual contratado");
  }

  // PEDÁGIO
  if (table.pedagio && "PEDAGIO" in cte.comps) {
    const { valuePerFraction, fractionKg } = table.pedagio;
    const fracoes = Math.floor(taxable / fractionKg) + 1;
    const expectedPed = r2(fracoes * valuePerFraction);
    if (cte.comps["PEDAGIO"] - expectedPed > TOL) {
      const frac350 = Math.floor(Math.max(cte.pesoBruto, cte.cubagemM3 * WRONG_CUBAGE_FACTOR) / fractionKg) + 1;
      if (Math.abs(cte.comps["PEDAGIO"] - r2(frac350 * valuePerFraction)) <= TOL) {
        add("PEDAGIO", cte.comps["PEDAGIO"], expectedPed, "CUBAGEM_FATOR",
          `Frações de pedágio calculadas sobre peso cubado com fator ${WRONG_CUBAGE_FACTOR} kg/m³; contrato prevê ${table.cubageFactorKgM3} kg/m³`);
      } else {
        add("PEDAGIO", cte.comps["PEDAGIO"], expectedPed, "PEDAGIO_TARIFA",
          `Pedágio a R$ ${formatBrNumber(cte.comps["PEDAGIO"] / fracoes)}/fração de ${fractionKg} kg; contrato prevê R$ ${formatBrNumber(valuePerFraction)}`);
      }
    }
  }

  // TDE — only allowed in the table's listed cities
  if ("TDE" in cte.comps) {
    const allowed = table.tde?.cities.includes(normalizeCity(cte.munFim)) ?? false;
    if (!allowed) {
      add("TDE", cte.comps["TDE"], 0, "TDE_INDEVIDA",
        `TDE cobrada em ${cte.munFim}/${cte.ufFim}; sem previsão contratual para esta praça`);
    }
  }

  // Components with no contractual basis at all
  for (const [nome, valor] of Object.entries(cte.comps)) {
    if (!table.expectedComponents.includes(nome)) {
      add(nome, valor, 0, "TAXA_NAO_PREVISTA", `Componente '${nome}' sem previsão contratual`);
    }
  }

  return findings;
}

export function audit(table: FreightTable, items: { fileName: string; cte: ParsedCte }[]): AuditResult {
  const rows: CteAuditRow[] = [];
  const skipped: { fileName: string; error: string }[] = [];
  let totalFreight = 0;

  for (const { fileName, cte } of items) {
    try {
      const findings = auditCte(cte, table);
      totalFreight += cte.vTPrest;
      const difference = r2(findings.reduce((s, f) => s + f.difference, 0));
      rows.push({
        nCT: cte.nCT,
        chave: cte.chave,
        date: cte.dhEmi,
        destino: `${cte.munFim}/${cte.ufFim}`,
        carrier: cte.emit.nome,
        charged: cte.vTPrest,
        expected: r2(cte.vTPrest - difference),
        difference,
        status: findings.length > 0 ? "DIVERGENTE" : "OK",
        findings,
      });
    } catch (e) {
      skipped.push({ fileName, error: e instanceof Error ? e.message : String(e) });
    }
  }

  rows.sort((a, b) => b.difference - a.difference);
  const divergentCount = rows.filter((r) => r.status === "DIVERGENTE").length;
  const totalRecoverable = r2(rows.reduce((s, r) => s + r.difference, 0));

  return {
    table,
    rows,
    skipped,
    summary: {
      totalRecoverable,
      cteCount: rows.length,
      divergentCount,
      errorRatePct: rows.length ? r2((divergentCount / rows.length) * 100) : 0,
      avgErrorPerCte: rows.length ? r2(totalRecoverable / rows.length) : 0,
      totalFreight: r2(totalFreight),
    },
  };
}
