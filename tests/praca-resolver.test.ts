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
