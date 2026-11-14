/**
 * Higiene de dados para logs/analytics (tarefa 013).
 *
 * Módulo puro (sem banco e sem env) para ser testável e reutilizado tanto pelo
 * analytics quanto pelo reporte de erros.
 */

export type SafeProps = Record<string, string | number | boolean | null | undefined>;

const PII_KEYS = new Set([
  "name",
  "nome",
  "phone",
  "telefone",
  "email",
  "e-mail",
  "password",
  "senha",
  "note",
  "nota",
]);

/** Remove chaves que podem carregar dado pessoal. */
export function sanitizeAnalyticsProps(props: SafeProps): SafeProps {
  const clean: SafeProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEYS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

/** Mascara e-mail/telefone em textos de erro antes de logar ou enviar. */
export function scrubErrorText(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email]").replace(PHONE_PATTERN, "[telefone]").slice(0, 500);
}
