"use client";

import { useActionState, useState, useTransition } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeBR } from "@/lib/utils";
import {
  createContactNoteAction,
  deleteContactNoteAction,
  updateContactNoteAction,
} from "../actions";

type Note = {
  id: string;
  text: string;
  authorName: string;
  createdAt: Date;
};

export function ContactNotesCard({ notes, contactId }: { notes: Note[]; contactId: string }) {
  const [state, formAction, pending] = useActionState(createContactNoteAction, null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [, startTransition] = useTransition();

  function handleDelete(noteId: string) {
    setDeletingId(noteId);
    startTransition(async () => {
      await deleteContactNoteAction(noteId, contactId);
      setDeletingId(null);
    });
  }

  function handleUpdate(formData: FormData) {
    setUpdateError(null);
    startSaving(async () => {
      const result = await updateContactNoteAction(null, formData);
      if (result?.error) setUpdateError(result.error);
      else setEditingId(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
        <CardDescription>Registros rápidos do contato.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="contactId" value={contactId} />
          <textarea
            name="text"
            rows={3}
            placeholder="Escreva uma nota e pressione Enter para salvar..."
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Adicionar nota"}
            </button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma nota ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-muted/50 px-3 py-2">
                {editingId === note.id ? (
                  <form action={handleUpdate} className="flex flex-col gap-2">
                    <input type="hidden" name="noteId" value={note.id} />
                    <input type="hidden" name="contactId" value={contactId} />
                    <textarea
                      name="text"
                      defaultValue={note.text}
                      rows={3}
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    />
                    {updateError && <p className="text-sm text-destructive">{updateError}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-muted-foreground"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                      >
                        {saving ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeBR(note.createdAt)} · {note.authorName}
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingId(note.id)}
                          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          disabled={deletingId === note.id}
                          className="text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
                        >
                          {deletingId === note.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
