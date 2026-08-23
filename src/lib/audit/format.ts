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
