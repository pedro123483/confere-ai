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
