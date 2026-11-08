import { notFound } from "next/navigation";

import { prismaBase } from "@/lib/prisma";
import { PublicLeadForm } from "./public-lead-form";

export const instant = false;

export const metadata = {
  title: "Contato — Tervian",
  robots: { index: false, follow: false },
};

export default async function PublicLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const account = await prismaBase.account.findUnique({
    where: { id: slug },
    select: { id: true, name: true },
  });
  if (!account) notFound();

  const utmSource = typeof query.utm_source === "string" ? query.utm_source : undefined;
  const utmMedium = typeof query.utm_medium === "string" ? query.utm_medium : undefined;
  const utmCampaign = typeof query.utm_campaign === "string" ? query.utm_campaign : undefined;
  const sent = query.enviado === "1";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{account.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Fale com nossa equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Preencha seus dados e entraremos em contato em breve.
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-border bg-background p-6 text-center">
          <h2 className="text-2xl font-semibold">Recebemos seu contato</h2>
          <p className="mt-2 text-muted-foreground">
            Obrigado! Nossa equipe entrará em contato em breve.
          </p>
        </div>
      ) : (
        <PublicLeadForm
          slug={slug}
          utmSource={utmSource}
          utmMedium={utmMedium}
          utmCampaign={utmCampaign}
        />
      )}
    </main>
  );
}
