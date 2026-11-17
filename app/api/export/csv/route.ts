import { getSession } from "@/lib/session";
import { runWithTenant } from "@/lib/tenant-context";
import { AppError } from "@/server/errors";
import { exportContactsCsv, exportDealsCsv } from "@/server/services/export";

/**
 * Exportação CSV da conta (RF-54).
 *
 * `GET /api/export/csv?tipo=contatos` ou `?tipo=negocios` (padrão).
 * Somente ADMIN: é a mesma regra da exportação LGPD da conta inteira.
 *
 * O arquivo é gerado no servidor e baixado como anexo, sempre sem cache.
 */

function fileResponse(csv: string, fileName: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user.active || !session.user.accountId || !session.user.role) {
    return new Response("Não autenticado.", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new Response("A exportação da conta é restrita ao administrador.", { status: 403 });
  }

  const type = new URL(request.url).searchParams.get("tipo") ?? "negocios";
  if (type !== "contatos" && type !== "negocios") {
    return new Response("Tipo de exportação inválido.", { status: 400 });
  }

  try {
    const csv = await runWithTenant(
      {
        accountId: session.user.accountId,
        userId: session.user.id,
        role: "ADMIN",
      },
      () => (type === "contatos" ? exportContactsCsv() : exportDealsCsv()),
    );

    const stamp = new Date().toISOString().slice(0, 10);
    return fileResponse(csv, `tervian-${type}-${stamp}.csv`);
  } catch (error) {
    if (error instanceof AppError) {
      return new Response(error.message, { status: 400 });
    }
    console.error("[export] Falha ao gerar CSV:", error);
    return new Response("Não foi possível exportar os dados agora.", { status: 500 });
  }
}
