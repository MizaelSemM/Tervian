import { Client } from "pg";

/**
 * Prepara o cenário de performance do E2E (tarefa 014): 200 tarefas abertas
 * para o vendedor da conta demo. Roda no CI depois de `npm run db:seed`.
 *
 * Idempotente: os ids `e2e-perf-task-*` são reutilizados sem duplicar.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const account = await client.query("select id from accounts where id = $1", ["demo-account"]);
    if (account.rowCount === 0) {
      throw new Error("Conta demo não encontrada — rode `npm run db:seed` antes do E2E.");
    }

    const result = await client.query(
      `insert into tasks (id, account_id, deal_id, owner_id, type, title, due_at, created_at, updated_at)
       select 'e2e-perf-task-' || g, 'demo-account', 'demo-deal-01', 'demo-user-seller',
              'OTHER', 'Follow-up de performance ' || g, now(), now(), now()
       from generate_series(1, 200) as g
       on conflict (id) do nothing`,
    );

    console.log(`[e2e] tarefas de performance garantidas (${result.rowCount ?? 0} inseridas).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[e2e] Falha ao preparar o cenário de performance:", error);
  process.exit(1);
});
