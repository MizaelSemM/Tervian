import { z } from "zod";

import { CONTACT_ORIGINS } from "@/lib/schemas/contact";

/**
 * Contrato dos lotes de importação (tarefa 009).
 *
 * O client envia no máximo 100 linhas por chamada para não estourar o tempo da
 * função na Vercel. O servidor revalida cada linha com o schema de contato —
 * este schema só protege o formato do transporte.
 */

export const importChunkRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().max(200),
  phone: z.string().max(50),
  email: z.string().max(200).nullable().optional(),
  companyText: z.string().max(200).nullable().optional(),
  origin: z.enum(CONTACT_ORIGINS).nullable().optional(),
  raw: z.string().max(5000).optional(),
});

export const importChunkInputSchema = z.object({
  rows: z.array(importChunkRowSchema).min(1).max(100),
  duplicateAction: z.enum(["skip", "update", "create"]).default("skip"),
  onlyContacts: z.boolean().default(false),
  baseLegal: z.literal(true),
});

export const importFinishedInputSchema = z.object({
  imported: z.number().int().min(0),
  updated: z.number().int().min(0),
  dealsCreated: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  ignored: z.number().int().min(0),
  errors: z.number().int().min(0),
});

export type ImportChunkInput = z.infer<typeof importChunkInputSchema>;
export type ImportFinishedInput = z.infer<typeof importFinishedInputSchema>;
