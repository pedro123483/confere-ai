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
