"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { finishImportAction, importContactsChunkAction, previewImportAction } from "./actions";
import {
  IMPORT_CHUNK_SIZE,
  dedupeRows,
  emptyImportResult,
  type ImportChunkRow,
  type ImportColumnMapping,
  type ImportDuplicateAction,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
} from "@/lib/import";

const FIELD_LABELS: Record<keyof ImportColumnMapping, string> = {
  name: "Nome",
  phone: "Telefone",
  email: "E-mail",
  companyText: "Empresa",
  origin: "Origem",
  tags: "Tags",
};

const DUPLICATE_OPTIONS: Array<{ value: ImportDuplicateAction; label: string }> = [
  { value: "skip", label: "Ignorar (padrão)" },
  { value: "update", label: "Atualizar o contato existente" },
  { value: "create", label: "Criar um novo negócio para o contato" },
];

function toChunkRow(row: ImportRow): ImportChunkRow {
  return {
    rowNumber: row.rowNumber,
    name: row.name,
    phone: row.phone,
    email: row.email,
    companyText: row.companyText,
    origin: row.origin,
    raw: row.raw,
  };
}

function addResult(target: ImportResult, part: ImportResult) {
  target.total += part.total;
  target.imported += part.imported;
  target.updated += part.updated;
  target.dealsCreated += part.dealsCreated;
  target.duplicates += part.duplicates;
  target.ignored += part.ignored;
  target.errors.push(...part.errors);
}

