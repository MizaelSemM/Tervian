/**
 * Telefone brasileiro ⇄ E.164 (+55DDDNNNNNNNNN).
 *
 * Regras (ver .notes/002-modelo-de-dados.md):
 * - Aceita entrada com máscara, com/sem DDI 55, com/sem zero de operadora.
 * - DDD válido: 11–99. Celular (11 dígitos) deve começar com 9 após o DDD.
 * - Retorna `null` quando não dá para normalizar com segurança.
 * - O banco guarda SEMPRE em E.164 (único por conta).
 */
export function normalizePhoneBR(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;

  // Zero de discagem/operadora (0XX): remove zeros à esquerda.
  digits = digits.replace(/^0+/, "");

  // DDI 55 (somente quando o restante faz sentido como DDD + número: 12–13 dígitos).
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
    digits = digits.replace(/^0+/, "");
  }

  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  if (digits.length === 11 && digits[2] !== "9") return null;

  return `+55${digits}`;
}

/**
 * Formata um telefone E.164 brasileiro para exibição: (11) 98765-4321.
 * Entrada inválida é devolvida como veio (nunca lança).
 */
export function formatPhoneBR(e164: string): string {
  const normalized = normalizePhoneBR(e164);
  if (!normalized) return e164;

  const digits = normalized.slice(3); // remove +55
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/**
 * Link wa.me pronto para "Abrir no WhatsApp" (RF-13).
 * Com `text`, a conversa já abre com a mensagem pronta (RF-36).
 */
export function whatsappLinkBR(e164: string, text?: string): string | null {
  const normalized = normalizePhoneBR(e164);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized.replace("+", "")}`;
  const message = text?.trim();
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Máscara progressiva para o input de telefone (client): formata enquanto a
 * pessoa digita, sem validar. A validação/normalização E.164 é SEMPRE no
 * servidor (`normalizePhoneBR`) — a máscara é só conveniência de UX.
 *
 * Aceita colar com DDI 55 e remove zeros de operadora, para o campo nunca
 * "explodir" com mais de 11 dígitos.
 */
export function maskPhoneInput(input: string): string {
  let digits = input.replace(/\D/g, "").replace(/^0+/, "");

  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2).replace(/^0+/, "");
  }
  digits = digits.slice(0, 11);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
