export const metadata = {
  title: "Sem conexão — Tervian",
  robots: { index: false, follow: false },
};

/** Fallback do service worker: nunca mostra dado velho, só avisa que falta rede. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Você está sem conexão</h1>
      <p className="text-sm text-muted-foreground">
        O Tervian precisa de internet para mostrar as tarefas do dia. Assim que a conexão voltar, é
        só recarregar.
      </p>
      <a
        href="/hoje"
        className="mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Tentar de novo
      </a>
    </main>
  );
}
