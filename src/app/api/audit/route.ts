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
