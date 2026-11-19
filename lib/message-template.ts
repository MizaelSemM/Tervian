/**
 * Modelos de mensagem (RF-36) — funções puras compartilhadas entre servidor e
 * client. Nada aqui pode importar Prisma ou APIs de servidor: o composer usa
 * este módulo no navegador para pré-visualizar a mensagem.
 */

export const MESSAGE_TEMPLATE_VARIABLES = ["nome", "empresa", "vendedor"] as const;

export type MessageTemplateVariable = (typeof MESSAGE_TEMPLATE_VARIABLES)[number];

export const MESSAGE_TEMPLATE_NAME_MAX = 80;
export const MESSAGE_TEMPLATE_BODY_MAX = 1000;

export type MessageTemplateRecord = {
  id: string;
  name: string;
  body: string;
  suggestedStageId: string | null;
};

export type MessageTemplateListItem = MessageTemplateRecord & {
  suggestedStageName: string | null;
};

export type MessageTemplateVars = {
  contactName: string;
  companyName?: string | null;
  sellerName: string;
};

/** Primeiro nome para uma saudação natural ("Oi, Carla!"). */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

const BRACED_TOKEN = /\{([^{}]*)\}/g;

/**
 * Nomes de variáveis usados no corpo, em minúsculas e sem espaços internos.
 * `{ nome }` e `{Nome}` contam como `nome`; o renderer aceita as duas formas.
 */
export function templateVariables(body: string): string[] {
  const names = new Set<string>();
  for (const match of body.matchAll(BRACED_TOKEN)) {
    names.add(match[1].trim().toLowerCase());
  }
  return [...names];
}

/** Variáveis fora do conjunto suportado — o schema usa para recusar o modelo. */
export function unknownTemplateVariables(body: string): string[] {
  return templateVariables(body).filter(
    (name) => !MESSAGE_TEMPLATE_VARIABLES.includes(name as MessageTemplateVariable),
  );
}

/**
 * Substitui `{nome}`, `{empresa}` e `{vendedor}` pelos dados do contato e do
 * vendedor. Campos vazios ganham um fallback neutro para a mensagem nunca sair
 * com chaves soltas.
 */
export function renderMessageTemplate(body: string, vars: MessageTemplateVars): string {
  const values: Record<MessageTemplateVariable, string> = {
    nome: firstName(vars.contactName) || "cliente",
    empresa: vars.companyName?.trim() || "sua empresa",
    vendedor: vars.sellerName?.trim() || "equipe",
  };

  return body.replace(/\{\s*(nome|empresa|vendedor)\s*\}/gi, (_match, name: string) => {
    return values[name.toLowerCase() as MessageTemplateVariable];
  });
}
