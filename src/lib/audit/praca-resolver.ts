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
