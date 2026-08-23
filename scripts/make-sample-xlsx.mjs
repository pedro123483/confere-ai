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
