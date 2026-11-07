"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { searchContactsAction, type SearchResult } from "./search-actions";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) return;

    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const next = await searchContactsAction(term);
        setResults(next);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
      >
        Buscar <span className="ml-2 text-xs">Ctrl+K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-lg">
        <div className="border-b border-border p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) setResults([]);
            }}
            placeholder="Buscar contato ou telefone..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {pending && <p className="px-2 py-3 text-sm text-muted-foreground">Buscando...</p>}
          {!pending && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          )}
          <ul className="flex flex-col gap-1">
            {results.map((result) => (
              <li key={result.contact.id} className="rounded-lg p-2 hover:bg-muted/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/contatos/${result.contact.id}`}
                      onClick={close}
                      className="text-sm font-medium hover:underline"
                    >
                      {result.contact.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {result.contact.phone}
                      {result.contact.companyText ? ` · ${result.contact.companyText}` : ""}
                      {result.contact.ownerName ? ` · ${result.contact.ownerName}` : ""}
                    </p>
                  </div>
                  {result.whatsappUrl && (
                    <a
                      href={result.whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                {result.deals.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 pl-2">
                    {result.deals.map((deal: SearchResult["deals"][number]) => (
                      <li key={deal.id} className="text-xs text-muted-foreground">
                        <Link
                          href={`/negocios/${deal.id}`}
                          onClick={close}
                          className="hover:underline"
                        >
                          {deal.title}
                        </Link>
                        {deal.nextActionAt
                          ? ` · próxima ação ${deal.nextActionAt.toLocaleDateString("pt-BR")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {query.trim().length >= 2 && (
            <div className="border-t border-border px-2 py-2">
              <Link
                href={`/contatos/novo`}
                onClick={close}
                className="text-sm text-primary hover:underline"
              >
                Criar lead “{query.trim()}”
              </Link>
            </div>
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          Pressione Esc para fechar.
        </div>
      </div>
    </div>
  );
}
