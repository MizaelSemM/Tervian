/**
 * Formulário público de captura (tarefa 010) — constantes e helpers puros.
 *
 * Compartilhado entre a configuração (client), a rota pública e o cadastro de
 * empresa (server). Não importa nada de banco para poder rodar no navegador.
 */

export const PUBLIC_FORM_DEFAULT_TITLE = "Fale com nossa equipe";
export const PUBLIC_FORM_DEFAULT_MESSAGE =
  "Recebemos seu contato! Nossa equipe vai falar com você em breve.";
export const PUBLIC_FORM_DEFAULT_DESCRIPTION =
  "Preencha seus dados e entraremos em contato em breve.";

export const PUBLIC_FORM_SLUG_MIN = 3;
export const PUBLIC_FORM_SLUG_MAX = 40;
export const PUBLIC_FORM_TITLE_MAX = 80;
export const PUBLIC_FORM_MESSAGE_MAX = 400;

export const PUBLIC_FORM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normaliza um texto livre em slug (sem acentos, minúsculo, hífens). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PUBLIC_FORM_SLUG_MAX);
}

/**
 * Slug inicial no cadastro: nome da empresa + sufixo aleatório curto.
 * O sufixo evita colisão entre empresas homônimas (a coluna é única global).
 */
export function generatePublicFormSlug(companyName: string): string {
  const base = slugify(companyName) || "empresa";
  const suffix = Math.random().toString(36).slice(2, 6);
  const room = PUBLIC_FORM_SLUG_MAX - suffix.length - 1;
  return `${base.slice(0, room).replace(/-+$/g, "")}-${suffix}`;
}

export function publicFormPath(slug: string): string {
  return `/f/${slug}`;
}

export function publicFormUrl(slug: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}${publicFormPath(slug)}`;
}

/** Snippet de embed copiável (iframe responsivo, altura confortável no mobile). */
export function publicFormEmbedSnippet(url: string): string {
  return `<iframe src="${url}" title="Formulário de contato" width="100%" height="620" style="border:0;max-width:480px" loading="lazy"></iframe>`;
}
