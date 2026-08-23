import type { CteAuditRow, FindingReason, FreightTable } from "./types";
import { formatBRL } from "./format";

export const REASON_LABEL: Record<FindingReason, string> = {
  REAJUSTE_ANTECIPADO: "Reajuste antes da vigência",
  CUBAGEM_FATOR: "Cubagem com fator incorreto",
  GRIS_MAJORADO: "GRIS acima do contratado",
  PEDAGIO_TARIFA: "Pedágio com tarifa incorreta",
  TDE_INDEVIDA: "TDE sem previsão contratual",
  TAXA_NAO_PREVISTA: "Taxa não prevista em contrato",
  FRETE_PESO_DIVERGENTE: "Frete-peso acima da tabela",
  ADVAL_DIVERGENTE: "Ad valorem acima do contratado",
};

export function buildContestationEmail(row: CteAuditRow, table: FreightTable): { subject: string; body: string } {
  if (row.findings.length === 0) throw new Error("CTe sem divergências não gera contestação");
  const main = [...row.findings].sort((a, b) => b.difference - a.difference)[0];
  const subject = `Contestação de Cobrança - CTe ${row.nCT} - ${REASON_LABEL[main.reason]}`;
  const motivos = row.findings
    .map((f) => `- Motivo: ${f.motivo} (cobrado ${formatBRL(f.charged)}, contratado ${formatBRL(f.expected)})`)
    .join("\n");
  const body = `Olá equipe ${table.carrierName},

Identificamos divergência na cobrança do CTe ${row.nCT} referente ao nosso contrato.

- Valor Cobrado: ${formatBRL(row.charged)}
- Valor Contratado: ${formatBRL(row.expected)}
- Diferença: ${formatBRL(row.difference)}
${motivos}

Conforme tabela vigente ${table.carrierName}, solicitamos estorno / ajuste no valor de ${formatBRL(row.difference)}.

Seguem em anexo CTe e tabela para conferência.

Aguardo retorno.

Att,
[Seu Nome]`;
  return { subject, body };
}
