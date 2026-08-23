# Freight Audit MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stateless single-page tool at `/audit` that parses one freight table (PDF/XLSX) + up to 50 CTe XMLs, audits charged vs contracted values, and shows recoverable amounts with Excel export and contestation emails.

**Architecture:** All audit logic is pure TypeScript in `src/lib/audit/` (a port of the reference `auditoria.py`). One route handler `POST /api/audit` does parse+audit in memory and returns an `AuditResult` JSON. The `/audit` page (client components) uploads files, renders the dashboard, and does Excel export and email generation client-side. No DB, no auth, no LLM, no external services.

**Tech Stack:** Next.js 16.2.2 (app router, already installed), Tailwind v4, `react-dropzone`, `fast-xml-parser`, `xlsx`, `pdf-parse@^2.4.5`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-08-23-freight-audit-mvp-design.md`

## Global Constraints

- Next.js is **16.2.2**, NOT 14. Do not guess APIs from memory — docs are at `node_modules/next/dist/docs/01-app/`. (Verified: route handlers are standard `export async function POST(request: Request)` in `app/**/route.ts`.)
- `pdf-parse` must be **v2.x** (`^2.4.5`). v1.1.1 fails on the demo PDF with "bad XRef entry". v2 API (verified working): `new PDFParse({ data: new Uint8Array(buf) })` then `await parser.getText()` → `{ text }`. It is ESM + TypeScript native — no `@types` package, no subpath import hacks.
- All UI copy is **PT-BR**. Currency renders via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` (note: it emits a non-breaking space ` ` after `R$` — tests must build expected strings with the same formatter, never hand-typed).
- Divergence tolerance is **R$ 0,05 per component** (`TOL = 0.05`), matching `auditoria.py`. Only over-charges are findings.
- Fixtures live in `tests/fixtures/` (copied from `/Users/sp16483/Documents/projects/demo_auditoria_fretes_1`). Golden numbers the engine MUST reproduce: 200 CTes audited, total freight **423483.75**, **37** divergent CTes, total divergence **5177.78**, findings by type: GRIS_MAJORADO 9× (784.59), REAJUSTE_ANTECIPADO 6× (785.80), CUBAGEM_FATOR 12× (2726.19), TDE_INDEVIDA 4× (340.00), PEDAGIO_TARIFA 5× (226.20), TAXA_NAO_PREVISTA 7× (315.00) — 43 findings total.
- Path alias `@/*` → `./src/*` exists in tsconfig; `vitest.config.ts` (Task 1) mirrors it so tests can import route/lib files either way.
- Commit after every green test cycle. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- No new dependencies beyond the ones named in Task 1.

---

### Task 1: Project setup — dependencies, fixtures, test runner

