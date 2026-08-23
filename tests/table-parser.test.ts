import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseFreightTable, ScannedPdfError, TableParseError } from "../src/lib/audit/table-parser";
import type { FreightTable } from "../src/lib/audit/types";

const FIX = path.join(import.meta.dirname, "fixtures");

const EXPECTED: FreightTable = {
  carrierName: "RÁPIDO PARANAENSE TRANSPORTES LTDA",
  carrierCnpj: "23.456.789/0001-77",
  cubageFactorKgM3: 300,
  gris: { pct: 0.0025, min: 8 },
  adval: { pct: 0.0012, min: 5 },
  pedagio: { valuePerFraction: 6.2, fractionKg: 100 },
  tde: { value: 85, cities: ["SAO PAULO"] },
  reajuste: { pct: 0.08, effectiveDate: "2026-07-15" },
  expectedComponents: ["FRETE PESO", "GRIS", "AD VALOREM", "PEDAGIO", "TDE"],
  pracas: [
    { name: "Curitiba e região metropolitana", uf: "PR", rateKg: 0.42, min: 95 },
    { name: "Interior do Paraná", uf: "PR", rateKg: 0.55, min: 120 },
    { name: "São Paulo — capital", uf: "SP", rateKg: 0.68, min: 150 },
    { name: "Interior de São Paulo", uf: "SP", rateKg: 0.78, min: 165 },
    { name: "Santa Catarina", uf: "SC", rateKg: 0.6, min: 130 },
    { name: "Rio Grande do Sul", uf: "RS", rateKg: 0.85, min: 180 },
    { name: "Minas Gerais", uf: "MG", rateKg: 0.82, min: 175 },
  ],
};

it("parses the demo PDF table", async () => {
  const buf = fs.readFileSync(path.join(FIX, "tabela_frete.pdf"));
  expect(await parseFreightTable(buf, "tabela_frete.pdf")).toEqual(EXPECTED);
});

it("parses the sample XLSX table to the same result", async () => {
  const buf = fs.readFileSync(path.join(FIX, "tabela_frete.xlsx"));
  expect(await parseFreightTable(buf, "tabela_frete.xlsx")).toEqual(EXPECTED);
});

it("rejects unsupported extensions", async () => {
  await expect(parseFreightTable(Buffer.from("x"), "tabela.docx")).rejects.toBeInstanceOf(TableParseError);
});

it("reports scanned/empty PDFs with the Excel-fallback message", async () => {
  // Minimal valid one-page PDF with no text content.
  const emptyPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
      "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n" +
      "trailer<</Size 4/Root 1 0 R>>\nstartxref\n164\n%%EOF"
  );
  await expect(parseFreightTable(emptyPdf, "scan.pdf")).rejects.toBeInstanceOf(ScannedPdfError);
});
