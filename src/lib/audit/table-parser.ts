import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import type { FreightTable, Praca } from "./types";
import { parseBrNumber, brDateToIso, normalizeCity } from "./format";

export class TableParseError extends Error {}

export class ScannedPdfError extends TableParseError {
  constructor() {
    super("Não foi possível ler o PDF automaticamente. Envie a versão em Excel da tabela.");
  }
}

export async function parseFreightTable(buf: Buffer, fileName: string): Promise<FreightTable> {
  const lower = fileName.toLowerCase();
  let text: string;
  if (lower.endsWith(".pdf")) {
    let extracted: string;
    try {
      const result = await new PDFParse({ data: new Uint8Array(buf) }).getText();
      extracted = result.text ?? "";
    } catch (e) {
      if (process.env.NODE_ENV !== "test") console.error("pdf-parse getText failed:", e);
      throw new ScannedPdfError();
    }
    if (extracted.replace(/\s/g, "").length < 50) throw new ScannedPdfError();
    text = extracted;
  } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    text = wb.SheetNames.map((n) =>
      (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false }) as string[][])
        .map((row) => (row ?? []).filter(Boolean).join(" "))
        .join("\n")
    ).join("\n");
  } else {
    throw new TableParseError("Formato de tabela não suportado. Envie PDF ou Excel (.xlsx/.xls).");
  }
  return extractTable(text);
}

export function extractTable(rawText: string): FreightTable {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const flat = lines.join(" ").replace(/\s+/g, " ");

  const carrierName = lines[0] ?? "";
  const cnpj = flat.match(/CNPJ\s*([\d.\/-]{14,18})/i);

  const headerIdx = flat.search(/Pra[çc]a de destino/i);
  const endIdx = flat.search(/Generalidades/i);
  const tableBlob = flat.slice(headerIdx >= 0 ? headerIdx : 0, endIdx >= 0 ? endIdx : undefined);
  const rowRe =
    /([A-Za-zÀ-ú][A-Za-zÀ-ú\s—–-]*?)\s+([A-Z]{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/g;
  const pracas: Praca[] = [...tableBlob.matchAll(rowRe)].map((m) => ({
    name: m[1].trim(),
    uf: m[2],
    rateKg: parseBrNumber(m[3]),
    min: parseBrNumber(m[4]),
  }));
  if (pracas.length === 0) {
    throw new TableParseError("Nenhuma praça de destino encontrada na tabela.");
  }

  const gris = flat.match(/GRIS.*?(\d+(?:,\d+)?)\s*%.*?R\$\s*([\d.,]+)/i);
  if (!gris) throw new TableParseError("Regra de GRIS não encontrada na tabela.");
  const cubage = flat.match(/(\d+)\s*kg\/m/);
  if (!cubage) throw new TableParseError("Fator de cubagem não encontrado na tabela.");
  const adval = flat.match(/Ad valorem.*?(\d+(?:,\d+)?)\s*%.*?R\$\s*([\d.,]+)/i);
  const pedagio = flat.match(/Ped[áa]gio.*?R\$\s*([\d.,]+)\s*por fra[çc][ãa]o de\s*(\d+)\s*kg/i);
  const tde = flat.match(/TDE.*?R\$\s*([\d.,]+).*?entregas em\s+([A-Za-zÀ-ú\s]+?)\s*\//i);
  const reajuste = flat.match(/reajuste de\s*(\d+(?:,\d+)?)\s*%.*?a partir de\s*(\d{2}\/\d{2}\/\d{4})/i);

  const expectedComponents = ["FRETE PESO", "GRIS"];
  if (adval) expectedComponents.push("AD VALOREM");
  if (pedagio) expectedComponents.push("PEDAGIO");
  if (tde) expectedComponents.push("TDE");

  return {
    carrierName,
    carrierCnpj: cnpj?.[1],
    cubageFactorKgM3: Number(cubage[1]),
    gris: { pct: parseBrNumber(gris[1]) / 100, min: parseBrNumber(gris[2]) },
    adval: adval ? { pct: parseBrNumber(adval[1]) / 100, min: parseBrNumber(adval[2]) } : undefined,
    pedagio: pedagio
      ? { valuePerFraction: parseBrNumber(pedagio[1]), fractionKg: Number(pedagio[2]) }
      : undefined,
    // ponytail: single-city TDE parse; the demo table only restricts TDE to one city
    tde: tde ? { value: parseBrNumber(tde[1]), cities: [normalizeCity(tde[2])] } : undefined,
    reajuste: reajuste
      ? { pct: parseBrNumber(reajuste[1]) / 100, effectiveDate: brDateToIso(reajuste[2]) }
      : undefined,
    expectedComponents,
    pracas,
  };
}
