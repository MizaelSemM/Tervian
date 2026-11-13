import { notFound } from "next/navigation";

import { PUBLIC_FORM_DEFAULT_DESCRIPTION, publicFormPath } from "@/lib/public-form";
import { whatsappLinkBR } from "@/lib/phone";
import { loadPublicFormAccount } from "@/server/services/public-form";
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

  // Aceita o slug configurável e o id antigo (links já compartilhados).
  const account = await loadPublicFormAccount(slug);
  if (!account) notFound();

  const utmSource = typeof query.utm_source === "string" ? query.utm_source : undefined;
  const utmMedium = typeof query.utm_medium === "string" ? query.utm_medium : undefined;
  const utmCampaign = typeof query.utm_campaign === "string" ? query.utm_campaign : undefined;
  const sent = query.enviado === "1";
  const whatsapp = account.whatsapp ? whatsappLinkBR(account.whatsapp) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{account.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{account.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{PUBLIC_FORM_DEFAULT_DESCRIPTION}</p>
      </div>

      {sent ? (
        <div className="rounded-2xl border border-border bg-background p-6 text-center">
          <h2 className="text-2xl font-semibold">Recebemos seu contato</h2>
          <p className="mt-2 text-muted-foreground">{account.message}</p>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground"
            >
              Falar no WhatsApp
            </a>
          )}
        </div>
      ) : (
        <PublicLeadForm
          slug={account.slug}
          thankYouMessage={account.message}
          whatsappUrl={whatsapp}
          utmSource={utmSource}
          utmMedium={utmMedium}
          utmCampaign={utmCampaign}
        />
      )}

      <p className="text-center text-xs text-muted-foreground">
        {account.name} · via{" "}
        <a href={publicFormPath(slug)} className="underline-offset-2 hover:underline">
          Tervian
        </a>
      </p>
    </main>
  );
}
