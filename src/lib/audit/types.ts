export type Praca = { name: string; uf: string; rateKg: number; min: number };

export type FreightTable = {
  carrierName: string;
  carrierCnpj?: string;
  cubageFactorKgM3: number;
  gris: { pct: number; min: number };
  adval?: { pct: number; min: number };
  pedagio?: { valuePerFraction: number; fractionKg: number };
  tde?: { value: number; cities: string[] };
  reajuste?: { pct: number; effectiveDate: string }; // ISO yyyy-mm-dd
  expectedComponents: string[];
  pracas: Praca[];
};

export type ParsedCte = {
  nCT: string;
  chave: string;
  dhEmi: string; // ISO date part yyyy-mm-dd
  munFim: string;
  ufFim: string;
  vTPrest: number;
  vRec: number;
  vCarga: number;
  comps: Record<string, number>; // xNome -> vComp
  pesoBruto: number;
  cubagemM3: number;
  emit: { cnpj: string; nome: string };
  dest: { cnpj?: string; nome: string };
  icms?: { pICMS: number; vICMS: number };
};

export type FindingReason =
  | "REAJUSTE_ANTECIPADO"
  | "CUBAGEM_FATOR"
  | "GRIS_MAJORADO"
  | "PEDAGIO_TARIFA"
  | "TDE_INDEVIDA"
  | "TAXA_NAO_PREVISTA"
  | "FRETE_PESO_DIVERGENTE"
  | "ADVAL_DIVERGENTE";

export type Finding = {
  component: string;
  reason: FindingReason;
  motivo: string; // PT-BR explanation
  charged: number;
  expected: number;
  difference: number;
};

export type CteAuditRow = {
  nCT: string;
  chave: string;
  date: string;
  destino: string;
  carrier: string;
  charged: number;
  expected: number;
  difference: number;
  status: "DIVERGENTE" | "OK";
  findings: Finding[];
};

export type AuditResult = {
  table: FreightTable;
  summary: {
    totalRecoverable: number;
    cteCount: number;
    divergentCount: number;
    errorRatePct: number;
    avgErrorPerCte: number;
    totalFreight: number;
  };
  rows: CteAuditRow[]; // sorted by difference desc
  skipped: { fileName: string; error: string }[];
};
