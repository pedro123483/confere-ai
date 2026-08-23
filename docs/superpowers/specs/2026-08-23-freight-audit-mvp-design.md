# Freight Audit MVP — Design Spec

**Date:** 2026-08-23
**Status:** Approved by user (brainstorming session)
**Source request:** `src/prompt.md`
**Reference dataset:** `/Users/sp16483/Documents/projects/demo_auditoria_fretes_1` (200 synthetic CTe XMLs, `tabela_frete.pdf`, `tabela_frete.json`, `auditoria.py` reference engine, `achados.json` golden output)

## Problem

Brazilian freight invoices (CTe) are frequently charged above contracted freight tables; companies lose 2–5% of freight spend. Analysts today cross-check freight-table PDFs against CTe XMLs by hand. This MVP automates it: upload one freight table (PDF/XLSX) + up to 50 CTe XMLs, click "Auditar", see divergences and a recoverable total, export to Excel, and generate a contestation email per divergent CTe.

## Decisions made (with user)

| Decision | Choice | Rationale |
|---|---|---|
| Freight-table model | **Praça-based** (demo's real model), not the prompt's De–Até weight ranges | The demo dataset the MVP must work on has no weight ranges; it has rate/kg + minimum per destination praça, GRIS/AD VALOREM with floors, pedágio per 100kg fraction, TDE per city, and a dated reajuste. |
| Backend | **Plain Next.js API route** (one) | ~1 server operation; tRPC boilerplate buys nothing. Types shared via TS imports. |
| Table parsing | **pdf-parse + xlsx, rule-based** | Demo PDF is text-based; deterministic and local. No anydoc/Firecrawl (external service), no OCR. |
| Storage / auth | **None. Stateless, in-memory** | "Works in 30 seconds" single-page tool. AuditResult is one serializable JSON document, so persistence later is trivial. |
| Contestation email | **Template filled in code — no LLM** | Prompt provides the full PT-BR template; string interpolation is deterministic, free, offline. Removes the AI SDK dependency entirely. |
| Divergence tolerance | **R$ 0,05 per component** (like `auditoria.py`), not the prompt's R$1/1% | Matches the demo gabarito's "all seeded errors found, zero false positives". |

Consequence: the app is fully local — zero API keys, zero external services.

## Architecture

Single tool page at `/audit`; existing landing page stays at `/` and gains a CTA link.

```
Client (/audit page)
  ├─ Dropzone A: tabela de frete (1 file: .pdf/.xlsx/.xls)
  ├─ Dropzone B: CTe XMLs (up to 50 .xml files)
  ├─ POST /api/audit (multipart/form-data)
  │     server: parse table → parse XMLs → run engine → AuditResult JSON
  ├─ Dashboard renders AuditResult (cards + table)
  ├─ "Exportar Excel" — client-side via xlsx lib
  └─ "Gerar E-mail" — client-side template interpolation, modal + copy
```

New dependencies: `react-dropzone`, `fast-xml-parser`, `xlsx`, `pdf-parse`; `vitest` (dev). Nothing else.

Note: repo is **Next.js 16.2.2** (prompt says 14) and `AGENTS.md` warns APIs differ from training data — read `node_modules/next/dist/docs/` before writing page/route code.

## Modules

All audit logic lives in `src/lib/audit/` as pure functions (no I/O), so it is testable without the HTTP layer.

### types.ts

```ts
type Praca = { name: string; uf: string; rateKg: number; min: number };
type FreightTable = {
  carrierName: string; carrierCnpj?: string;
  cubageFactorKgM3: number;
  gris: { pct: number; min: number };
  adval?: { pct: number; min: number };
  pedagio?: { valuePerFraction: number; fractionKg: number };
  tde?: { value: number; cities: string[] };
  reajuste?: { pct: number; effectiveDate: string }; // ISO date
  expectedComponents: string[];
  pracas: Praca[];
};
type ParsedCte = {
  nCT: string; chave: string; dhEmi: string;        // ISO date part
  munFim: string; ufFim: string;
  vTPrest: number; vRec: number; vCarga: number;
  comps: Record<string, number>;                     // xNome → vComp
  pesoBruto: number; cubagemM3: number;
  emit: { cnpj: string; nome: string };
  dest: { cnpj?: string; nome: string };
  icms?: { pICMS: number; vICMS: number };
};
type FindingReason =
  | 'REAJUSTE_ANTECIPADO' | 'CUBAGEM_FATOR' | 'GRIS_MAJORADO'
  | 'PEDAGIO_TARIFA' | 'TDE_INDEVIDA' | 'TAXA_NAO_PREVISTA'
  | 'FRETE_PESO_DIVERGENTE' | 'ADVAL_DIVERGENTE';
type Finding = {
  component: string; reason: FindingReason; motivo: string; // PT-BR explanation
  charged: number; expected: number; difference: number;
};
type CteAuditRow = {
  nCT: string; chave: string; date: string; destino: string;
  carrier: string; charged: number; expected: number; difference: number;
  status: 'DIVERGENTE' | 'OK'; findings: Finding[];
};
type AuditResult = {
  table: FreightTable;
  summary: {
    totalRecoverable: number; cteCount: number; divergentCount: number;
    errorRatePct: number; avgErrorPerCte: number; totalFreight: number;
  };
  rows: CteAuditRow[];                 // sorted by difference desc
  skipped: { fileName: string; error: string }[];
};
```

### cte-parser.ts

`parseCte(xml: string): ParsedCte` using `fast-xml-parser` (namespaces stripped; `Comp` and `infQ` forced to arrays via `isArray`). Extracts: `infCte@Id` (chave = Id minus `CTe` prefix), `nCT`, `dhEmi` (date part), `xMunFim`/`UFFim`, `vTPrest`, `vRec`, `vCarga`, all `Comp` (xNome→vComp), `infQ` where `tpMed` = `PESO BRUTO` → pesoBruto and `CUBAGEM` → cubagemM3, `emit` CNPJ/xNome, `dest`, ICMS (`pICMS`/`vICMS` from any `ICMS*` child). Throws a descriptive error on malformed XML; the route catches per-file and reports in `skipped`.

### table-parser.ts

`parseFreightTable(buffer, fileName): FreightTable`.

Both formats reduce to **lines of text**, then one shared extractor runs:
- PDF: `pdf-parse` → text → lines. If extracted text is near-empty (< ~50 chars), throw `ScannedPdfError` → UI shows: "Não foi possível ler o PDF automaticamente. Envie a versão em Excel da tabela." (no OCR, per prompt).
- XLSX/XLS: `xlsx` → each row's cells joined with tabs → lines.

Extractor rules (pt-BR regexes over lines; `parseBrNumber` helper converts `1.234,56`):
- Carrier name: first non-empty line; CNPJ by pattern `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}`.
- Praça rows: lines matching `<name> <UF(2 letters)> <rate> <min>` after a header containing "Praça".
- GRIS: line containing `GRIS` → percent + `mínimo R$ x`.
- Ad valorem: line containing `Ad valorem` → percent + min.
- Pedágio: `R$ x por fração de N kg`.
- Cubage factor: `N kg/m³`.
- TDE: value + city list ("exclusivamente para entregas em <cidade>").
- Reajuste: `x% ... a partir de dd/mm/aaaa` → pct + ISO date.
- `expectedComponents` = `['FRETE PESO', 'GRIS', 'AD VALOREM', 'PEDAGIO', 'TDE']` derived from which sections were found (FRETE PESO always; others when parsed).

Missing required pieces (no praças, or no GRIS) → descriptive parse error shown to user.

There is no demo XLSX; the XLSX path expects the same textual labels as the PDF. A sample XLSX mirroring the PDF is generated as a test fixture to prove the path works.

### praca-resolver.ts

`resolvePraca(mun, uf, pracas): Praca | undefined`. Match praças by UF; when a UF has both a capital/metro praça and an interior praça, pick capital/metro if the city is the capital or in its metro list, else interior. Metro list constant: Curitiba region = CURITIBA, SAO JOSE DOS PINHAIS, ARAUCARIA; São Paulo capital = SAO PAULO. City names compared uppercase/accent-stripped.
`// ponytail:` demo-tuned heuristic; a real product needs an IBGE municipality→region table.

### engine.ts

`audit(table: FreightTable, ctes: ParsedCte[]): AuditResult`. Direct port of `auditoria.py`, per CTe:

1. `taxable = max(pesoBruto, cubagemM3 * cubageFactorKgM3)`.
2. Rate/min for the CTe's praça; apply `reajuste.pct` only if `dhEmi >= effectiveDate`.
3. **FRETE PESO** expected = `max(min, taxable * rate)`. If charged exceeds by > R$0,05, diagnose:
   - matches value computed with reajuste applied before vigência → `REAJUSTE_ANTECIPADO`;
   - matches value with cubage factor 350 → `CUBAGEM_FATOR`;
   - else `FRETE_PESO_DIVERGENTE`.
4. **GRIS** expected = `max(gris.min, vCarga * gris.pct)` → `GRIS_MAJORADO` (motivo cites effective vs contracted %).
5. **AD VALOREM** expected = `max(adval.min, vCarga * adval.pct)` → `ADVAL_DIVERGENTE`.
6. **PEDÁGIO** expected = `(floor(taxable / fractionKg) + 1) * valuePerFraction`; diagnose factor-350 (`CUBAGEM_FATOR`) vs tariff (`PEDAGIO_TARIFA`, motivo cites effective tariff).
7. **TDE** — checked only when the table has a TDE clause: charged outside `tde.cities` → `TDE_INDEVIDA`, expected 0. When the table has no TDE clause at all, "TDE" is absent from `expectedComponents`, so a charged TDE falls through to step 8 (`TAXA_NAO_PREVISTA`, single finding) instead of double-counting.
8. Any component not in `expectedComponents` → `TAXA_NAO_PREVISTA`, expected 0.

Only over-charges are findings (charged − expected > 0,05); undercharges are not flagged. Row: `charged = vTPrest`, `difference = Σ finding differences`, `expected = charged − difference`, status DIVERGENTE if any finding. All money rounded to 2 decimals with an epsilon (`r2`). CTes whose praça can't be resolved go to `skipped` with a clear message.

Summary: totalRecoverable = Σ differences; errorRatePct = divergent/total; avgErrorPerCte = totalRecoverable/cteCount; totalFreight = Σ vTPrest.

### email.ts

`buildContestationEmail(row: CteAuditRow, table: FreightTable): { subject, body }` — pure string interpolation of the PT-BR template from the prompt: subject `Contestação de Cobrança - CTe [nCT] - Divergência de [motivo principal]`; body lists Valor Cobrado / Valor Contratado / Diferença (formatted `R$ 1.234,56`) and one bullet per finding's `motivo`, cites the table name, requests estorno of the difference. Runs client-side.

## API

`POST /api/audit` — multipart form: `table` (1 file, ≤10 MB) + `ctes` (1–50 files, ≤1 MB each). Returns `AuditResult` (200) or `{ error: string }` (400) for table-level failures (scanned PDF, unparseable table, no valid XMLs). Per-XML failures never fail the request — they land in `skipped`. Stateless; nothing written to disk.

## UI (`/audit`, PT-BR)

Matches the landing page's design language (Inter / DM Mono, minimal Linear/Stripe-like styling; reuse its tokens). Desktop-first, responsive.

1. **Upload section** — two `react-dropzone` areas (tabela | CTe XMLs) with file chips and counts; client-side rejects >50 XMLs and wrong extensions.
2. **Table preview** — after a successful audit response, a compact read-only card of the parsed table (praças + parâmetros: GRIS, ad valorem, pedágio, fator cubagem, TDE, reajuste) so the user can verify extraction. Manual editing of parsed values: **out of scope** for MVP.
3. **"Auditar" button** — disabled until both uploads present; loading state while processing.
4. **Results** —
   - 4 stat cards: Total Recuperável (R$), CTes Analisados, Taxa de Erro (%), Erro Médio por CTe (R$). `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
   - Table: CTe | Transportadora | Valor Cobrado | Valor Esperado | Diferença | Motivo(s) | Status. Sorted by Diferença desc; divergent rows red-tinted; findings' motivos expandable per row (details inline or on expand).
   - `skipped` files listed below the table with reasons, when any.
   - **Exportar Excel** — client-side `xlsx`: sheet 1 = rows, sheet 2 = per-finding detail.
   - Per divergent row: **Gerar E-mail** → modal showing subject + body, **Copiar** button (`navigator.clipboard`).
5. Errors (scanned PDF etc.) shown as a dismissible alert in PT-BR.

## Error handling summary

- Scanned/empty PDF → 400 with the exact PT-BR message from the prompt (Excel fallback suggestion).
- Table parsed but missing required fields → 400 naming what's missing.
- Individual bad XML → `skipped` entry, batch continues.
- Unresolvable praça → CTe goes to `skipped` with destino named.
- Client rejects >50 XMLs / wrong file types before upload.

## Testing (vitest, demo folder as fixtures)

- **Golden test (engine):** run `audit()` over the 200 demo CTes + `tabela_frete.json` (loaded as `FreightTable`); assert summary equals `achados.json`'s resumo (ctes auditados, divergent count, total divergência, per-tipo counts/values).
- **Table parser:** `tabela_frete.pdf` → deep-equal the known `FreightTable`; generated sample XLSX → same result.
- **CTe parser:** parse `CTe_48240.xml`, assert every extracted field.
- **Email:** snapshot one contestation email from a known divergent row.

Demo files are referenced from the sibling folder (or copied into `tests/fixtures/`; copying preferred so the repo is self-contained).

## Out of scope (explicit)

No OCR, no charts, no AllPost/Intelipost integration, no auth/user management, no database, no LLM calls, no manual table editing, no weight-range (De–Até) table support. Add range support only when a real range-based carrier table shows up.
