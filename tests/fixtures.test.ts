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
