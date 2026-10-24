import { env } from "@/lib/env";

/**
 * E-mail transacional (tarefa 003).
 *
 * Com `RESEND_API_KEY` configurada, envia de verdade via API do Resend
 * (chamada HTTP direta — sem SDK). Sem chave (dev/antes da conta do dono), o
 * e-mail é REGISTRADO NO CONSOLE do servidor: dá para copiar os links de reset
 * e convite e testar o fluxo ponta a ponta.
 */

export type EmailInput = {
  to: string;
  subject: string;
  text: string;
};

const DEFAULT_FROM = "Tervian <nao-responda@tervian.dev>";

export function passwordResetEmail(input: { to: string; name: string; url: string }): EmailInput {
  return {
    to: input.to,
    subject: "Redefinir sua senha — Tervian",
    text: [
      `Oi, ${input.name}!`,
      "",
      "Recebemos um pedido para redefinir a senha da sua conta no Tervian.",
      "Este link é de uso único e expira em 1 hora:",
      "",
      input.url,
      "",
      "Se não foi você, ignore este e-mail — sua senha continua a mesma.",
    ].join("\n"),
  };
}

export function inviteEmail(input: {
  to: string;
  accountName: string;
  role: "ADMIN" | "SELLER";
  url: string;
}): EmailInput {
  const roleLabel = input.role === "ADMIN" ? "Administrador(a)" : "Vendedor(a)";
  return {
    to: input.to,
    subject: `Convite para entrar em ${input.accountName} no Tervian`,
    text: [
      `Você foi convidado(a) para entrar em ${input.accountName} no Tervian, como ${roleLabel}.`,
      "",
      "Para aceitar, abra o link e crie sua senha:",
      "",
      input.url,
      "",
      "O convite é de uso único e expira em 7 dias.",
    ].join("\n"),
  };
}

/** Envia (ou registra no console) um e-mail. Nunca lança: retorna se saiu de verdade. */
export async function sendEmail(email: EmailInput): Promise<{ delivered: boolean }> {
  if (!env.RESEND_API_KEY) {
    console.log(
      [
        "[email:dev] Resend não configurado — registrando o e-mail no console.",
        `Para: ${email.to}`,
        `Assunto: ${email.subject}`,
        "",
        email.text,
        "---",
      ].join("\n"),
    );
    return { delivered: false };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? DEFAULT_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[email] Resend recusou o envio (${response.status}):`, body);
    return { delivered: false };
  }

  return { delivered: true };
}
