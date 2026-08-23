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