export function ImportCsvView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [baseLegal, setBaseLegal] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<ImportDuplicateAction>("skip");
  const [onlyContacts, setOnlyContacts] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(null);
  }

  function handlePreview() {
    if (!file) {
      setError("Selecione um arquivo CSV.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const response = await previewImportAction(formData);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setError(null);
      setPreview(response.preview);
      setMapping(response.preview.mapping);
      setResult(null);
    });
  }

  async function handleImport() {
    if (!file || !preview || !baseLegal || running) return;

    const { rows: rowsToSend, errors: localErrors } = dedupeRows(preview.rows);
    const aggregated = emptyImportResult();
    aggregated.total = preview.total;
    aggregated.duplicates = localErrors.length;
    aggregated.errors.push(...localErrors);

    cancelRef.current = false;
    setError(null);
    setResult(null);
    setRunning(true);
    setProgress({ done: 0, total: rowsToSend.length });

    let processed = 0;
    try {
      for (let index = 0; index < rowsToSend.length; index += IMPORT_CHUNK_SIZE) {
        if (cancelRef.current) break;

        const chunk = rowsToSend.slice(index, index + IMPORT_CHUNK_SIZE);
        const response = await importContactsChunkAction({
          rows: chunk.map(toChunkRow),
          duplicateAction,
          onlyContacts,
          baseLegal: true,
        });

        if (!response.ok) {
          setError(response.error);
          toast.error(response.error);
          break;
        }

        addResult(aggregated, response.result);
        processed += chunk.length;
        setProgress({ done: processed, total: rowsToSend.length });
      }

      // O total do relatório é o que realmente passou pelo servidor (+ duplicados
      // detectados no próprio arquivo). Se cancelar, o parcial fica visível.
      aggregated.total = processed + localErrors.length;

      if (cancelRef.current) {
        toast.message("Importação cancelada. As linhas já enviadas foram mantidas.");
      } else {
        const finish = await finishImportAction({
          imported: aggregated.imported,
          updated: aggregated.updated,
          dealsCreated: aggregated.dealsCreated,
          duplicates: aggregated.duplicates,
          ignored: aggregated.ignored,
          errors: aggregated.errors.length,
        });
        if (!finish.ok && finish.error) toast.error(finish.error);
        else {
          toast.success(
            `${aggregated.imported} contatos importados, ${aggregated.updated} atualizados e ${aggregated.dealsCreated} novos negócios.`,
          );
        }
      }

      setResult(aggregated);
    } catch (importError) {
      console.error("[importacao] Falha inesperada:", importError);
      setError("A importação foi interrompida. O relatório parcial está abaixo.");
      setResult(aggregated);
    } finally {
      setRunning(false);
    }
  }

  function downloadErrors() {
    if (!result?.errors.length) return;
    const header = "linha;motivo;dados";
    const lines = result.errors.map((item) =>
      [
        item.rowNumber,
        `"${item.reason.replace(/"/g, '""')}"`,
        `"${item.raw.replace(/"/g, '""')}"`,
      ].join(";"),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "erros-importacao.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar contatos</h1>
          <p className="text-sm text-muted-foreground">
            Envie um CSV com nome e telefone. Cada linha válida cria um contato, um negócio na etapa
            “Novo” e uma tarefa para hoje.
          </p>
        </div>
        <Link href="/contatos" className="text-sm text-muted-foreground hover:text-foreground">
          ← Contatos
        </Link>
      </div>

      <div className="rounded-xl border border-border p-4">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
          onChange={handleFileChange}
          disabled={running}
          className="block w-full text-sm"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || pending || running}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending && !preview ? "Lendo..." : "Pré-visualizar"}
          </button>
          {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      {preview && (
        <div className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pré-visualização</h2>
              <p className="text-sm text-muted-foreground">
                {preview.total} linhas · {preview.valid} válidas · {preview.invalid} com erro ·
                separador “{preview.separator}” · encoding {preview.encoding}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(FIELD_LABELS) as (keyof ImportColumnMapping)[]).map((field) => (
              <label key={field} className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">{FIELD_LABELS[field]}</span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value === "" ? undefined : Number(event.target.value),
                    }))
                  }
                  disabled={running}
                  className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
                >
                  <option value="">Não usar</option>
                  {preview.headers.map((header, index) => (
                    <option key={`${field}-${index}`} value={index}>
                      {header || `Coluna ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Quando o telefone já existir</span>
              <select
                value={duplicateAction}
                onChange={(event) =>
                  setDuplicateAction(event.target.value as ImportDuplicateAction)
                }
                disabled={running}
                className="rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm"
              >
                {DUPLICATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-start gap-2 text-sm sm:mt-6">
              <input
                type="checkbox"
                checked={onlyContacts}
                onChange={(event) => setOnlyContacts(event.target.checked)}
                disabled={running || duplicateAction === "create"}
                className="mt-1"
              />
              <span>
                Importar apenas contatos (sem negócio nem tarefa de primeiro contato)
                {duplicateAction === "create" && (
                  <span className="block text-xs text-muted-foreground">
                    Indisponível no modo “criar novo negócio”.
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2">Linha</th>
                  <th className="px-2 py-2">Nome</th>
                  <th className="px-2 py-2">Telefone</th>
                  <th className="px-2 py-2">E-mail</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((row) => (
                  <tr key={row.rowNumber} className="border-b border-border/60">
                    <td className="px-2 py-2 text-muted-foreground">{row.rowNumber}</td>
                    <td className="px-2 py-2">{row.name || "—"}</td>
                    <td className="px-2 py-2">{row.phone || "—"}</td>
                    <td className="px-2 py-2">{row.email || "—"}</td>
                    <td className="px-2 py-2">
                      {row.errors.length === 0 ? (
                        <span className="text-emerald-600">OK</span>
                      ) : (
                        <span className="text-destructive">{row.errors.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={baseLegal}
              onChange={(event) => setBaseLegal(event.target.checked)}
              disabled={running}
              className="mt-1"
            />
            <span>Declaro que tenho base legal para tratar estes dados, conforme a LGPD.</span>
          </label>

          {progress && running && (
            <div className="mt-4 flex flex-col gap-1" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Importando {progress.done} de {progress.total} linhas…
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={running || !baseLegal}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {running ? "Importando..." : `Importar ${preview.total} linhas`}
            </button>
            {running ? (
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="text-sm text-destructive hover:underline"
              >
                Cancelar importação
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setResult(null);
                  setError(null);
                  setProgress(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold">Resultado da importação</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} linhas processadas · {result.imported} importadas · {result.updated}{" "}
            atualizadas · {result.dealsCreated} novos negócios · {result.duplicates} duplicadas ·{" "}
            {result.ignored} ignoradas · {result.errors.length} erros
          </p>
          {result.errors.length > 0 && (
            <button
              type="button"
              onClick={downloadErrors}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm"
            >
              Baixar CSV de erros
            </button>
          )}
          <div className="mt-3">
            <Link href="/contatos" className="text-sm text-primary hover:underline">
              Ver contatos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