**Files:**
- Modify: `package.json` (deps + `"test": "vitest run"` script)
- Modify: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `tests/fixtures/` (copied demo data)
- Test: `tests/fixtures.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs vitest; fixtures at `tests/fixtures/ctes/*.xml` (200 files), `tests/fixtures/tabela_frete.pdf`, `tests/fixtures/tabela_frete.json`, `tests/fixtures/achados.json`. All later tasks rely on these paths.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-dropzone fast-xml-parser xlsx pdf-parse@^2.4.5
npm install -D vitest
```

- [ ] **Step 2: Add test script and next config**

In `package.json` scripts, add: `"test": "vitest run"`.

Replace `next.config.ts` contents with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Copy fixtures**

```bash
mkdir -p tests/fixtures
cp -R /Users/sp16483/Documents/projects/demo_auditoria_fretes_1/ctes tests/fixtures/ctes
cp /Users/sp16483/Documents/projects/demo_auditoria_fretes_1/tabela_frete.pdf \
   /Users/sp16483/Documents/projects/demo_auditoria_fretes_1/tabela_frete.json \
   /Users/sp16483/Documents/projects/demo_auditoria_fretes_1/achados.json \
   tests/fixtures/
```

- [ ] **Step 4: Write fixtures sanity test**

`tests/fixtures.test.ts`:

```ts
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const FIX = path.join(import.meta.dirname, "fixtures");

it("demo fixtures are in place", () => {
  const xmls = fs.readdirSync(path.join(FIX, "ctes")).filter((f) => f.endsWith(".xml"));
  expect(xmls).toHaveLength(200);
  expect(fs.existsSync(path.join(FIX, "tabela_frete.pdf"))).toBe(true);
  expect(fs.existsSync(path.join(FIX, "tabela_frete.json"))).toBe(true);
  expect(fs.existsSync(path.join(FIX, "achados.json"))).toBe(true);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 1 test PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json next.config.ts vitest.config.ts tests/
git commit -m "chore: add audit deps, vitest, and demo fixtures"
```

---

### Task 2: Types and pt-BR format helpers

**Files:**
- Create: `src/lib/audit/types.ts`
- Create: `src/lib/audit/format.ts`
- Test: `tests/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by every later task):
  - `types.ts`: `Praca`, `FreightTable`, `ParsedCte`, `FindingReason`, `Finding`, `CteAuditRow`, `AuditResult` — exactly as below.
  - `format.ts`: `r2(x: number): number`, `parseBrNumber(s: string): number`, `formatBrNumber(x: number, dec?: number): string`, `formatBRL(x: number): string`, `normalizeCity(s: string): string`, `brDateToIso(s: string): string`, `isoToBrDate(s: string): string`.

- [ ] **Step 1: Write types (no test needed — compile-checked by all later code)**

`src/lib/audit/types.ts`:

```ts
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
```

- [ ] **Step 2: Write failing tests for format helpers**

`tests/format.test.ts`:

```ts
import { it, expect } from "vitest";
import {
  r2, parseBrNumber, formatBrNumber, formatBRL, normalizeCity, brDateToIso, isoToBrDate,
} from "../src/lib/audit/format";

it("r2 rounds to 2 decimals with epsilon", () => {
  expect(r2(1.005)).toBe(1.01);
  expect(r2(2726.194)).toBe(2726.19);
});

it("parseBrNumber handles BR and plain formats", () => {
  expect(parseBrNumber("1.234,56")).toBe(1234.56);
  expect(parseBrNumber("0,42")).toBe(0.42);
  expect(parseBrNumber("5,00.")).toBe(5); // trailing sentence period
  expect(parseBrNumber("0.42")).toBe(0.42); // xlsx numeric cell formatted with dot
  expect(parseBrNumber("300")).toBe(300);
});

it("formatBrNumber renders pt-BR decimals", () => {
  expect(formatBrNumber(1234.5)).toBe("1.234,50");
  expect(formatBrNumber(0.35)).toBe("0,35");
});

it("formatBRL matches Intl output", () => {
  const expected = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(1234.56);
  expect(formatBRL(1234.56)).toBe(expected);
});

it("normalizeCity strips accents and uppercases", () => {
  expect(normalizeCity("São José dos Pinhais ")).toBe("SAO JOSE DOS PINHAIS");
  expect(normalizeCity("Araucária")).toBe("ARAUCARIA");
});

it("date conversions", () => {
  expect(brDateToIso("15/07/2026")).toBe("2026-07-15");
  expect(isoToBrDate("2026-07-15")).toBe("15/07/2026");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — cannot resolve `../src/lib/audit/format`.

- [ ] **Step 4: Implement format.ts**

`src/lib/audit/format.ts`:

```ts
export const r2 = (x: number) => Math.round((x + 1e-9) * 100) / 100;

export function parseBrNumber(s: string): number {
  const t = s.trim().replace(/[^\d.,-]/g, "");
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  return Number(t);
}

export function formatBrNumber(x: number, dec = 2): string {
  return x.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export const formatBRL = (x: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(x);

export function normalizeCity(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

export function brDateToIso(s: string): string {
  const [d, m, y] = s.split("/");
  return `${y}-${m}-${d}`;
}

export function isoToBrDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit/types.ts src/lib/audit/format.ts tests/format.test.ts
git commit -m "feat: audit domain types and pt-BR format helpers"
```

---

### Task 3: CTe XML parser

**Files:**
- Create: `src/lib/audit/cte-parser.ts`
- Test: `tests/cte-parser.test.ts`

**Interfaces:**
- Consumes: `ParsedCte` from `types.ts`.
- Produces: `parseCte(xml: string): ParsedCte` — throws `Error` with a PT-BR message on malformed/non-CTe XML. Used by Task 6 (golden test) and Task 8 (route).

- [ ] **Step 1: Write failing test**

`tests/cte-parser.test.ts` (expected values transcribed from `tests/fixtures/ctes/CTe_48240.xml`):

```ts
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCte } from "../src/lib/audit/cte-parser";

const FIX = path.join(import.meta.dirname, "fixtures");

it("parses CTe_48240.xml completely", () => {
  const xml = fs.readFileSync(path.join(FIX, "ctes", "CTe_48240.xml"), "utf8");
  const cte = parseCte(xml);
  expect(cte).toEqual({
    nCT: "48240",
    chave: "41260723456789000177570010000482401562400840",
    dhEmi: "2026-07-13",
    munFim: "Araucaria",
    ufFim: "PR",
    vTPrest: 1338.77,
    vRec: 1338.77,
    vCarga: 65578.37,
    comps: {
      "FRETE PESO": 880.93,
      GRIS: 163.95,
      "AD VALOREM": 78.69,
      PEDAGIO: 130.2,
      TDE: 85.0,
    },
    pesoBruto: 2097.46,
    cubagemM3: 2.42,
    emit: { cnpj: "23456789000177", nome: "Rápido Paranaense Transportes Ltda" },
    dest: { cnpj: "86861594991186", nome: "Metalurgica Sao Cristovao Ltda" },
    icms: { pICMS: 19.5, vICMS: 261.06 },
  });
});

it("throws on non-CTe XML", () => {
  expect(() => parseCte("<foo><bar/></foo>")).toThrow(/CT-e/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cte-parser.test.ts`
Expected: FAIL — cannot resolve `cte-parser`.

- [ ] **Step 3: Implement parser**

`src/lib/audit/cte-parser.ts`:

```ts
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

  return {
    nCT: String(ide.nCT),
    chave: String(inf["@_Id"] ?? "").replace(/^CTe/, ""),
    dhEmi: String(ide.dhEmi ?? "").slice(0, 10),
    munFim: ide.xMunFim ?? "",
    ufFim: ide.UFFim ?? "",
    vTPrest: Number(vPrest.vTPrest),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cte-parser.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/cte-parser.ts tests/cte-parser.test.ts
git commit -m "feat: CTe XML parser"
```

---

### Task 4: Freight table parser (PDF + XLSX)

**Files:**
- Create: `src/lib/audit/table-parser.ts`
- Create: `scripts/make-sample-xlsx.mjs` (generates the XLSX fixture once)
- Create: `tests/fixtures/tabela_frete.xlsx` (generated)
- Test: `tests/table-parser.test.ts`

**Interfaces:**
- Consumes: `FreightTable`, `Praca` from `types.ts`; `parseBrNumber`, `brDateToIso`, `normalizeCity` from `format.ts`.
- Produces: `parseFreightTable(buf: Buffer, fileName: string): Promise<FreightTable>`, `extractTable(rawText: string): FreightTable`, classes `TableParseError` and `ScannedPdfError` (both `extends Error`). Used by Task 8 (route).

All extraction regexes below were **validated against the actual `pdf-parse@2.4.5` output of the fixture PDF** during planning — copy them exactly. Beware: never use `[^R]` with the `/i` flag (it also excludes lowercase "r" — this exact bug was hit and fixed during validation).

- [ ] **Step 1: Generate the XLSX fixture**

`scripts/make-sample-xlsx.mjs`:

```js
// One-shot generator for tests/fixtures/tabela_frete.xlsx — the Excel twin of tabela_frete.pdf.
import * as XLSX from "xlsx";

const rows = [
  ["RÁPIDO PARANAENSE TRANSPORTES LTDA"],
  ["CNPJ 23.456.789/0001-77 · Curitiba/PR"],
  ["TABELA DE FRETE RODOVIÁRIO FRACIONADO"],
  ["Praça de destino", "UF", "Frete-peso (R$/kg)", "Frete mínimo (R$)"],
  ["Curitiba e região metropolitana", "PR", "0,42", "95,00"],
  ["Interior do Paraná", "PR", "0,55", "120,00"],
  ["São Paulo — capital", "SP", "0,68", "150,00"],
  ["Interior de São Paulo", "SP", "0,78", "165,00"],
  ["Santa Catarina", "SC", "0,60", "130,00"],
  ["Rio Grande do Sul", "RS", "0,85", "180,00"],
  ["Minas Gerais", "MG", "0,82", "175,00"],
  ["Generalidades"],
  ["Peso taxável: o maior entre o peso real e o peso cubado. Fator de cubagem: 300 kg/m³."],
  ["GRIS: 0,25% sobre o valor da nota fiscal, mínimo R$ 8,00."],
  ["Ad valorem: 0,12% sobre o valor da nota fiscal, mínimo R$ 5,00."],
  ["Pedágio: R$ 6,20 por fração de 100 kg de peso taxável."],
  ["TDE: R$ 85,00 — devida exclusivamente para entregas em São Paulo/SP (capital)."],
  ["Reajuste de 8% sobre o frete-peso e o frete mínimo, com vigência a partir de 15/07/2026."],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Tabela");
XLSX.writeFile(wb, "tests/fixtures/tabela_frete.xlsx");
console.log("ok: tests/fixtures/tabela_frete.xlsx");
```

Run: `node scripts/make-sample-xlsx.mjs`

- [ ] **Step 2: Write failing tests**

`tests/table-parser.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/table-parser.test.ts`
Expected: FAIL — cannot resolve `table-parser`.

- [ ] **Step 4: Implement the parser**

`src/lib/audit/table-parser.ts`:

```ts
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
    } catch {
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
```

Note: `toEqual` treats `{ adval: undefined }` and a missing key as equal in vitest, so the EXPECTED object needs no `undefined` entries.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/table-parser.test.ts`
Expected: PASS (4 tests). If the scanned-PDF test fails because pdf-parse throws on the handcrafted PDF instead of returning empty text, that is fine — the catch block maps it to `ScannedPdfError`; only investigate if the error is NOT a `ScannedPdfError`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit/table-parser.ts scripts/make-sample-xlsx.mjs tests/fixtures/tabela_frete.xlsx tests/table-parser.test.ts
git commit -m "feat: freight table parser for PDF and XLSX"
```

---

### Task 5: Praça resolver

**Files:**
- Create: `src/lib/audit/praca-resolver.ts`
- Test: `tests/praca-resolver.test.ts`

**Interfaces:**
- Consumes: `Praca` from `types.ts`; `normalizeCity` from `format.ts`.
- Produces: `resolvePraca(mun: string, uf: string, pracas: Praca[]): Praca | undefined`. Used by Task 6 (engine).

- [ ] **Step 1: Write failing test**

`tests/praca-resolver.test.ts`:

```ts
import { it, expect } from "vitest";
import { resolvePraca } from "../src/lib/audit/praca-resolver";
import type { Praca } from "../src/lib/audit/types";

const PRACAS: Praca[] = [
  { name: "Curitiba e região metropolitana", uf: "PR", rateKg: 0.42, min: 95 },
  { name: "Interior do Paraná", uf: "PR", rateKg: 0.55, min: 120 },
  { name: "São Paulo — capital", uf: "SP", rateKg: 0.68, min: 150 },
  { name: "Interior de São Paulo", uf: "SP", rateKg: 0.78, min: 165 },
  { name: "Santa Catarina", uf: "SC", rateKg: 0.6, min: 130 },
];

it("routes metro cities to the metro praça", () => {
  expect(resolvePraca("Curitiba", "PR", PRACAS)?.name).toMatch(/região metropolitana/);
  expect(resolvePraca("Araucaria", "PR", PRACAS)?.name).toMatch(/região metropolitana/);
  expect(resolvePraca("São José dos Pinhais", "PR", PRACAS)?.name).toMatch(/região metropolitana/);
  expect(resolvePraca("Sao Paulo", "SP", PRACAS)?.name).toMatch(/capital/);
});

it("routes other cities to the interior praça", () => {
  expect(resolvePraca("Londrina", "PR", PRACAS)?.name).toBe("Interior do Paraná");
  expect(resolvePraca("Campinas", "SP", PRACAS)?.name).toBe("Interior de São Paulo");
});

it("single-praça UF matches any city; unknown UF returns undefined", () => {
  expect(resolvePraca("Joinville", "SC", PRACAS)?.name).toBe("Santa Catarina");
  expect(resolvePraca("Salvador", "BA", PRACAS)).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/praca-resolver.test.ts`
Expected: FAIL — cannot resolve `praca-resolver`.

- [ ] **Step 3: Implement**

`src/lib/audit/praca-resolver.ts`:

```ts
import type { Praca } from "./types";
import { normalizeCity } from "./format";

// ponytail: demo-tuned metro-region lists; a real product needs an IBGE municipality→region table
const METRO_CITIES: Record<string, string[]> = {
  PR: ["CURITIBA", "SAO JOSE DOS PINHAIS", "ARAUCARIA"],
  SP: ["SAO PAULO"],
};

export function resolvePraca(mun: string, uf: string, pracas: Praca[]): Praca | undefined {
  const candidates = pracas.filter((p) => p.uf === uf);
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const interior = candidates.find((p) => /interior/i.test(p.name));
  const metro = candidates.find((p) => !/interior/i.test(p.name));
  const isMetro = (METRO_CITIES[uf] ?? []).includes(normalizeCity(mun));
  return isMetro ? (metro ?? candidates[0]) : (interior ?? candidates[0]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/praca-resolver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/praca-resolver.ts tests/praca-resolver.test.ts
git commit -m "feat: destination city to praça resolver"
```

---

### Task 6: Comparison engine + golden test

**Files:**
- Create: `src/lib/audit/engine.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Consumes: all of `types.ts`; `r2`, `formatBrNumber`, `isoToBrDate`, `normalizeCity` from `format.ts`; `resolvePraca` from `praca-resolver.ts`; (test only) `parseCte`, `parseFreightTable`.
- Produces:
  - `auditCte(cte: ParsedCte, table: FreightTable): Finding[]` — throws when no praça resolves.
  - `audit(table: FreightTable, items: { fileName: string; cte: ParsedCte }[]): AuditResult`.
  Used by Task 8 (route).

- [ ] **Step 1: Write failing golden test**

`tests/engine.test.ts`:

```ts
import { it, expect, describe } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { audit } from "../src/lib/audit/engine";
import { parseCte } from "../src/lib/audit/cte-parser";
import { parseFreightTable } from "../src/lib/audit/table-parser";
import type { FreightTable } from "../src/lib/audit/types";

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
    pracas: Object.entries(j.pracas).map(([name, p]: [string, any]) => ({
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
    .map((a: any) => `${a.nCT}|${a.componente}|${a.tipo}|${a.cobrado}|${a.devido}|${a.diferenca}`)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine.test.ts`
Expected: FAIL — cannot resolve `engine`.

- [ ] **Step 3: Implement the engine (direct port of `auditoria.py`)**

`src/lib/audit/engine.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine.test.ts`
Expected: PASS (3 tests). If the per-finding comparison fails, diff the first mismatching line — the likely culprits are float rounding (check `r2` call sites against `auditoria.py`) or the pedágio fraction formula (`Math.floor(x / f) + 1`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/engine.ts tests/engine.test.ts
git commit -m "feat: comparison engine reproducing the demo golden audit"
```

---

### Task 7: Contestation email builder + Excel export builder

**Files:**
- Create: `src/lib/audit/email.ts`
- Create: `src/lib/audit/export.ts`
- Test: `tests/email-export.test.ts`

**Interfaces:**
- Consumes: `CteAuditRow`, `FreightTable`, `AuditResult`, `FindingReason` from `types.ts`; `formatBRL` from `format.ts`; `xlsx`.
- Produces:
  - `REASON_LABEL: Record<FindingReason, string>` and `buildContestationEmail(row: CteAuditRow, table: FreightTable): { subject: string; body: string }` — throws if `row.findings` is empty.
  - `buildWorkbook(result: AuditResult): XLSX.WorkBook` (import type from `xlsx`).
  Used by Task 9 (UI). Both must be pure/browser-safe (no Node APIs).

- [ ] **Step 1: Write failing tests**

`tests/email-export.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/email-export.test.ts`
Expected: FAIL — cannot resolve `email` / `export`.

- [ ] **Step 3: Implement both modules**

`src/lib/audit/email.ts`:

```ts
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
```

`src/lib/audit/export.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/email-export.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/email.ts src/lib/audit/export.ts tests/email-export.test.ts
git commit -m "feat: contestation email builder and Excel export"
```

---

### Task 8: API route `POST /api/audit`

**Files:**
- Create: `src/app/api/audit/route.ts`
- Test: `tests/api-audit.test.ts`

**Interfaces:**
- Consumes: `parseFreightTable`, `TableParseError` (table-parser), `parseCte` (cte-parser), `audit` (engine).
- Produces: `POST(request: Request): Promise<Response>` — 200 with `AuditResult` JSON, or 400 with `{ error: string }`. The UI (Task 9) calls it with `FormData` fields `table` (1 file) and `ctes` (N files).

- [ ] **Step 1: Write failing test**

`tests/api-audit.test.ts` (Node ≥20 has `File`/`FormData`/`Request` globals — verified on this machine, Node 24):

```ts
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { POST } from "../src/app/api/audit/route";

const FIX = path.join(import.meta.dirname, "fixtures");

function pdfFile() {
  return new File([fs.readFileSync(path.join(FIX, "tabela_frete.pdf"))], "tabela_frete.pdf", { type: "application/pdf" });
}

function cteFile(name: string) {
  return new File([fs.readFileSync(path.join(FIX, "ctes", name))], name, { type: "text/xml" });
}

function makeRequest(form: FormData) {
  return new Request("http://test/api/audit", { method: "POST", body: form });
}

it("audits table + XMLs and returns the result", async () => {
  const form = new FormData();
  form.append("table", pdfFile());
  const names = fs.readdirSync(path.join(FIX, "ctes")).filter((f) => f.endsWith(".xml")).sort().slice(0, 50);
  for (const n of names) form.append("ctes", cteFile(n));
  const res = await POST(makeRequest(form));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.summary.cteCount).toBe(50);
  expect(json.table.carrierName).toBe("RÁPIDO PARANAENSE TRANSPORTES LTDA");
  expect(json.rows).toHaveLength(50);
});

it("400 when the table is missing", async () => {
  const form = new FormData();
  form.append("ctes", cteFile("CTe_48240.xml"));
  const res = await POST(makeRequest(form));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/tabela/i);
});

it("400 when no XMLs are sent, or more than 50", async () => {
  const onlyTable = new FormData();
  onlyTable.append("table", pdfFile());
  expect((await POST(makeRequest(onlyTable))).status).toBe(400);

  const tooMany = new FormData();
  tooMany.append("table", pdfFile());
  const names = fs.readdirSync(path.join(FIX, "ctes")).filter((f) => f.endsWith(".xml")).slice(0, 51);
  for (const n of names) tooMany.append("ctes", cteFile(n));
  const res = await POST(makeRequest(tooMany));
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/50/);
});

it("bad XML lands in skipped, not a failure", async () => {
  const form = new FormData();
  form.append("table", pdfFile());
  form.append("ctes", cteFile("CTe_48240.xml"));
  form.append("ctes", new File(["<foo/>"], "broken.xml", { type: "text/xml" }));
  const res = await POST(makeRequest(form));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.summary.cteCount).toBe(1);
  expect(json.skipped).toEqual([{ fileName: "broken.xml", error: expect.stringContaining("CT-e") }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: FAIL — cannot resolve the route module.

- [ ] **Step 3: Implement the route**

`src/app/api/audit/route.ts`:

```ts
import { parseFreightTable, TableParseError } from "@/lib/audit/table-parser";
import { parseCte } from "@/lib/audit/cte-parser";
import { audit } from "@/lib/audit/engine";
import type { ParsedCte } from "@/lib/audit/types";

const MAX_TABLE_BYTES = 10 * 1024 * 1024;
const MAX_XML_BYTES = 1 * 1024 * 1024;
const MAX_XMLS = 50;

export async function POST(request: Request) {
  const form = await request.formData();
  const tableFile = form.get("table");
  const cteFiles = form.getAll("ctes").filter((f): f is File => f instanceof File);

  if (!(tableFile instanceof File)) {
    return Response.json({ error: "Envie a tabela de frete (PDF ou Excel)." }, { status: 400 });
  }
  if (tableFile.size > MAX_TABLE_BYTES) {
    return Response.json({ error: "Tabela de frete maior que 10 MB." }, { status: 400 });
  }
  if (cteFiles.length === 0) {
    return Response.json({ error: "Envie ao menos um XML de CT-e." }, { status: 400 });
  }
  if (cteFiles.length > MAX_XMLS) {
    return Response.json({ error: "Máximo de 50 XMLs por auditoria." }, { status: 400 });
  }

  let table;
  try {
    table = await parseFreightTable(Buffer.from(await tableFile.arrayBuffer()), tableFile.name);
  } catch (e) {
    const msg = e instanceof TableParseError ? e.message : "Falha ao ler a tabela de frete.";
    return Response.json({ error: msg }, { status: 400 });
  }

  const items: { fileName: string; cte: ParsedCte }[] = [];
  const skipped: { fileName: string; error: string }[] = [];
  for (const f of cteFiles) {
    if (f.size > MAX_XML_BYTES) {
      skipped.push({ fileName: f.name, error: "Arquivo maior que 1 MB" });
      continue;
    }
    try {
      items.push({ fileName: f.name, cte: parseCte(await f.text()) });
    } catch (e) {
      skipped.push({ fileName: f.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (items.length === 0) {
    return Response.json({ error: "Nenhum XML de CT-e válido foi enviado." }, { status: 400 });
  }

  const result = audit(table, items);
  result.skipped = [...skipped, ...result.skipped];
  return Response.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api-audit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/audit/route.ts tests/api-audit.test.ts
git commit -m "feat: POST /api/audit route"
```

---

### Task 9: `/audit` page UI

**Files:**
- Create: `src/app/audit/page.tsx`
- Create: `src/app/audit/results.tsx`
- Create: `src/app/audit/email-modal.tsx`

**Interfaces:**
- Consumes: `AuditResult`, `CteAuditRow` types; `formatBRL`, `formatBrNumber` (format.ts); `buildContestationEmail`, `REASON_LABEL` (email.ts); `buildWorkbook` (export.ts); `react-dropzone`; `xlsx` (`XLSX.writeFile` client-side); `POST /api/audit`.
- Produces: the user-facing page. No later task consumes it.

No unit tests for these components (all logic already tested in `src/lib/audit`); verification is manual (Step 4) plus `npm run build`.

Design: match the landing page (`src/app/page.tsx`) — Inter body / DM Mono for numbers, palette `#111` text, `#666`/`#999` secondary, `#f7f7f5` surfaces, `#e5e5e5`/`#ddd` borders, `#059669` accent, `#ef4444` danger, white background, max-width container. Use Tailwind arbitrary-value classes with these exact hex values. All copy PT-BR.

- [ ] **Step 1: Create the page (upload + state + fetch)**

`src/app/audit/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import type { AuditResult, CteAuditRow } from "@/lib/audit/types";
import { Results } from "./results";
import { EmailModal } from "./email-modal";

function Dropzone({
  label, hint, accept, multiple, onFiles,
}: {
  label: string;
  hint: string;
  accept: Record<string, string[]>;
  multiple: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept,
    multiple,
  });
  return (
    <div
      {...getRootProps()}
      className={`flex-1 cursor-pointer rounded-xl border border-dashed p-8 text-center transition-colors ${
        isDragActive ? "border-[#059669] bg-[#ecfdf5]" : "border-[#ddd] bg-[#f7f7f5] hover:border-[#bbb]"
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-sm font-semibold text-[#111]">{label}</p>
      <p className="mt-1 text-xs text-[#999]">{hint}</p>
    </div>
  );
}

export default function AuditPage() {
  const [tableFile, setTableFile] = useState<File | null>(null);
  const [cteFiles, setCteFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [emailRow, setEmailRow] = useState<CteAuditRow | null>(null);

  function addCtes(files: File[]) {
    setCteFiles((prev) => {
      const merged = [...prev, ...files.filter((f) => !prev.some((p) => p.name === f.name))];
      if (merged.length > 50) setError("Máximo de 50 XMLs por auditoria.");
      return merged.slice(0, 50);
    });
  }

  async function runAudit() {
    if (!tableFile || cteFiles.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("table", tableFile);
      cteFiles.forEach((f) => fd.append("ctes", f));
      const res = await fetch("/api/audit", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Falha na auditoria.");
      else setResult(json);
    } catch {
      setError("Falha de rede ao enviar os arquivos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <div className="mx-auto max-w-[1140px] px-6 py-12 md:px-10">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-[#059669]">Confere</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Auditoria de Fretes</h1>
          <p className="mt-2 max-w-xl text-sm text-[#666]">
            Envie a tabela de frete contratada e os XMLs dos CT-es. A auditoria compara cada
            componente cobrado com o contratado e aponta o valor recuperável.
          </p>
        </header>

        <section className="flex flex-col gap-4 md:flex-row">
          <Dropzone
            label={tableFile ? `Tabela: ${tableFile.name}` : "Tabela de frete"}
            hint="PDF ou Excel (.xlsx/.xls) — 1 arquivo"
            accept={{
              "application/pdf": [".pdf"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
            }}
            multiple={false}
            onFiles={(f) => f[0] && setTableFile(f[0])}
          />
          <Dropzone
            label={cteFiles.length ? `${cteFiles.length} XML(s) selecionado(s)` : "CT-es (XML)"}
            hint="Até 50 arquivos XML no padrão CT-e"
            accept={{ "text/xml": [".xml"], "application/xml": [".xml"] }}
            multiple
            onFiles={addCtes}
          />
        </section>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={runAudit}
            disabled={!tableFile || cteFiles.length === 0 || loading}
            className="rounded-lg bg-[#111] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Auditando…" : "Auditar"}
          </button>
          {cteFiles.length > 0 && (
            <button onClick={() => setCteFiles([])} className="text-xs text-[#999] underline hover:text-[#666]">
              limpar XMLs
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 flex items-start justify-between rounded-lg border border-[#ef4444]/30 bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {result && <Results result={result} onGenerateEmail={setEmailRow} />}
      </div>

      {emailRow && result && (
        <EmailModal row={emailRow} table={result.table} onClose={() => setEmailRow(null)} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Create the results components**

`src/app/audit/results.tsx`:

```tsx
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
                  key={r.nCT}
                  row={r}
                  divergent={divergent}
                  expanded={expanded.has(r.nCT)}
                  onToggle={() => toggle(r.nCT)}
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
          <tr key={`${row.nCT}-${i}`} className="border-b border-[#f0f0ee] bg-[#fffbeb]/50 text-xs text-[#666]">
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
```

- [ ] **Step 3: Create the email modal**

`src/app/audit/email-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { CteAuditRow, FreightTable } from "@/lib/audit/types";
import { buildContestationEmail } from "@/lib/audit/email";

export function EmailModal({
  row, table, onClose,
}: {
  row: CteAuditRow;
  table: FreightTable;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { subject, body } = buildContestationEmail(row, table);

  async function copy() {
    await navigator.clipboard.writeText(`Assunto: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold text-[#111]">E-mail de Contestação — CT-e {row.nCT}</h3>
          <button onClick={onClose} className="text-lg text-[#999] hover:text-[#111]">×</button>
        </div>
        <p className="mt-4 rounded-lg bg-[#f7f7f5] px-3 py-2 text-sm font-medium text-[#111]">
          Assunto: {subject}
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-[#e5e5e5] p-4 font-sans text-sm leading-relaxed text-[#333]">
          {body}
        </pre>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-[#ddd] px-4 py-2 text-sm font-medium hover:bg-[#f7f7f5]">
            Fechar
          </button>
          <button onClick={copy} className="rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white hover:opacity-85">
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/audit`, then:
1. Upload `tests/fixtures/tabela_frete.pdf` + 50 XMLs from `tests/fixtures/ctes/` and click **Auditar**. Confirm cards render, divergent rows are red and sorted first, table preview shows GRIS 0,25% / cubagem 300 / reajuste 8%.
2. Expand a divergent row — findings with motivos appear.
3. Click **Gerar E-mail** — modal shows PT-BR email; **Copiar** puts it on the clipboard.
4. Click **Exportar Excel** — `auditoria-fretes.xlsx` downloads with 2 sheets.
5. Upload a `.xml` as the table (rename a CTe) — a PT-BR error alert appears.

- [ ] **Step 5: Build check**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/audit/
git commit -m "feat: /audit page with upload, dashboard, export and contestation email"
```

---

### Task 10: Landing CTA + final verification

**Files:**
- Modify: `src/app/page.tsx:352` and `src/app/page.tsx:388` (both currently `href="#cta"`)

**Interfaces:**
- Consumes: the `/audit` page from Task 9.
- Produces: nothing downstream — final task.

- [ ] **Step 1: Point the header and hero CTAs at the tool**

In `src/app/page.tsx`, change the `href="#cta"` at line 352 (header button) and line 388 (hero primary button) to `href="/audit"`. Leave the other `#cta` anchors (mid-page and footer email capture) untouched.

- [ ] **Step 2: Verify manually**

Run: `npm run dev` — on `/`, the header and hero CTAs navigate to `/audit`.

- [ ] **Step 3: Full-suite verification**

Run: `npm test && npm run build && npm run lint`
Expected: all tests pass (the golden test proves the demo audit reproduces exactly: 200 CTes, 37 divergent, R$ 5.177,78), build and lint clean.

- [ ] **Step 4: Run the end-to-end demo check**

With `npm run dev` running, upload `tests/fixtures/tabela_frete.pdf` + the first 50 XMLs on `/audit` and confirm plausible numbers render (the 50-file subset gives a fraction of the full R$ 5.177,78).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: link landing CTAs to the audit tool"
```
