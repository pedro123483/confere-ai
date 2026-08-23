"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import type { AuditResult, CteAuditRow } from "@/lib/audit/types";
import { Results } from "./results";
import { EmailModal } from "./email-modal";

function Dropzone({
  label, hint, accept, multiple, onFiles,
}: {
  label: string;
  hint: string;
  accept: Record<string, string[]>;
  multiple: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept,
    multiple,
  });
  return (
    <div
      {...getRootProps()}
      className={`flex-1 cursor-pointer rounded-xl border border-dashed p-8 text-center transition-colors ${
        isDragActive ? "border-[#059669] bg-[#ecfdf5]" : "border-[#ddd] bg-[#f7f7f5] hover:border-[#bbb]"
      }`}
    >
      <input {...getInputProps()} />
      <p className="text-sm font-semibold text-[#111]">{label}</p>
      <p className="mt-1 text-xs text-[#999]">{hint}</p>
    </div>
  );
}

export default function AuditPage() {
  const [tableFile, setTableFile] = useState<File | null>(null);
  const [cteFiles, setCteFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [emailRow, setEmailRow] = useState<CteAuditRow | null>(null);

  function addCtes(files: File[]) {
    setCteFiles((prev) => {
      const merged = [...prev, ...files.filter((f) => !prev.some((p) => p.name === f.name))];
      if (merged.length > 50) setError("Máximo de 50 XMLs por auditoria.");
      return merged.slice(0, 50);
    });
  }

  async function runAudit() {
    if (!tableFile || cteFiles.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("table", tableFile);
      cteFiles.forEach((f) => fd.append("ctes", f));
      const res = await fetch("/api/audit", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Falha na auditoria.");
      else setResult(json);
    } catch {
      setError("Falha de rede ao enviar os arquivos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <div className="mx-auto max-w-[1140px] px-6 py-12 md:px-10">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-widest text-[#059669]">Confere</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Auditoria de Fretes</h1>
          <p className="mt-2 max-w-xl text-sm text-[#666]">
            Envie a tabela de frete contratada e os XMLs dos CT-es. A auditoria compara cada
            componente cobrado com o contratado e aponta o valor recuperável.
          </p>
        </header>

        <section className="flex flex-col gap-4 md:flex-row">
          <Dropzone
            label={tableFile ? `Tabela: ${tableFile.name}` : "Tabela de frete"}
            hint="PDF ou Excel (.xlsx/.xls) — 1 arquivo"
            accept={{
              "application/pdf": [".pdf"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              "application/vnd.ms-excel": [".xls"],
            }}
            multiple={false}
            onFiles={(f) => f[0] && setTableFile(f[0])}
          />
          <Dropzone
            label={cteFiles.length ? `${cteFiles.length} XML(s) selecionado(s)` : "CT-es (XML)"}
            hint="Até 50 arquivos XML no padrão CT-e"
            accept={{ "text/xml": [".xml"], "application/xml": [".xml"] }}
            multiple
            onFiles={addCtes}
          />
        </section>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={runAudit}
            disabled={!tableFile || cteFiles.length === 0 || loading}
            className="rounded-lg bg-[#111] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Auditando…" : "Auditar"}
          </button>
          {cteFiles.length > 0 && (
            <button onClick={() => setCteFiles([])} className="text-xs text-[#999] underline hover:text-[#666]">
              limpar XMLs
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 flex items-start justify-between rounded-lg border border-[#ef4444]/30 bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 font-bold">×</button>
          </div>
        )}

        {result && <Results result={result} onGenerateEmail={setEmailRow} />}
      </div>

      {emailRow && result && (
        <EmailModal row={emailRow} table={result.table} onClose={() => setEmailRow(null)} />
      )}
    </main>
  );
}
