import { XMLParser } from "fast-xml-parser";
import type { ParsedCte } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false, // keep everything as strings; Number() explicitly (chave precision)
  parseAttributeValue: false,
  isArray: (name) => name === "Comp" || name === "infQ",
});

export function parseCte(xml: string): ParsedCte {
  const doc = parser.parse(xml);
  const inf = doc?.CTe?.infCte;
  if (!inf) throw new Error("XML não é um CT-e válido (infCte ausente)");
  const ide = inf.ide ?? {};
  const vPrest = inf.vPrest ?? {};
  const carga = inf.infCTeNorm?.infCarga ?? {};

  const comps: Record<string, number> = {};
  for (const c of vPrest.Comp ?? []) comps[c.xNome] = Number(c.vComp);

  let pesoBruto = 0;
  let cubagemM3 = 0;
  for (const q of carga.infQ ?? []) {
    if (q.tpMed === "PESO BRUTO") pesoBruto = Number(q.qCarga);
    else if (q.tpMed === "CUBAGEM") cubagemM3 = Number(q.qCarga);
  }

  const icmsGroup = inf.imp?.ICMS
    ? (Object.values(inf.imp.ICMS)[0] as Record<string, string> | undefined)
    : undefined;

  const vTPrest = Number(vPrest.vTPrest);
  if (!Number.isFinite(vTPrest)) throw new Error("XML não é um CT-e válido (vTPrest ausente)");

  return {
    nCT: String(ide.nCT),
    chave: String(inf["@_Id"] ?? "").replace(/^CTe/, ""),
    dhEmi: String(ide.dhEmi ?? "").slice(0, 10),
    munFim: ide.xMunFim ?? "",
    ufFim: ide.UFFim ?? "",
    vTPrest,
    vRec: Number(vPrest.vRec),
    vCarga: Number(carga.vCarga ?? 0),
    comps,
    pesoBruto,
    cubagemM3,
    emit: { cnpj: String(inf.emit?.CNPJ ?? ""), nome: inf.emit?.xNome ?? "" },
    dest: { cnpj: inf.dest?.CNPJ ? String(inf.dest.CNPJ) : undefined, nome: inf.dest?.xNome ?? "" },
    icms: icmsGroup?.pICMS
      ? { pICMS: Number(icmsGroup.pICMS), vICMS: Number(icmsGroup.vICMS) }
      : undefined,
  };
}
